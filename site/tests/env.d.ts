// What Vite (vitest) provides on import.meta, for the type check of the site tests.
interface ImportMeta {
  readonly env: { readonly DEV: boolean; readonly [key: string]: unknown }
  glob(pattern: string, options: { query: '?raw'; import: 'default'; eager: true }): Record<string, string>
}
