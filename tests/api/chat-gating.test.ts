import { expect, it } from 'vitest'
import { chatHarness } from '../helpers/chat-harness'
it('chat blocks a patient without current adult acceptance before any admission or model call', async () => {
 const { state,post }=await chatHarness(); state.onboardingReady=false
 const response=await post('Hola','no-acceptance')
 expect(response.status).toBe(403); expect(await response.json()).toMatchObject({ onboardingRequired:true })
 expect(state.rows).toHaveLength(0); expect(state.captured).toHaveLength(0)
})
