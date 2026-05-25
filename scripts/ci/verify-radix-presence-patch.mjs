import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

const filesToCheck = ['dist/index.js', 'dist/index.mjs'];
const patchChecks = [
  {
    packageName: '@radix-ui/react-presence',
    requiredMarkers: ['nodeCleanupGenerationRef', 'syncNode(null)'],
  },
  {
    packageName: '@radix-ui/react-focus-scope',
    resolverFromPackage: '@radix-ui/react-dialog',
    requiredMarkers: ['containerCleanupGenerationRef', 'syncContainer(null)'],
  },
  {
    packageName: '@radix-ui/react-dismissable-layer',
    resolverFromPackage: '@radix-ui/react-dialog',
    requiredMarkers: ['nodeCleanupGenerationRef', 'syncNode(null)'],
  },
];

function resolvePackageRoot({ packageName, resolverFromPackage }) {
  const packageRequire = resolverFromPackage
    ? createRequire(require.resolve(resolverFromPackage))
    : require;
  const entrypointPath = packageRequire.resolve(packageName);
  return dirname(dirname(entrypointPath));
}

const missing = [];

for (const check of patchChecks) {
  const packageRoot = resolvePackageRoot(check);

  for (const relativePath of filesToCheck) {
    const filePath = join(packageRoot, relativePath);
    const source = readFileSync(filePath, 'utf8');
    const missingMarkers = check.requiredMarkers.filter((marker) => !source.includes(marker));
    if (missingMarkers.length > 0) {
      missing.push(`${check.packageName}/${relativePath}: ${missingMarkers.join(', ')}`);
    }
  }
}

if (missing.length > 0) {
  console.error(
    [
      'Radix is installed without one or more local React 19 ref-cleanup patches.',
      'Run `pnpm install --force` before building production artifacts.',
      '',
      ...missing,
    ].join('\n')
  );
  process.exit(1);
}
