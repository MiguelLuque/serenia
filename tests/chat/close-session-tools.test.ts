import { describe, expect, it } from 'vitest'
import { chatHarness } from '../helpers/chat-harness'
describe('persistent proposal + explicit next-turn acceptance', () => {
  it('cannot confirm without a persistent prior proposal even if text says Yes', async()=>{
    const h=await chatHarness(); let result:unknown
    h.state.hook=async opts=>{result=await opts.tools.confirm_close_session.execute({reason:'user_request'})}
    expect((await h.post('Sí')).status).toBe(200)
    expect(result).toMatchObject({closed:false})
    expect(h.state.session.status).toBe('open')
  })
  it('persists proposal with assistant, requires same reason and explicit next turn', async()=>{
    const h=await chatHarness()
    h.state.hook=async opts=>{await opts.tools.propose_close_session.execute({reason:'user_request'})}
    await h.post('Quiero acabar','proposal')
    expect(h.state.proposal).toEqual({requestId:'proposal',reason:'user_request'})
    let result:unknown
    h.state.hook=async opts=>{result=await opts.tools.confirm_close_session.execute({reason:'time_limit'})}
    await h.post('Sí','different')
    expect(result).toMatchObject({closed:false})
    expect(h.state.session.status).toBe('open')
    h.state.hook=async opts=>{await opts.tools.propose_close_session.execute({reason:'user_request'})}
    await h.post('Propón cierre','proposal2')
    h.state.hook=async opts=>{result=await opts.tools.confirm_close_session.execute({reason:'user_request'})}
    await h.post('De acuerdo','accepted')
    expect(result).toMatchObject({closed:true})
    expect(h.state.session.status).toBe('closed')
    expect(h.state.writes.find(w=>w.name==='finish_chat_turn'&&w.args.p_request_id==='accepted').args.p_close_reason).toBe('user_request')
  })
  it('does not consent on a question or a negated response', async()=>{
    for(const text of ['¿Cerramos?','No quiero cerrar','Sí pero no quiero cerrar']) {
      const h=await chatHarness()
      h.state.hook=async opts=>{await opts.tools.propose_close_session.execute({reason:'user_request'})}
      await h.post('Propón cierre','proposal')
      h.state.hook=async opts=>{expect(await opts.tools.confirm_close_session.execute({reason:'user_request'})).toMatchObject({closed:false})}
      await h.post(text,'answer')
      expect(h.state.session.status).toBe('open')
    }
  })
  it('allows a registered crisis to close without acceptance',async()=>{
    const h=await chatHarness()
    h.state.hook=async opts=>{expect(await opts.tools.close_session_crisis.execute({})).toMatchObject({closed:true})}
    // A registered low-signal crisis still reaches the existing closure tool.
    await h.post('Quiero desaparecer para siempre')
    expect(h.state.writes.find(w=>w.name==='finish_chat_turn').args.p_close_reason).toBe('crisis_detected')
  })
})
