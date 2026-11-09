# CBE PMS Online — conversion foundation

This is a new Next.js/PostgreSQL web application scaffold based on the uploaded CBE PMS V67 source package.

## Current scope
- Responsive browser-based login and role-aware dashboard
- PostgreSQL schema representing the V67 core entities
- Server-side session cookies (HTTP-only, 12-hour expiry)
- Legacy SHA-256 password verification with automatic bcrypt upgrade on successful login
- Protected learner, assessment and score API foundations
- CBE learning-area list and V67 8-point grading bands
- Data-migration plan and safeguards

## Not yet production-complete
The desktop V67 application contains a large amount of Tkinter-specific workflow and ReportLab PDF logic. Those screens and report generators must be ported and tested individually. The dashboard intentionally labels unfinished modules instead of pretending they are ready. Do not enter live learner data until the remaining modules, authorization checks, backups and migration have been tested.

## Run locally
1. Install Node.js 20+.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and a random `SESSION_SECRET` (32+ characters).
3. Run `npm install`.
4. Run `npx prisma generate`.
5. Run `npx prisma db push`.
6. Run `npm run db:seed` for temporary development-only accounts.
7. Run `npm run dev` and open http://localhost:3000.

Development seed accounts (change immediately): `admin / admin123`, `teacher / teacher123`.

## Deployment
Create a PostgreSQL database (Neon is a suitable Vercel Marketplace option), set `DATABASE_URL` and `SESSION_SECRET` in Vercel project environment variables, connect this directory to a Git repository, and deploy. Do not put database credentials in source control.

## V67 source reference
The original uploaded ZIP contains `cbe_pms.py`, README and V67/V76 feature notes. It does not contain the live SQLite database file. See `scripts/README_MIGRATION.md` before migrating records.


## Uploaded V67 database status
The user supplied the actual SQLite database after the initial scaffold was created. It passed SQLite integrity and relationship checks: 319 learners, 4,484 scores, 13 user accounts, 12 teacher records, 55 teacher assignments, 6 class-teacher assignments, 5 assessments and 9 settings. The database is not automatically copied into this source ZIP; use the safe importer in `scripts/` against a fresh PostgreSQL database. The importer defaults to dry-run and requires `--apply` for the transaction.

## Additional V67 calculation ports
- `lib/merit.ts` ports the V67 merit-list rules: blank missing learning areas, exclude learners with no recorded score, calculate 8-point totals, default ranking by total marks, and optionally rank by total points.
- `lib/assessment-analysis.ts` ports the previous-assessment selection preference, including End Year Assessment comparing first with Mid-Term Assessment in the same term/year when available.
- These are calculation-layer ports; the full online merit/analysis screens and PDF exports still need to be connected and verified against sample V67 reports.

## Learner management module (conversion stage)
The administrator dashboard now includes a working learner-record interface backed by `/api/learners`: list/search by learner name, admission number or assessment number; filter by grade; register and edit learner details; and archive a learner. Archiving marks the learner inactive instead of deleting the record, preserving historical scores and reports. Grade values remain the original database values (`1` through `9`) while the interface displays `Grade 1` through `Grade 9`.

This is still a staged conversion build, not a production-ready school system. Install dependencies, configure a PostgreSQL database, run the migration dry-run and validate imported data before using it with live records. Full teacher management, score workflow, reporting, PDF generation, grade transition automation, and security hardening remain to be completed and tested.


## Teacher management module (conversion stage)
The administrator dashboard now includes `/api/teachers` and a teacher-management interface. Administrators can create teacher login accounts, edit teacher details, promote/demote the account role, assign learning areas by grade and stream, designate class-teacher streams, reset a teacher password, and delete a teacher/login account. New accounts receive a generated six-digit temporary password displayed once after creation or reset. Usernames are generated from the teacher's first name and the first word of the school name, with a numeric suffix if needed. Share temporary passwords securely and require users to change them after first login in a later hardening stage.

The teacher module still requires integration testing against the migrated school database, especially class-teacher uniqueness and legacy teacher records that may not have linked login accounts. It is not production-ready.

## Assessment management and score-entry module (development build)

The dashboard now includes an assessment workspace for administrators and teachers. Administrators can create assessments, edit assessment type/deadline without changing linked score rows, mark an assessment analysed/closed, and archive it without deleting its scores. Teachers can view assessments and enter scores only for assigned learning areas/classes/streams. The score API checks assessment deadline and analysed state; administrator corrections remain possible after closure. Saving the same learner + assessment + learning-area combination updates the existing score rather than adding a duplicate.

The score-entry screen supports grade and stream filtering, learner search, maximum marks, and batch saving of populated score fields. This module is still a development implementation: the learning-area catalogue and exact V67 assessment-analysis calculations must be reconciled against the original desktop source, and full integration testing requires a configured PostgreSQL database.

