/**
 * PostgREST returns a single object for a many-to-one embed, but without
 * generated database types the JS client widens it to an array. This narrows
 * it back so call sites can just read the relation.
 *
 * Once the Supabase CLI is linked, `supabase gen types typescript` replaces
 * the need for this.
 */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}
