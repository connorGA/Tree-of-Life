import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Atomically increment the seed_value in the tree_growth table,
 * then return the new value.
 *
 * Table schema expected:
 *   tree_growth (
 *     id          uuid primary key default gen_random_uuid(),
 *     seed_value  int8 not null default 1,
 *     last_growth timestamptz not null default now()
 *   )
 *
 * If the table is empty, an initial row is inserted with seed_value = 1.
 * On any network / auth error a fallback seed value is returned so the
 * tree still renders.
 *
 * @returns {Promise<number>} the new seed value (= visit count)
 */
export async function incrementAndGetSeedValue() {
  try {
    // Fetch the single row
    const { data: rows, error: fetchError } = await supabase
      .from('tree_growth')
      .select('id, seed_value')
      .limit(1)

    if (fetchError) throw fetchError

    if (!rows || rows.length === 0) {
      // First ever visit — insert the initial row
      const { data: inserted, error: insertError } = await supabase
        .from('tree_growth')
        .insert({ seed_value: 1, last_growth: new Date().toISOString() })
        .select('seed_value')
        .single()

      if (insertError) throw insertError
      return inserted.seed_value
    }

    // Row exists — increment
    const row = rows[0]
    const newValue = row.seed_value + 1

    const { data: updated, error: updateError } = await supabase
      .from('tree_growth')
      .update({
        seed_value: newValue,
        last_growth: new Date().toISOString()
      })
      .eq('id', row.id)
      .select('seed_value')
      .single()

    if (updateError) throw updateError
    return updated.seed_value

  } catch (err) {
    console.warn('[Tree of Life] Supabase unavailable, using fallback seed:', err.message)
    // Fallback — still renders a meaningful tree
    return 42
  }
}