## Reporting module (development)

The Reports workspace now reads score records for a selected assessment and provides:
- Merit list ranking by total marks (default) or total points.
- Blank/missing learning-area scores excluded from totals; learners with no scored learning area are omitted.
- Grade and stream filters.
- Learning-area average percentage and EE1–BE2 performance-level counts.
- Browser Print / Save as PDF output in landscape layout.

Teacher report data is filtered to the teacher's assigned learning area, grade and stream combinations. This is an initial reporting implementation, not yet a complete port of every V67 report. In particular, previous-assessment comparisons, stream top-five/top-ten lists, best learner by learning area, learner progress reports/transcripts, comments, school logo layout, and full report parity remain to be implemented and validated against V67.

## Advanced assessment analysis (additional conversion stage)
The Reports workspace now includes an advanced analysis view ported from V67 `_analysis_snapshot` and `analysis_pdf_report`. It provides overall mean, learning-area ranking and deviations, performance-level counts by learning area, stream ranking, top ten learners, best learner per learning area, most improved learners overall, and most improved learner by learning area. The report API also selects a previous assessment using the V67 preference order, including End Year Assessment -> Mid-Term Assessment in the same term/year when available. Teacher previous/current data is restricted to their assigned learning-area/class/stream combinations.

The advanced analysis is a browser report that can be printed or saved as PDF. It is not yet a replacement for all of V67's ReportLab layouts, learner comments, school-logo formatting, individual learner report PDFs, or transcript PDFs. A full application build and database integration test still require installing dependencies and configuring PostgreSQL.

## Learner transcript module (development)

The dashboard now includes **Learner Transcripts** for administrators and teachers. It supports search by admission number, assessment number, or learner name; displays a learner's recorded assessment history; calculates the V67 fixed 900-mark overall percentage and 72-point maximum; displays subject-level scores, points, and performance levels; and calculates grade/stream positions for assessments linked to an assessment record. Use the browser Print dialog to save the transcript as PDF.

Class-teacher and HOI comments now use the deterministic, performance-band comment generator ported from V67 (`performance_comments`), so the same learner/result produces consistent comment text. The assigned class teacher is displayed when a matching class/stream assignment exists. The transcript header includes the configured school logo, motto and contact details. These generated comments are not persisted as editable comments because the uploaded SQLite schema does not contain dedicated comment fields. The transcript endpoint enforces teacher learning-area assignment filtering. This module remains subject to full database-backed integration testing before live school use.

## School settings and printable registered learner list

The administrator School Settings section now saves the school name, motto, address, phone, email, logo and Mid-Term/Closing assessment mode in the PostgreSQL `settings` table. The logo is stored as a data URL and limited to about 1.5 MB; for a production school with multiple report images, move this to object storage.

The Manage Learners table now has a Print / Save PDF action. Use the browser print dialog and select Save as PDF. The print stylesheet uses A4 landscape, hides navigation and editing controls, and repeats a clean registered-learners heading. This is browser-based printing, not a server-generated PDF engine.


## Transcript report refinements (additional conversion stage)
The transcript print layout now includes the school logo and configured school contact details, displays the assigned class teacher when available, and uses V67's deterministic performance comments for the latest available assessment. Comment text is generated from the learner's overall percentage and internal learner ID using the same five achievement bands and 60 combinations per role as the desktop implementation. The comments are generated at report time and are not editable/persisted. The report remains browser-print based; bulk all-learner report compilation and exact one-page ReportLab parity remain future work.

## Combined all-learner assessment reports

The Reports workspace now includes an administrator-only **All learner reports** view. Select one assessment and optionally filter by grade and stream, then generate a combined browser-print document with one learner report per page. Reports are ordered by grade position (position 1 first), then grade sequence and learner name. The rank is calculated across the full grade and stream cohort for the selected assessment even when the displayed reports are filtered to one stream.

Each report includes the school identity/logo from School Settings, learner/admission details, assessment metadata, recorded learning-area scores, CBE points and levels, the V67 fixed 900-mark overall denominator, grade and stream positions, the assigned class teacher, and generated class-teacher/HOI comment text. Missing learning-area score rows are not fabricated. Teachers are blocked from this combined full-report endpoint; they continue to use their assigned-area views.

**Print note:** this feature uses the browser print dialog (choose Save as PDF); it is not a server-generated ReportLab PDF. Confirm the browser's print preview and page count before distributing reports. The complete Next.js production build and live database integration still require installing project dependencies and configuring a PostgreSQL `DATABASE_URL`.

## Academic-year transition and graduating classes

The administrator dashboard now includes a Graduating Classes module. It previews active Grade 7, 8 and 9 counts and the last recorded transition year. The administrator can initialize the year or run any pending transitions manually.

