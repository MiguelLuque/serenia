import { describe,expect,it,vi } from 'vitest'
import {questionnaireHarness} from '../helpers/questionnaire-harness'
let service:ReturnType<typeof questionnaireHarness>['service']
vi.mock('@/lib/server/supabase/server',()=>({createServiceRoleClient:()=>service}))
import {createInstance,startInstance,getActiveInstanceForSession,submitAnswers} from '@/lib/server/questionnaires/service'
function setup(code:'PHQ9'|'GAD7'|'CSSRS'='PHQ9'){const h=questionnaireHarness(code);service=h.service;return h}
describe('authorized questionnaire service',()=>{
  it('creates with authenticated identity and both parent bounds through one RPC',async()=>{
    const h=setup(); const instance=await createInstance(h.client,{userId:'user-1',sessionId:'session-1',conversationId:'conv-1',questionnaireCode:'PHQ9',triggerReason:'Synthetic reason'})
    expect(instance.id).toBe('instance-1')
    expect(service.rpc).toHaveBeenCalledWith('create_questionnaire_atomic',{p_user_id:'user-1',p_session_id:'session-1',p_conversation_id:'conv-1',p_code:'PHQ9',p_reason:'Synthetic reason'})
  })
  it('rejects forged user, session owner and conversation before privileged effects',async()=>{
    for(const variant of ['identity','session','conversation']){
      const h=setup()
      if(variant==='session')h.state.session.user_id='foreign'
      if(variant==='conversation')h.state.parent.user_id='foreign'
      await expect(createInstance(h.client,{userId:variant==='identity'?'foreign':'user-1',sessionId:'session-1',conversationId:'conv-1',questionnaireCode:'CSSRS',triggerReason:'Synthetic reason'})).rejects.toThrow()
      expect(service.rpc).not.toHaveBeenCalled()
    }
  })
  it('propagates RPC failures without independent table writes',async()=>{
    const h=setup(); service.rpc.mockResolvedValue({data:null,error:new Error('RPC failed')} as never)
    await expect(createInstance(h.client,{userId:'user-1',sessionId:'session-1',conversationId:'conv-1',questionnaireCode:'PHQ9',triggerReason:'Synthetic reason'})).rejects.toThrow('RPC failed')
    expect(service.from).not.toHaveBeenCalled()
  })
  it('starts only an owned instance through an atomic server RPC',async()=>{
    const h=setup(); await startInstance(h.client,'instance-1')
    expect(service.rpc).toHaveBeenCalledWith('start_questionnaire_atomic',{p_instance_id:'instance-1',p_user_id:'user-1'})
  })
  it('does not classify a scored questionnaire as pending',async()=>{
    const h=setup(); await getActiveInstanceForSession(h.client,'session-1')
    const query=h.client.from.mock.results[0].value
    expect(query.in).toHaveBeenCalledWith('status',['proposed','in_progress'])
  })
  it.each([
    ['PHQ9',[2,2,2,2,2,2,1,2,0],15,'moderately_severe',null],
    ['PHQ9',[2,2,2,2,2,2,1,2,2],17,'moderately_severe','high'],
    ['CSSRS',[0,0,0,0,0,1,1],1,'acute_risk','critical'],
    ['CSSRS',[0,1,0,1,0,0,0],4,'high_risk','high'],
  ] as const)('preserves deterministic %s scoring/risk',async(code,values,total,band,risk)=>{
    const h=setup(code); const result=await submitAnswers(h.client,{instanceId:'instance-1',answers:h.answers([...values])})
    // CSSRS scorer returns its signed severity level; do not invent new cuts.
    expect(result.severityBand).toBe(band)
    if(code==='PHQ9')expect(result.totalScore).toBe(total)
    expect(service.rpc).toHaveBeenCalledTimes(1)
    expect(service.rpc.mock.calls[0][0]).toBe('submit_questionnaire_atomic')
    expect(service.rpc.mock.calls[0][1].p_result).toEqual(result)
    expect(service.rpc.mock.calls[0][1].p_risk_severity).toBe(risk)
    expect(service.from).not.toHaveBeenCalled()
  })
  it('validates the complete option set before any write and permits a correct retry',async()=>{
    const h=setup()
    for(const answers of [h.answers([1]),h.answers([0,0,0,0,0,0,0,0,9]),[...h.answers([0,0,0,0,0,0,0,0]),{itemOrder:8,valueNumeric:0,valueRaw:'0'}]]){
      await expect(submitAnswers(h.client,{instanceId:'instance-1',answers})).rejects.toThrow()
      expect(service.rpc).not.toHaveBeenCalled()
    }
    expect((await submitAnswers(h.client,{instanceId:'instance-1',answers:h.answers(Array(9).fill(0))})).totalScore).toBe(0)
  })
  it('rejects foreign and clinician-rated instances before scoring writes',async()=>{
    for(const foreign of [true,false]){
      const h=setup(); if(foreign)h.state.instance.user_id='foreign';else h.state.definition.is_clinician_rated=true
      await expect(submitAnswers(h.client,{instanceId:'instance-1',answers:h.answers(Array(9).fill(0))})).rejects.toThrow()
      expect(service.rpc).not.toHaveBeenCalled()
    }
  })
})
