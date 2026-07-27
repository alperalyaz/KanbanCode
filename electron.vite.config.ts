import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { realpathSync, readFileSync } from 'fs'
import { resolve } from 'path'
import type { Plugin } from 'vite'

// Read all production dependencies from package.json
// so they get bundled into the main process output.
// This avoids pnpm symlink issues with electron-builder's asar packaging.
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const prodDeps = Object.keys(pkg.dependencies || {})
const rendererDependencyEsbuildTarget = 'esnext'

// On Windows, PowerShell/`cd` can enter the repo with a different path casing
// than the filesystem canonical name (e.g. C:\kanbancode vs C:\KanbanCode).
// Vite's html-proxy map is case-sensitive, so pin roots to the real path.
function resolveCanonicalRoot(): string {
  try {
    return realpathSync(__dirname)
  } catch {
    return __dirname
  }
}

const repoRoot = resolveCanonicalRoot()

// Fastify and its plugins rely on runtime module resolution that breaks when bundled.
const runtimeExternalDeps = new Set([
  'agent-teams-controller',
  'ws',
  'fastify',
  '@fastify/cors',
  '@fastify/static',
])

const bundledDeps = prodDeps.filter(d => !runtimeExternalDeps.has(d))

// Rollup plugin: stub out native .node addon imports with empty modules.
// Some transitive deps use optional native bindings that can't be bundled,
// but they have pure JS fallbacks when the native module isn't available.
function nativeModuleStub(): Plugin {
  const STUB_ID = '\0native-stub'
  const NODE_MODULE_RE = /\.node(?:\?.*)?$/
  return {
    name: 'native-module-stub',
    enforce: 'pre',
    resolveId(source) {
      if (NODE_MODULE_RE.test(source)) return `${STUB_ID}:${source}`
      return null
    },
    load(id) {
      if (id.startsWith(STUB_ID) || NODE_MODULE_RE.test(id)) return 'export default {}'
      return null
    }
  }
}

const sourceMapSetting = process.env.AGENT_TEAMS_DISABLE_SOURCEMAPS === '1' ? false : 'hidden'

export default defineConfig({
  main: {
    root: repoRoot,
    plugins: [
      nativeModuleStub(),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        '@features': resolve(repoRoot, 'src/features'),
        '@main': resolve(repoRoot, 'src/main'),
        '@shared': resolve(repoRoot, 'src/shared'),
        '@preload': resolve(repoRoot, 'src/preload')
      }
    },
    build: {
      externalizeDeps: {
        exclude: bundledDeps
      },
      sourcemap: sourceMapSetting,
      outDir: 'dist-electron/main',
      rollupOptions: {
        input: {
          index: resolve(repoRoot, 'src/main/index.ts'),
          'team-fs-worker': resolve(repoRoot, 'src/main/workers/team-fs-worker.ts'),
          'task-change-worker': resolve(repoRoot, 'src/main/workers/task-change-worker.ts'),
          'team-data-worker': resolve(repoRoot, 'src/main/workers/team-data-worker.ts')
        },
        output: {
          // CJS format so bundled deps can use __dirname/require.
          // Use .cjs extension since package.json has "type": "module".
          format: 'cjs',
          entryFileNames: '[name].cjs',
          // Set UV_THREADPOOL_SIZE before any module code runs.
          // Must be in the banner because ESM→CJS hoists imports above top-level code.
          // On Windows, fs.watch({recursive:true}) occupies a UV pool thread per watcher;
          // with 3+ watchers + concurrent fs/DNS/spawn, the default 4 threads deadlock.
          banner: `if(!process.env.UV_THREADPOOL_SIZE){process.env.UV_THREADPOOL_SIZE='24'}`
        }
      }
    }
  },
  preload: {
    root: repoRoot,
    resolve: {
      alias: {
        '@features': resolve(repoRoot, 'src/features'),
        '@preload': resolve(repoRoot, 'src/preload'),
        '@shared': resolve(repoRoot, 'src/shared'),
        '@main': resolve(repoRoot, 'src/main')
      }
    },
    build: {
      outDir: 'dist-electron/preload',
      rollupOptions: {
        input: {
          index: resolve(repoRoot, 'src/preload/index.ts')
        },
        output: {
          format: 'cjs',
          entryFileNames: '[name].js'
        }
      }
    }
  },
  renderer: {
    root: resolve(repoRoot, 'src/renderer'),
    cacheDir: resolve(repoRoot, 'node_modules/.vite/electron-renderer'),
    optimizeDeps: {
      // Electron owns the renderer runtime, so dependency prebundling can keep modern syntax.
      // This avoids esbuild trying to downlevel large ESM deps like Radix/CodeMirror.
      esbuildOptions: {
        target: rendererDependencyEsbuildTarget,
      },
      include: ['@codemirror/language-data'],
      exclude: [
        '@claude-teams/agent-graph',
      ]
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        '@features': resolve(repoRoot, 'src/features'),
        '@renderer': resolve(repoRoot, 'src/renderer'),
        '@shared': resolve(repoRoot, 'src/shared'),
        '@main': resolve(repoRoot, 'src/main'),
        '@radix-ui/react-compose-refs': resolve(
          repoRoot,
          'src/renderer/vendor/radixComposeRefs.ts'
        ),
        '@claude-teams/agent-graph': resolve(repoRoot, 'packages/agent-graph/src/index.ts')
      }
    },
    plugins: [react()],
    build: {
      sourcemap: sourceMapSetting,
      rollupOptions: {
        input: {
          index: resolve(repoRoot, 'src/renderer/index.html')
        }
      }
    }
  }
})