A Vercel Cron is also configured in `vercel.json` for 00:00 UTC on 1 January (03:00 East Africa Time). Set `CRON_SECRET` in the Vercel project environment variables. The scheduled endpoint requires `Authorization: Bearer <CRON_SECRET>` and is safe to rerun: it uses the `last_grade_transition_year` setting to prevent repeating a completed year.

The transition follows the V67 desktop logic: first initialization records the current year without moving learners; for each subsequent academic year, active Grade 9 learners are archived under `Graduating Class of <previous year>`, Grade 8 advances to Grade 9, and Grade 7 advances to Grade 8. Grade 9 East and West are grouped into the same cohort. Missing score grade/stream snapshots are filled before learner registration changes; existing snapshots and scores are not overwritten. All changes for each catch-up run are performed in one PostgreSQL transaction.

Do not run a transition against production data until the SQLite migration has been reviewed and the destination PostgreSQL database has been backed up. The supplied SQLite database currently records `last_grade_transition_year=2026`, so the next scheduled transition is due on 1 January 2027.


## Migration compatibility correction

The learner timestamp fields in the PostgreSQL schema now have database defaults, and the SQLite importer explicitly initializes `created_at` and `updated_at` for imported learner rows. This avoids a raw-SQL insert failure because the original V67 `learners` table did not contain those metadata columns. The importer also supports `--source-only` to run SQLite integrity, expected-column, duplicate-admission and relationship checks without requiring PostgreSQL credentials. The uploaded database passed this source-only check.


## Authorization hardening pass

The score-reading API now limits teacher accounts to the exact assigned learning-area / grade / stream combinations; administrator accounts retain full access. Session validation now re-checks the account in PostgreSQL on each request, so deleting an account, changing its username, or changing its role takes effect without waiting for the 12-hour JWT to expire. This adds a database lookup to authenticated requests and still requires a live integration/security test. Login rate limiting, password-reset session revocation, and a full CSRF/security review remain outstanding before production.

## Teacher access and score-entry safeguards (latest update)

- Teacher learner-register requests are restricted server-side to the exact grade/stream combinations in that teacher's learning-area assignments.
- Teacher roster responses omit parent phone numbers and other administrator-only learner fields.
- Teacher score retrieval checks the grade and stream snapshots stored on each score, so historical results remain available after a learner advances to another grade.
- Changing the selected learning area refreshes the existing score values in the score-entry table.
- Administrator learner-management endpoints remain administrator-only.

The SQLite source-only migration preflight was rerun after this update and passed: 319 learners, 4,484 scores, 13 users, 12 teachers, 5 assessments, 55 learning-area assignments, and 6 class-teacher assignments; all checked relationships and admission-number uniqueness checks passed.

### Score-entry lock and teacher data access parity

The online score API follows the original V67 rule: a teacher is prevented from editing scores only when the assessment has been analysed **and** its submission deadline has elapsed. An analysed assessment whose deadline is still in the future remains editable by an assigned teacher; an elapsed deadline on an assessment that has not yet been analysed does not by itself lock the teacher. Administrators retain override access. Legacy `DD/MM/YYYY` and `DD/MM/YYYY HH:MM` deadlines are interpreted as Kenya local time (UTC+3), while ISO timestamps retain their explicit timezone. Teacher score responses return the learner fields needed for score sheets and omit parent contact details.


## Latest report improvements
- Assessment report print headers now read the configured school name, logo, motto, address, phone and email from the school settings API.
- Combined-stream analysis is explicitly titled `ASSESSMENT ANALYSIS REPORT - COMBINED STREAMS`.
- Advanced analysis now allows the administrator to choose Top 5 or Top 10 learners.
- Overall current-vs-previous assessment mean and percentage-point deviation are displayed when a comparable previous assessment exists.
- Printed report pages use Times New Roman and repeat table headings where the browser print engine supports it.

These report changes are source-level updates. A full Next.js typecheck/build still requires installing the project's dependencies; the current workspace does not contain `node_modules`, so a successful production build has not been verified.


### Score-entry deadline and duplicate protection update

- Legacy V67 deadlines in `DD/MM/YYYY` or `DD/MM/YYYY HH:MM` are interpreted as Kenya local time (UTC+3), including on UTC-hosted Vercel functions.
- The online date/time form is explicitly converted from Kenya wall time to UTC before it is saved.
- The V67 teacher lock rule is preserved: a teacher is blocked only when the assessment is both analysed and past its deadline. Either condition by itself does not lock teacher editing.
- The score table now has a compound uniqueness constraint on learner, learning area and assessment. The score API uses an atomic upsert to prevent duplicate rows during repeated or concurrent submissions. The migration preflight checks this condition before import.
- The source SQLite database currently has no duplicate learner/learning-area/assessment score groups, so it passes this new constraint check.

