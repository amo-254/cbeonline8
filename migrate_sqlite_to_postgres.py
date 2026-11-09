#!/usr/bin/env python3
"""
Safe, one-time CBE PMS V67 SQLite -> PostgreSQL importer.

Default mode is a dry run. Use --apply only after reviewing the dry-run output.
Requires: pip install "psycopg[binary]>=3.2"
Environment: DATABASE_URL
"""
from __future__ import annotations
import argparse
import math
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

TABLES = [
    ("learners", ["id","admission_no","name","class_name","stream","parent_phone","assessment_no","status","graduating_class","graduation_year","gender"]),
    ("settings", ["key","value"]),
    ("users", ["id","username","password","role","password_display"]),
    ("teachers", ["id","name","teacher_no","username"]),
    ("assessments", ["id","grade","term","year","assessment_type","deadline","analyzed","analyzed_at","analysis_count","created_at","deleted","deleted_at"]),
    ("graduating_classes", ["id","label","graduation_year","created_at"]),
    ("scores", ["id","learner_id","learning_area","score","max_score","term","year","assessment_type","assessment_id","grade_at_assessment","stream_at_assessment"]),
    ("teacher_assignments", ["id","teacher_id","learning_area","class_name","stream"]),
    ("class_teacher_assignments", ["id","teacher_id","class_name","stream"]),
    ("graduating_class_members", ["id","graduating_class_id","learner_id","original_grade","original_stream"]),
]
AUTO_ID_TABLES = [name for name, cols in TABLES if "id" in cols]

