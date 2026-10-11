// Local-only maintenance. Explicit environment only; never loads .env.local.
import { createClient } from "@supabase/supabase-js"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { localOrigin } from "./acceptance-local.mjs"

export function promotionConfig(source: Record<string, string | undefined>) {
  const url = localOrigin(source.NEXT_PUBLIC_SUPABASE_URL, 54321)
  const secret = source.SUPABASE_SECRET_KEY || source.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("Explicit local service key required")
  return { url, secret }
}
export async function promoteLocal(email: string, source = process.env) {
  if (!email || !email.endsWith("@example.test")) throw new Error("Fictional @example.test actor required")
  const { url, secret } = promotionConfig(source)
  const client = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await client.auth.admin.listUsers()
  if (error) throw new Error("Local user lookup failed")
  const user = data.users.find(user => user.email === email)
  if (!user) throw new Error("Fictional local user not found")
  const update = await client.from("user_profiles").update({ role: "clinician" }).eq("user_id", user.id)
  if (update.error) throw new Error("Local promotion failed")
  console.log("Fictional local clinician promoted")
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  promoteLocal(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1 })
}