After updating an existing PostgreSQL database, apply the Prisma schema change through a reviewed migration or `npx prisma db push` against the intended database before enabling score entry.

## Transcript access and historical records update (8 November 2026)

- Transcript searches include both active and graduated learners for administrators, so graduating learners' records remain available for historical review.
- Teacher transcript search includes learners from the teacher's current assigned class/stream and learners with historical score snapshots matching the teacher's assigned learning area, grade, and stream.
- A teacher cannot retrieve another learner's identity/history by guessing a learner ID when none of the learner's scores fall within that teacher's assignments.
- Transcript responses now return only the learner fields required by the transcript screen; parent contact details and unrelated administrative fields are not exposed.
- The transcript's class-teacher name is resolved against the grade/stream of the learner's latest assessment period, rather than blindly using the learner's current class after promotion.
- Transcript ranking peer scores are fetched in a single batched query for the learner's assessment history instead of one database query per assessment period.

These changes preserve the original V67 report calculations: overall learner percentage uses the fixed 900-mark denominator, and each recorded learning area contributes its CBE points. The transcript remains a report of recorded scores; missing areas are not inserted as zero-score rows.

## V67 migration and school-logo compatibility update (8 November 2026)

- Expanded the read-only SQLite preflight to validate required text fields, finite/range-safe score values, integer year/count fields, and the existing relationship/uniqueness checks before any PostgreSQL write.
- Re-ran the source-only validation against the supplied V67 database: 319 learners, 4,484 scores, 13 users, 12 teachers, 5 assessments, 55 teacher learning-area assignments, 6 class-teacher assignments, and no reported preflight issues.
- Added a shared public-school-settings sanitizer. Transcript and all-learner report APIs no longer emit a desktop Windows path as a browser image source. Only PNG/JPEG/WebP base64 image data is exposed as the logo.
- Updated logo upload validation and migration guidance. After importing and deploying, an administrator must upload the actual logo image again through School profile and report settings because the SQLite value is a local Windows path, not the image file itself.

These checks do not constitute a PostgreSQL import or a production build/deployment. The target database still needs to be provisioned and configured before migration.

### Migration target-schema guard
The SQLite importer now verifies that the active PostgreSQL schema contains all
expected Prisma tables and mapped columns before checking that the target is
empty. It also repeats source integrity/relationship preflight immediately
before an apply operation and refuses to proceed if the source preflight results
have changed. See `scripts/README_MIGRATION.md` for the safe import sequence.

## Project validation commands

From the project root, install the dependencies and run:

- `npm run check:syntax` — quick TypeScript/TSX syntax parse across the source tree. This does not perform type checking.
- `npm run typecheck` — full TypeScript type check (`tsc --noEmit`).
- `npm run db:validate` — validate the Prisma schema and datasource configuration.
- `npm run build` — generate the Prisma client and run the production Next.js build.

The syntax check is useful when reviewing changes, but it is not a substitute for the full type check or production build. Those commands require the project dependencies to be installed.

### Migration value-by-value verification (8 November 2026)

- The one-time SQLite-to-PostgreSQL importer now compares every migrated source field against the corresponding PostgreSQL row inside the same transaction, before commit.
- It checks for missing target rows and reports up to 20 field-level mismatches. Any mismatch raises an error and rolls back the full import.
- Numeric score values are compared with a tight floating-point tolerance; legacy plaintext `password_display` values remain intentionally cleared, and assessment boolean fields are normalized before comparison.
- Row-count verification remains in place as an additional check after field-level verification.

This verification code has been syntax-checked and the SQLite source preflight passes. A live PostgreSQL dry run/import cannot be claimed until a target database and `DATABASE_URL` are configured.

## Vercel / npm install-script policy

The project explicitly approves the reviewed Prisma lifecycle scripts in `package.json` (`allowScripts`): `prisma` and `@prisma/client`. This is required by newer npm releases that otherwise block unreviewed dependency install scripts. The `postinstall` and `build` scripts both run `prisma generate`; the build command therefore generates the Prisma Client before Next.js compiles the application.

Use Node.js 20.x or 22.x on Vercel. Set `DATABASE_URL` and `SESSION_SECRET` in the Vercel project environment variables. The npm message `Unknown env config "cache-dir"` is a non-fatal configuration warning, not a TypeScript or Prisma build failure; if it is configured in the Vercel project's Environment Variables, remove the unsupported `NPM_CONFIG_CACHE_DIR` / `npm_config_cache_dir` entry. The supplied build excerpt ends during dependency installation, so a later build-stage error (if any) must be diagnosed from the remaining log.
