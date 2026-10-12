/** The platform; its courses are in courses.ts. */
export const platform = {
  name: 'abacus',
}

/** Base-path-aware link, so the site works under a sub-path on the server. */
export function url(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${base}/${path.replace(/^\//, '')}`
}

/** A link inside a course: courseUrl(course, '/quiz') → /<base>/<course>/quiz. */
export const courseUrl = (course: { id: string }, path = '/'): string => url(`/${course.id}/${path.replace(/^\//, '')}`)
