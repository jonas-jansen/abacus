/**
 * Who sees which course on the landing page. The site is static and has no login yet, so for
 * now everyone sees every course: `mine()` answers null.
 *
 * Later, behind Shibboleth (docs/deployment.md), a small endpoint can answer for the visitor:
 * their courses from ILIAS membership, or the courses they joined on the platform. Replace
 * `courseAccess` with an implementation that fetches it, e.g.
 *
 *   mine: async () => (await fetch(url('/api/courses/mine'))).json(),
 *   join: async (id) => { await fetch(url(`/api/courses/${id}/join`), { method: 'POST' }) },
 *
 * The landing page then shows the visitor's courses first and the others under "Weitere
 * Kurse", with a button to join when `join` exists. No page needs to change for that.
 */

export interface CourseAccess {
  /** The ids of the visitor's courses; null when every course is shown to everyone. */
  mine(): Promise<string[] | null>
  /** Joins a course (self-registration); left out while there is none. */
  join?(id: string): Promise<void>
}

export const courseAccess: CourseAccess = {
  mine: async () => null,
}
