#!/usr/bin/env node
/**
 * Fast syntax-only check for the Next.js source tree.
 * This deliberately does not replace `tsc --noEmit` or `next build`.
 */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const ignored = new Set(['node_modules', '.next', '.git']);
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) files.push(full);
  }
}
walk(root);
const errors = [];
for (const file of files) {
  try {
    const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: file,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.Preserve,
      },
    });
    for (const diagnostic of result.diagnostics || []) {
      if (diagnostic.category === ts.DiagnosticCategory.Error) {
        errors.push(`${path.relative(root, file)}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
      }
    }
  } catch (error) {
    errors.push(`${path.relative(root, file)}: ${error.message}`);
  }
}
if (errors.length) {
  console.error(`TypeScript syntax check failed (${errors.length} error(s)):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`TypeScript syntax check passed: ${files.length} .ts/.tsx files parsed.`);
console.log('Note: this checks syntax only; run `npm run typecheck` and `npm run build` for full validation.');
