import { describe,it,expect,vi } from 'vitest'
import {questionnaireHarness} from '../helpers/questionnaire-harness'
let service:ReturnType<typeof questionnaireHarness>['service']
vi.mock('@/lib/server/supabase/server',()=>({createServiceRoleClient:()=>service}))
import {createInstance,submitAnswers} from '@/lib/server/questionnaires/service'
describe('questionnaire proposal to scoring contract (synthetic DB)',()=>{
  it.each([
    ['PHQ9',[2,2,1,2,1,2,1,1,0],'moderate',null],
    ['CSSRS',[0,0,0,0,0,1,1],'acute_risk','critical'],
  ] as const)('proposes and scores %s through authorized operations',async(code,values,band,risk)=>{
    const h=questionnaireHarness(code);service=h.service
    const instance=await createInstance(h.client,{userId:'user-1',sessionId:'session-1',conversationId:'conv-1',questionnaireCode:code,triggerReason:'Synthetic reason'})
    const result=await submitAnswers(h.client,{instanceId:instance.id,answers:h.answers([...values])})
    expect(result.severityBand).toBe(band)
    const scoringCall=service.rpc.mock.calls.find(([name])=>name==='submit_questionnaire_atomic')!
    expect(scoringCall[1].p_risk_severity).toBe(risk ?? undefined)
    if(code==='PHQ9'){expect(result.totalScore).toBe(12);expect(result.flags).toEqual([])}
    else expect(result.flags).toContainEqual({itemOrder:7,reason:'acute_risk'})
  })
})
