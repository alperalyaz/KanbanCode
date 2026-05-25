import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

const entrypointPath = require.resolve('@radix-ui/react-presence');
const packageRoot = dirname(dirname(entrypointPath));
const filesToCheck = ['dist/index.js', 'dist/index.mjs'];

const requiredMarkers = ['nodeCleanupGenerationRef', 'syncNode(null)'];
const missing = [];

for (const relativePath of filesToCheck) {
  const filePath = join(packageRoot, relativePath);
  const source = readFileSync(filePath, 'utf8');
  const missingMarkers = requiredMarkers.filter((marker) => !source.includes(marker));
  if (missingMarkers.length > 0) {
    missing.push(`${relativePath}: ${missingMarkers.join(', ')}`);
  }
}

if (missing.length > 0) {
  console.error(
    [
      '@radix-ui/react-presence is installed without the local React 19 Presence patch.',
      'Run `pnpm install --force` before building production artifacts.',
      '',
      ...missing,
    ].join('\n')
  );
  process.exit(1);
}
