CBE PMS ONLINE — PRISMA SCHEMA PATH FIX

Cause addressed:
Vercel ran `prisma generate` but Prisma could not locate its schema.
This project now explicitly declares and passes:
  ./prisma/schema.prisma

IMPORTANT GITHUB / VERCEL SETUP:
1. Extract this ZIP.
2. Open the CBE_PMS_ONLINE_V1 folder.
3. Upload the CONTENTS of that folder (app, lib, prisma, package.json, etc.)
   directly into the root of the GitHub repository.
4. In Vercel Project Settings > Build and Development Settings, set
   Root Directory to the repository root when package.json and
   prisma/schema.prisma are both in the repository root.
5. Confirm the GitHub repository contains this exact path:
   prisma/schema.prisma
   alongside package.json.
6. Redeploy.

If you intentionally keep all project files inside a nested
CBE_PMS_ONLINE_V1 directory, set Vercel's Root Directory to
CBE_PMS_ONLINE_V1 instead. The package.json and prisma folder must be
at the same selected project root.

The Prisma schema file is included in this ZIP. This patch does not
change the database schema or delete database records.
