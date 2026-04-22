/* eslint-disable */
// Post-build: copy non-TS assets needed at runtime into dist/server/.
// Runs after `tsc -p server/tsconfig.json`.

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '..', 'server');
const OUT_DIR = path.resolve(__dirname, '..', 'dist', 'server');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  console.log(`  copied ${path.relative(process.cwd(), dest)}`);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else copyFile(s, d);
  }
}

ensureDir(OUT_DIR);

// Mark dist/server as CommonJS so compiled output is loaded correctly,
// even though the root package.json has "type": "module".
fs.writeFileSync(
  path.join(OUT_DIR, 'package.json'),
  JSON.stringify({ type: 'commonjs' }) + '\n'
);
console.log('  wrote dist/server/package.json');

// SQL migrations are read at runtime; tsc does not copy them.
copyDir(path.join(SRC_DIR, 'migrations'), path.join(OUT_DIR, 'migrations'));
