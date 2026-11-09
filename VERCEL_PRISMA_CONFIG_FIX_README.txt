CBE PMS ONLINE — PRISMA CONFIGURATION UPDATE

This update removes the deprecated package.json#prisma setting and uses a dedicated prisma.config.ts file.

The config points to prisma/schema.prisma. The postinstall and build scripts still explicitly pass --schema=./prisma/schema.prisma.

The build log supplied before this update ended after a deprecation WARNING. That warning is not itself a build failure. The next lines after it are needed to identify any actual fatal error.

Deployment layout requirement:
- package.json
- prisma.config.ts
- prisma/schema.prisma
must all be at the selected Vercel Root Directory.

Upload the CONTENTS of CBE_PMS_ONLINE_V1 into the GitHub repository root, or set Vercel Root Directory to CBE_PMS_ONLINE_V1 if that folder is committed as a nested directory.
This change does not modify the database schema or database records.
