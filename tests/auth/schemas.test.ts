import { describe, it, expect } from 'vitest'
import { RegisterSchema, LoginSchema } from '@/lib/auth/schemas'

describe('RegisterSchema', () => {
  it('acepta email y password válidos', () => {
    const r = RegisterSchema.safeParse({ email: 'a@b.com', password: 'Abcdef12', consent: true })
    expect(r.success).toBe(true)
  })
  it('rechaza password corta', () => {
    const r = RegisterSchema.safeParse({ email: 'a@b.com', password: 'Abc1', consent: true })
    expect(r.success).toBe(false)
  })
  it('exige consent=true', () => {
    const r = RegisterSchema.safeParse({ email: 'a@b.com', password: 'Abcdef12', consent: false })
    expect(r.success).toBe(false)
  })
})

describe('LoginSchema', () => {
  it('acepta email y password no vacíos', () => {
    expect(LoginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true)
  })
})