def source_preflight(path: Path):
    if not path.is_file():
        raise SystemExit(f"SQLite source file not found: {path}")
    src = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    src.row_factory = sqlite3.Row
    integrity = src.execute("PRAGMA integrity_check").fetchone()[0]
    if integrity != "ok":
        raise SystemExit(f"SQLite integrity_check failed: {integrity}")
    fk_errors = src.execute("PRAGMA foreign_key_check").fetchall()
    if fk_errors:
        raise SystemExit(f"SQLite foreign_key_check found {len(fk_errors)} issue(s). No import performed.")
    existing = {r[0] for r in src.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    missing = [t for t, _ in TABLES if t not in existing]
    if missing:
        raise SystemExit("Source database is missing expected V67 tables: " + ", ".join(missing))
    counts = {}
    for table, columns in TABLES:
        actual = {r[1] for r in src.execute(f'PRAGMA table_info("{table}")')}
        absent = [c for c in columns if c not in actual]
        if absent:
            raise SystemExit(f"Table {table} is missing columns: {absent}")
        counts[table] = src.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
    checks = {
        "duplicate_admission_numbers": src.execute(
            "SELECT COUNT(*) FROM (SELECT admission_no FROM learners GROUP BY admission_no HAVING COUNT(*)>1)"
        ).fetchone()[0],
        "duplicate_assessment_scores": src.execute(
            "SELECT COUNT(*) FROM (SELECT learner_id, learning_area, assessment_id FROM scores WHERE assessment_id IS NOT NULL GROUP BY learner_id, learning_area, assessment_id HAVING COUNT(*)>1)"
        ).fetchone()[0],
        # These checks mirror the unique constraints in prisma/schema.prisma.
        # SQLite may not enforce all of them in every V67 database copy, so
        # catch conflicts before attempting the PostgreSQL transaction.
        "duplicate_usernames": src.execute(
            "SELECT COUNT(*) FROM (SELECT username FROM users GROUP BY username HAVING COUNT(*)>1)"
        ).fetchone()[0],
        "duplicate_teacher_usernames": src.execute(
            "SELECT COUNT(*) FROM (SELECT username FROM teachers WHERE username IS NOT NULL GROUP BY username HAVING COUNT(*)>1)"
        ).fetchone()[0],
        "duplicate_class_teacher_streams": src.execute(
            "SELECT COUNT(*) FROM (SELECT class_name, stream FROM class_teacher_assignments GROUP BY class_name, stream HAVING COUNT(*)>1)"
        ).fetchone()[0],
        "duplicate_assessment_keys": src.execute(
            "SELECT COUNT(*) FROM (SELECT grade, term, year, assessment_type FROM assessments GROUP BY grade, term, year, assessment_type HAVING COUNT(*)>1)"
        ).fetchone()[0],
        "duplicate_graduating_class_labels": src.execute(
            "SELECT COUNT(*) FROM (SELECT label FROM graduating_classes GROUP BY label HAVING COUNT(*)>1)"
        ).fetchone()[0],
        "duplicate_graduating_memberships": src.execute(
            "SELECT COUNT(*) FROM (SELECT graduating_class_id, learner_id FROM graduating_class_members GROUP BY graduating_class_id, learner_id HAVING COUNT(*)>1)"
        ).fetchone()[0],
        "unmatched_teacher_login_usernames": src.execute(
            "SELECT COUNT(*) FROM teachers t LEFT JOIN users u ON u.username=t.username WHERE t.username IS NOT NULL AND u.id IS NULL"
        ).fetchone()[0],
        "blank_required_text": src.execute(
            "SELECT (SELECT COUNT(*) FROM learners WHERE trim(admission_no)='' OR trim(name)='') + "
            "(SELECT COUNT(*) FROM users WHERE trim(username)='' OR trim(password)='' OR trim(role)='') + "
            "(SELECT COUNT(*) FROM teachers WHERE trim(name)='') + "
            "(SELECT COUNT(*) FROM assessments WHERE trim(grade)='' OR trim(term)='' OR trim(assessment_type)='' OR trim(created_at)='') + "
            "(SELECT COUNT(*) FROM scores WHERE trim(learning_area)='') + "
            "(SELECT COUNT(*) FROM teacher_assignments WHERE trim(learning_area)='' OR trim(class_name)='' OR trim(stream)='') + "
            "(SELECT COUNT(*) FROM class_teacher_assignments WHERE trim(class_name)='' OR trim(stream)='')"
        ).fetchone()[0],
        "invalid_score_values": src.execute(
            "SELECT COUNT(*) FROM scores WHERE score IS NULL OR max_score IS NULL "
            "OR score < 0 OR max_score <= 0 OR score > max_score "
            "OR score > 1.0e308 OR score < -1.0e308 OR max_score > 1.0e308"
        ).fetchone()[0],
        "invalid_integer_fields": src.execute(
            "SELECT (SELECT COUNT(*) FROM assessments WHERE typeof(year)!='integer' OR typeof(analysis_count)!='integer') + "
            "(SELECT COUNT(*) FROM scores WHERE year IS NOT NULL AND typeof(year)!='integer') + "
            "(SELECT COUNT(*) FROM learners WHERE graduation_year IS NOT NULL AND typeof(graduation_year)!='integer') + "
            "(SELECT COUNT(*) FROM graduating_classes WHERE typeof(graduation_year)!='integer')"
        ).fetchone()[0],
        "orphan_scores": src.execute(
            "SELECT COUNT(*) FROM scores s LEFT JOIN learners l ON l.id=s.learner_id WHERE l.id IS NULL"
        ).fetchone()[0],
        "orphan_score_assessments": src.execute(
            "SELECT COUNT(*) FROM scores s LEFT JOIN assessments a ON a.id=s.assessment_id WHERE s.assessment_id IS NOT NULL AND a.id IS NULL"
        ).fetchone()[0],
        "orphan_teacher_assignments": src.execute(
            "SELECT COUNT(*) FROM teacher_assignments x LEFT JOIN teachers t ON t.id=x.teacher_id WHERE t.id IS NULL"
        ).fetchone()[0],
        "orphan_class_teacher_assignments": src.execute(
            "SELECT COUNT(*) FROM class_teacher_assignments x LEFT JOIN teachers t ON t.id=x.teacher_id WHERE t.id IS NULL"
        ).fetchone()[0],
        "orphan_graduating_memberships": src.execute(
            "SELECT COUNT(*) FROM graduating_class_members x LEFT JOIN learners l ON l.id=x.learner_id LEFT JOIN graduating_classes g ON g.id=x.graduating_class_id WHERE l.id IS NULL OR g.id IS NULL"
        ).fetchone()[0],
    }
    src.close()
    bad = {k:v for k,v in checks.items() if v}
    if bad:
        raise SystemExit(f"Source relationship checks failed: {bad}")
    return counts, checks

def target_schema_preflight(cur):
    """Fail early if Prisma db push has not created the expected PostgreSQL columns."""
    expected = {table: set(columns) for table, columns in TABLES}
    expected["learners"].update({"created_at", "updated_at"})
    missing_tables = []
    missing_columns = {}
    for table, columns in expected.items():
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = current_schema() AND table_name = %s",
            (table,),
        )
        present = {row[0] for row in cur.fetchall()}
        if not present:
            missing_tables.append(table)
        else:
            absent = sorted(columns - present)
            if absent:
                missing_columns[table] = absent
    if missing_tables or missing_columns:
        details = []
        if missing_tables:
            details.append("missing tables: " + ", ".join(missing_tables))
        if missing_columns:
            details.append("missing columns: " + repr(missing_columns))
        raise SystemExit(
            "PostgreSQL target schema is not ready. Apply the Prisma schema first "
            "with `npx prisma db push`; " + "; ".join(details)
        )


