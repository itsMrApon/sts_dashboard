// Bundles the Inngest worker (src/inngest/worker.ts) into dist/jobs-worker.cjs. Only sts-ai's own
// code is bundled (with its @/ paths); packages stay in node_modules, which the app image has.
// Run it with: node --conditions=react-server dist/jobs-worker.cjs
import { build } from 'esbuild'

await build({
  entryPoints: ['src/inngest/worker.ts'],
  outfile: 'dist/jobs-worker.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  packages: 'external',
  // Shared lib files import 'server-only'; this condition makes it a no-op, as in trigger.config.ts.
  conditions: ['react-server'],
  tsconfig: 'tsconfig.json',
  sourcemap: true,
  logLevel: 'info',
})
