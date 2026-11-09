# V67 database migration — verified source

The uploaded SQLite database passed `PRAGMA integrity_check` and the source relationship checks performed for this conversion. It contains:

| Table | Rows |
|---|---:|
| learners | 319 |
| scores | 4,484 |
| users | 13 |
| teachers | 12 |
| teacher_assignments | 55 |
| class_teacher_assignments | 6 |
| assessments | 5 |
| settings | 9 |
| graduating_classes | 0 |
| graduating_class_members | 0 |

The database also passed checks for duplicate admission numbers and orphaned score/assessment/teacher/graduate references.

## Important security behavior
All 13 legacy passwords are SHA-256 hashes. The online login endpoint verifies a legacy SHA-256 hash on the first successful login and upgrades it to bcrypt. The importer deliberately sets `users.password_display` to NULL; readable legacy password-display values are not copied.

## Run a safe migration
1. Back up the SQLite file and keep the original unchanged.
2. Create a **new, empty** PostgreSQL database for the import.
3. Configure `DATABASE_URL` for that database and apply the Prisma schema with `npx prisma db push`.
4. (Optional) Validate the SQLite file without a PostgreSQL connection:
   `python scripts/migrate_sqlite_to_postgres.py "C:\path\to\cbe_pms.db" --source-only`
5. Install the importer dependency: `python -m pip install "psycopg[binary]>=3.2"`.
6. Run a target-aware dry-run first:
   `python scripts/migrate_sqlite_to_postgres.py "C:\path\to\cbe_pms.db"`
7. Review the preflight output. It refuses to continue if the source fails integrity/relationship checks or if any target table already contains rows.
8. Only after reviewing the dry run, apply:
   `python scripts/migrate_sqlite_to_postgres.py "C:\path\to\cbe_pms.db" --apply`
9. Verify all table counts in PostgreSQL and test sign-in, learner lookups, assessments and reports before switching school users to the online system.

The online `learners` table also has `created_at` and `updated_at` metadata columns, which were not present in V67 SQLite. The importer initializes both to the UTC import timestamp for each imported learner. These are migration metadata, not original learner registration dates.

The migration preserves original integer IDs and foreign-key relationships. It is transactional: a failed insert or count mismatch rolls back the entire import. The script does not overwrite or merge with an existing target database.

## School logo
The SQLite `school_logo` setting is preserved during migration. In the supplied V67 database it points to a local Windows file (`C:\Users\...\school_logo.png`), not to image bytes. That path cannot be loaded by a website running on Vercel, so the online settings and report APIs intentionally suppress it rather than emit a broken image URL. After deployment, sign in as Administrator, open School profile and report settings, upload the actual PNG/JPG/WebP logo, and save. The online settings screen stores the uploaded image content for use by printable reports.

## Additional target-schema protection
Before checking target row counts or importing anything, the importer now checks
that every expected Prisma table and source-mapped column exists in the active
PostgreSQL schema. If the schema is incomplete, it stops with the missing table
or column names and asks you to run `npx prisma db push`. In `--apply` mode it
also repeats the SQLite integrity and relationship preflight immediately before
opening the source for the import, and stops if the table counts or checks have
changed since the initial preflight.
