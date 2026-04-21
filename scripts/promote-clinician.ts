// Uso: npx dotenv -e .env.local -- npx tsx scripts/promote-clinician.ts <email>
import { createClient } from '@supabase/supabase-js'

const email = process.argv[2]
if (!email) {
  console.error('Uso: promote-clinician.ts <email>')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const { data: users, error: listErr } = await supabase.auth.admin.listUsers()
if (listErr) {
  console.error(listErr)
  process.exit(1)
}
const match = users.users.find((u) => u.email === email)
if (!match) {
  console.error(`No hay usuario con email ${email}`)
  process.exit(1)
}

const { error } = await supabase
  .from('user_profiles')
  .update({ role: 'clinician' })
  .eq('user_id', match.id)

if (error) {
  console.error(error)
  process.exit(1)
}
console.log(`Usuario ${email} promovido a clinician`)
