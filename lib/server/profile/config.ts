import 'server-only'
export function progressiveProfileEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env.FEATURE_PROGRESSIVE_PROFILE === 'on'
}
