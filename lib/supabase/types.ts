// Placeholder until `npx supabase gen types typescript --linked > lib/supabase/types.ts`
// is run (blocked on `supabase link --project-ref <ref>`; see Task 15).
export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
