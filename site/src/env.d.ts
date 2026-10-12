declare namespace App {
  interface Locals {
    /** The page's main applet; `<Quiz schaltetFrei>` unlocks it. */
    applet?: string
    /** The course the page belongs to (its links, its notebook). */
    course?: import('./courses').Course
  }
}

// Lets plain `tsc` resolve .astro imports (astro check does not support TypeScript 7 yet).
declare module '*.astro' {
  const Component: (props: Record<string, unknown>) => unknown
  export default Component
}
