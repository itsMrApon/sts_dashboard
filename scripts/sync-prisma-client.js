/**
 * pnpm generates Prisma into the package store. Next often resolves
 * `node_modules/.prisma/client` from the project root instead — keep that
 * path pointed at the generated client so model renames are visible.
 */
const fs = require('fs')
const path = require('path')
const Module = require('module')

const root = path.join(__dirname, '..')
const destDir = path.join(root, 'node_modules', '.prisma')
const dest = path.join(destDir, 'client')

let generated
try {
  const clientEntry = require.resolve('@prisma/client', { paths: [root] })
  generated = path.dirname(
    require.resolve('.prisma/client/package.json', { paths: [path.dirname(clientEntry)] }),
  )
} catch (error) {
  console.warn('[sync-prisma-client] skip:', error.message)
  process.exit(0)
}

// npm (and Docker's `npm ci`) already generates into node_modules/.prisma/client. Removing it and
// linking it to itself would delete the generated client, so there is nothing to do.
if (path.resolve(generated) === path.resolve(dest)) {
  console.log('[sync-prisma-client] already at', dest)
  process.exit(0)
}

fs.mkdirSync(destDir, { recursive: true })

try {
  const existing = fs.lstatSync(dest)
  if (existing.isSymbolicLink() || existing.isDirectory() || existing.isFile()) {
    fs.rmSync(dest, { recursive: true, force: true })
  }
} catch {
  // nothing to remove
}

const rel = path.relative(destDir, generated)
fs.symlinkSync(rel, dest, 'dir')
console.log('[sync-prisma-client]', dest, '->', generated)
