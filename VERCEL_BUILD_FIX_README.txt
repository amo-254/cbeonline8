CBE PMS - cbeonline7 App Router and Prisma path repair

The uploaded cbeonline7 ZIP had flattened source paths. The Prisma schema was at
the repository root as schema.prisma, while package.json expected prisma/schema.prisma.
The Next.js app pages, API handlers, shared library files and scripts were also flattened.

This repair reconstructs:
- app/page.tsx, app/layout.tsx, app/globals.css
- app/dashboard/page.tsx and app/login/page.tsx
- app/api/*/route.ts handlers for all 14 API endpoints
- lib/*.ts shared utilities
- prisma/schema.prisma and prisma/seed.ts
- scripts/* migration and syntax-check scripts

Build command:
  prisma generate --schema=./prisma/schema.prisma && next build

Node.js:
  26.x

The npm install scripts for @prisma/client, prisma, @prisma/engines and esbuild are
explicitly approved.

Deploy:
1. Extract this ZIP.
2. Upload all extracted contents directly into the ROOT of the GitHub repository.
3. Set Vercel Root Directory to "." (repository root).
4. Confirm DATABASE_URL and SESSION_SECRET are configured in Vercel.
5. Set CRON_SECRET if scheduled academic-year transition is used.
6. Commit and redeploy.

Database safety:
- This repair does not run db push, db seed, reset, or data migration.
- Back up production data and review schema changes before any migration.
- A complete production build has not been executed in this environment. Inspect the
  next Vercel log for any remaining TypeScript or Next.js errors.
