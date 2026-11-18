/**
 * The age-group rule, mirroring age_fits_session() in the database.
 *
 * Anyone 12 or under on the day of the session trains in kids classes only;
 * anyone 13 or over cannot join one. A kids class is one whose upper age
 * limit is 12 or under.
 */

/** Whole years old on a given date. Both arguments are YYYY-MM-DD. */
export function ageOn(dob: string, on: string): number {
  const [by, bm, bd] = dob.split('-').map(Number)
  const [oy, om, od] = on.split('-').map(Number)
  let age = oy - by
  if (om < bm || (om === bm && od < bd)) age -= 1
  return age
}

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** A real date, not in the future and not absurdly old. */
export function validDob(dob: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false
  if (Number.isNaN(new Date(dob + 'T00:00:00').getTime())) return false
  return dob > '1920-01-01' && dob <= todayIso()
}

export const isKidsClass = (maxAge: number | null) => maxAge !== null && maxAge < 13

export const isKidOn = (dob: string, on: string) => ageOn(dob, on) < 13

export function fitsSession(dob: string, sessionDate: string, maxAge: number | null): boolean {
  return isKidOn(dob, sessionDate) === isKidsClass(maxAge)
}