def values_match(expected, actual):
    """Compare SQLite/PostgreSQL scalar values without hiding data changes."""
    if expected is None or actual is None:
        return expected is None and actual is None
    if isinstance(expected, (int, float)) and not isinstance(expected, bool):
        if isinstance(actual, (int, float)) and not isinstance(actual, bool):
            return math.isclose(float(expected), float(actual), rel_tol=1e-12, abs_tol=1e-9)
    return expected == actual


def verify_imported_values(src, cur, sql):
    """Compare every migrated source field with its target row before commit."""
    mismatches = []
    for table, columns in TABLES:
        key = "id" if "id" in columns else "key"
        selected = ", ".join('"' + c + '"' for c in columns)
        source_rows = src.execute(
            f'SELECT {selected} FROM "{table}" ORDER BY "{key}"'
        ).fetchall()
        query = sql.SQL("SELECT {} FROM {} WHERE {} = %s").format(
            sql.SQL(",").join(map(sql.Identifier, columns)),
            sql.Identifier(table),
            sql.Identifier(key),
        )
        for source_row in source_rows:
            record = dict(source_row)
            # Deliberately discard legacy plaintext temporary passwords.
            if table == "users":
                record["password_display"] = None
            if table == "assessments":
                record["analyzed"] = bool(record["analyzed"])
                record["deleted"] = bool(record["deleted"])
            cur.execute(query, (record[key],))
            target_row = cur.fetchone()
            if target_row is None:
                mismatches.append(f"{table}.{key}={record[key]}: target row missing")
            else:
                for column, actual in zip(columns, target_row):
                    if not values_match(record[column], actual):
                        mismatches.append(
                            f"{table}.{key}={record[key]}.{column}: "
                            f"source={record[column]!r}, target={actual!r}"
                        )
                        if len(mismatches) >= 20:
                            break
            if len(mismatches) >= 20:
                break
        if len(mismatches) >= 20:
            break
    if mismatches:
        raise RuntimeError(
            "Imported value verification failed; transaction will be rolled back:\n  "
            + "\n  ".join(mismatches)
        )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sqlite_file", type=Path, help="Path to the backed-up cbe_pms.db file")
    ap.add_argument("--apply", action="store_true", help="Actually write rows to PostgreSQL (default is dry-run)")
    ap.add_argument("--source-only", action="store_true", help="Validate the SQLite source without connecting to PostgreSQL")
    args = ap.parse_args()
    counts, checks = source_preflight(args.sqlite_file)
    print("SOURCE PREFLIGHT: PASS")
    print("SQLite table counts:")
    for table, count in counts.items():
        print(f"  {table}: {count}")
    print("Relationship checks:", checks)
    if args.source_only:
        print("SOURCE-ONLY CHECK: complete; no PostgreSQL connection or data changes.")
        return

    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("Set DATABASE_URL to the target PostgreSQL connection string.")
    try:
        import psycopg
        from psycopg import sql
    except ImportError as exc:
        raise SystemExit('Install the PostgreSQL driver first: pip install "psycopg[binary]>=3.2"') from exc

    with psycopg.connect(url) as pg:
        with pg.cursor() as cur:
            target_schema_preflight(cur)
            nonempty = {}
            for table, _ in TABLES:
                cur.execute(sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(table)))
                n = cur.fetchone()[0]
                if n:
                    nonempty[table] = n
            if nonempty:
                raise SystemExit(
                    "Target database is not empty in one or more migration tables. "
                    f"Refusing to merge/overwrite: {nonempty}. Use a fresh empty database."
                )
            if not args.apply:
                print("TARGET PREFLIGHT: PASS (all target tables empty)")
                print("DRY RUN ONLY: no records were written. Re-run with --apply to import.")
                return

            # Re-run the source checks immediately before import. This catches a
            # source file that changed after the initial dry-run/preflight.
            latest_counts, latest_checks = source_preflight(args.sqlite_file)
            if latest_counts != counts or latest_checks != checks:
                raise SystemExit("SQLite source changed after preflight. No import performed; run the checks again.")
            src = sqlite3.connect(f"file:{args.sqlite_file}?mode=ro", uri=True)
            src.row_factory = sqlite3.Row
            imported = {}
            try:
                with pg.transaction():
                    with pg.cursor() as cur:
                        for table, columns in TABLES:
                            rows = src.execute(
                                f'SELECT {",".join(chr(34)+c+chr(34) for c in columns)} FROM "{table}" ORDER BY ' +
                                ('"id"' if "id" in columns else '"key"')
                            ).fetchall()
                            if not rows:
                                imported[table] = 0
                                continue
                            values = []
                            target_columns = list(columns)
                            if table == "learners":
                                # The online schema tracks creation/update timestamps, while
                                # the V67 SQLite table did not. Preserve every source field
                                # and initialize both metadata fields at import time.
                                target_columns.extend(["created_at", "updated_at"])
                            imported_at = datetime.now(timezone.utc) if table == "learners" else None
                            for row in rows:
                                record = dict(row)
                                # Legacy password_display held readable temporary passwords.
                                # Never copy that plaintext field into the online database.
                                if table == "users":
                                    record["password_display"] = None
                                if table == "assessments":
                                    record["analyzed"] = bool(record["analyzed"])
                                    record["deleted"] = bool(record["deleted"])
                                row_values = [record[c] for c in columns]
                                if table == "learners":
                                    row_values.extend([imported_at, imported_at])
                                values.append(tuple(row_values))
                            query = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
                                sql.Identifier(table),
                                sql.SQL(",").join(map(sql.Identifier, target_columns)),
                                sql.SQL(",").join(sql.Placeholder() for _ in target_columns),
                            )
                            cur.executemany(query, values)
                            imported[table] = len(values)

                        # Advance PostgreSQL serial sequences beyond the preserved source IDs.
                        for table in AUTO_ID_TABLES:
                            cur.execute(sql.SQL(
                                "SELECT setval(pg_get_serial_sequence(%s,'id'), "
                                "GREATEST(COALESCE(MAX(id),1),1), MAX(id) IS NOT NULL) FROM {}"
                            ).format(sql.Identifier(table)), (table,))
                        # Verify all source fields, not just row counts, before commit.
                        # Any mismatch raises and rolls back the complete import.
                        verify_imported_values(src, cur, sql)
                        print("VALUE VERIFICATION: PASS (all imported source fields match)")

                        # Verify counts inside the same transaction before commit.
                        for table, expected in counts.items():
                            cur.execute(sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(table)))
                            actual = cur.fetchone()[0]
                            if actual != expected:
                                raise RuntimeError(f"Count mismatch for {table}: expected {expected}, got {actual}")
                print("IMPORT: COMMITTED")
                for table, count in imported.items():
                    print(f"  {table}: {count}")
                print("All source/target table counts match.")
            finally:
                src.close()

if __name__ == "__main__":
    main()
