/* eslint-disable @typescript-eslint/no-explicit-any -- database test double */
import { vi } from 'vitest'
import type { QuestionnaireCode } from '@/lib/shared/questionnaires/registry'
export function questionnaireHarness(code: QuestionnaireCode = 'PHQ9') {
  const state = {
    user: { id:'user-1' } as {id:string}|null,
    session: {id:'session-1',user_id:'user-1',conversation_id:'conv-1',status:'open'},
    parent: {id:'conv-1',user_id:'user-1'},
    instance: {id:'instance-1',user_id:'user-1',session_id:'session-1',conversation_id:'conv-1',questionnaire_id:'definition',status:'proposed'},
    definition: {id:'definition',code,is_clinician_rated:false},
    items: Array.from({length:code==='CSSRS'?7:code==='GAD7'?7:9},(_,i)=>({id:`item-${i+1}`,questionnaire_id:'definition',order_index:i+1,options_json:(code==='CSSRS'?[0,1]:[0,1,2,3]).map(value=>({value,label:code==='CSSRS'?(value?'Sí':'No'):String(value)}))})),
    queryError:null as unknown,
  }
  const client:any={auth:{getUser:vi.fn(async()=>({data:{user:state.user},error:null}))},from:vi.fn((table:string)=>{
    const q:any={}; for(const method of ['select','eq','in','order','limit','single','maybeSingle']) q[method]=vi.fn(()=>q)
    q.then=(resolve:any,reject:any)=>Promise.resolve({data:table==='questionnaire_instances'?state.instance:table==='questionnaire_definitions'?state.definition:table==='questionnaire_items'?state.items:table==='clinical_sessions'?state.session:table==='conversations'?state.parent:null,error:state.queryError}).then(resolve,reject)
    return q
  })}
  const service={rpc:vi.fn(async(name:string,_args:any)=>{void _args; return {data:name==='create_questionnaire_atomic'?state.instance:null,error:null}}),from:vi.fn()}
  const answers=(values:number[])=>values.map((valueNumeric,i)=>({itemOrder:i+1,valueNumeric,valueRaw:String(valueNumeric)}))
  return {state,client,service,answers}
}
