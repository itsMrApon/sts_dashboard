/**
 * An SDK client created on first use instead of at import. `next build` loads every route
 * module without runtime secrets (Docker has no .env), so a client built at import time
 * crashes the build. Call sites keep using the object as before.
 */
export function lazyClient<T extends object>(create: () => T): T {
  let client: T | null = null
  const get = () => (client ??= create())
  return new Proxy({} as T, {
    get(_target, prop) {
      const instance = get()
      const value = Reflect.get(instance, prop, instance)
      return typeof value === 'function' ? value.bind(instance) : value
    },
  })
}

/** Reads a required server env var, failing with a clear message at first use. */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}
