import { expect, it } from 'vitest'
import { validateArguments } from '../../scripts/supabase-local.mjs'

it('allows pending migrations to be applied only to the local Supabase database', () => {
  expect(() => validateArguments(['migration', 'up', '--local'])).not.toThrow()
  expect(() => validateArguments(['migration', 'up'])).toThrow(/requires --local/)
  expect(() => validateArguments(['migration', 'up', '--linked'])).toThrow(/Unknown or duplicated CLI option/)
  expect(() => validateArguments(['migration', 'up', '--local=true'])).toThrow(/Boolean local\/help flags must be bare/)
})
