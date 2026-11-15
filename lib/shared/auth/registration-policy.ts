type RegistrationEnvironment = Record<string, string | undefined>

export function isPublicRegistrationEnabled(
  env: RegistrationEnvironment = process.env,
): boolean {
  const override = env.FEATURE_PUBLIC_REGISTRATION?.trim().toLowerCase()
  if (override === 'on') return true
  if (override === 'off') return false

  if (env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview') return false
  if (env.VERCEL_ENV === 'development') return true

  return env.NODE_ENV !== 'production'
}
