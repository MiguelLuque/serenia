export function patientDisplayName(profile: { display_name?: string | null; informal_name?: string | null } | null | undefined): string | null {
  return profile?.display_name?.trim() || profile?.informal_name?.trim() || null
}
