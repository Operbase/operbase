/**
 * Node / some Vitest environments expose a broken `localStorage` (e.g. `clear` missing).
 * Install a full in-memory Storage for tests that touch onboarding drafts.
 */
export function installMemoryLocalStorage(): void {
  const store: Record<string, string> = {}
  const ls: Storage = {
    get length() {
      return Object.keys(store).length
    },
    clear() {
      for (const k of Object.keys(store)) delete store[k]
    },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null
    },
    key(index: number) {
      const keys = Object.keys(store)
      return keys[index] ?? null
    },
    removeItem(key: string) {
      delete store[key]
    },
    setItem(key: string, value: string) {
      store[key] = value
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: ls,
    configurable: true,
    writable: true,
  })
}
