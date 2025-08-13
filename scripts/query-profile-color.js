// Query a user's selected color from Supabase profiles by first and last name (ESM)
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://esiqdoxxbdaryblwzoye.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzaXFkb3h4YmRhcnlibHd6b3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NTc4NzAsImV4cCI6MjA3MDAzMzg3MH0.b9fhmG6IgWhdHB4kb64A0P5IVm8PP-GXgqfLzqYMS18'

const [, , firstName, lastName] = process.argv
if (!firstName || !lastName) {
  console.error('Usage: node scripts/query-profile-color.js <FirstName> <LastName>')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Try exact (case-sensitive) first, then case-insensitive
let colorRow = null
try {
  const { data } = await supabase
    .from('profiles')
    .select('user_id, username, first_name, last_name, color')
    .eq('first_name', firstName)
    .eq('last_name', lastName)
    .limit(1)
    .single()
  if (data) colorRow = data
} catch {}

if (!colorRow) {
  const { data } = await supabase
    .from('profiles')
    .select('user_id, username, first_name, last_name, color')
    .ilike('first_name', firstName)
    .ilike('last_name', lastName)
    .limit(1)
  if (Array.isArray(data) && data.length > 0) colorRow = data[0]
}

if (!colorRow) {
  console.log('NOT_FOUND')
  process.exit(0)
}

console.log(colorRow.color || 'NO_COLOR')


