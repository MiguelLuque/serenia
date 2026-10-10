import { describe, expect, it } from 'vitest'
import { chatHarness } from '../helpers/chat-harness'
describe('safety notices and final input precedence',()=>{
  it.each([
    [{kind:'cssrs_negative'},'C-SSRS NEGATIVO YA APLICADO'],
    [{kind:'cssrs_pending'},'C-SSRS PROPUESTO PENDIENTE'],
    [{kind:'cssrs_acute_risk',behaviorRecent:false},'RIESGO AGUDO'],
    [{kind:'cssrs_acute_risk',behaviorRecent:true},'CONDUCTA RECIENTE'],
  ])('preserves safety variant %j',async(safety,label)=>{
    const h=await chatHarness(); h.state.safety=safety as never
    expect((await h.post('Hoy me siento mejor')).status).toBe(200)
    expect(h.state.captured[0].system).toContain(label)
  })
  it('does not suppress a new explicit crisis while CSSRS is pending',async()=>{
    const h=await chatHarness(); h.state.safety={kind:'cssrs_pending',proposedAt:new Date().toISOString()}
    expect((await h.post('Quiero matarme esta noche')).status).toBe(200)
    expect(h.state.captured[0].system).toContain('RE-ESCALADA')
    expect(h.state.captured[0].system).not.toContain('C-SSRS PROPUESTO PENDIENTE')
    expect(h.state.writes[0].args.p_crisis).toBe(true)
  })
  it('keeps negative-screen emotional vocabulary without re-escalation; reopens on a new specific signal',async()=>{
    const h=await chatHarness(); h.state.safety={kind:'cssrs_negative',scoredAt:new Date().toISOString()}
    await h.post('Estoy desbordado','neutral')
    expect(h.state.captured[0].system).not.toContain('RE-ESCALADA')
    await h.post('Voy a quitarme la vida esta noche','signal')
    expect(h.state.captured[1].system).toContain('RE-ESCALADA')
  })
  it('serves and replays a persisted urgent turn without another LLM call or automatic early closure',async()=>{
    const h=await chatHarness(); h.state.urgentReply=true; h.state.persistFailures=1
    expect((await h.post('Quiero matarme esta noche')).status).toBe(503)
    const response=await h.post('Quiero matarme esta noche')
    expect(response.status).toBe(200); expect(await response.text()).toContain('024')
    expect((await h.post('Quiero matarme esta noche')).status).toBe(200)
    expect(h.state.captured).toHaveLength(0)
    expect(h.state.session.status).toBe('open')
    expect(h.state.rows.filter(row=>row.role==='assistant')).toHaveLength(1)
    expect(h.state.writes.find(w=>w.name==='begin_chat_turn').args.p_urgent).toBe(true)
  })
  it('records crisis before a hard time limit and responds with safety resources',async()=>{
    const h=await chatHarness(); h.state.session.opened_at=new Date(Date.now()-61*60*1000).toISOString()
    const response=await h.post('Quiero matarme esta noche')
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('024')
    expect(h.state.rows[0].parts[0].text).toContain('matarme')
    expect(h.state.writes.find(w=>w.name==='finish_chat_turn').args.p_close_reason).toBe('crisis_detected')
    expect(h.state.captured).toHaveLength(0)
  })
  it('does not silently drop early context; crisis has a deterministic safe response even over budget',async()=>{
    const h=await chatHarness(); h.state.rows.push({id:'early',role:'user',parts:[{type:'text',text:'x'.repeat(80001)}]})
    expect((await h.post()).status).toBe(503)
    // Resolve the pending failed turn with the same ID in a fresh bounded fixture.
    const crisis=await chatHarness(); crisis.state.rows.push(...h.state.rows.slice(0,1))
    const response=await crisis.post('Voy a matarme')
    expect(response.status).toBe(200); expect(await response.text()).toContain('024')
    expect(crisis.state.captured).toHaveLength(0)
  })
})
