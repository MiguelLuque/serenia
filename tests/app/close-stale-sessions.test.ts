/* eslint-disable @typescript-eslint/no-explicit-any -- database doubles */
import { describe,expect,it,vi,beforeEach,afterEach } from 'vitest'
const {createServiceRoleClient,dispatchAssessmentJob}=vi.hoisted(()=>({createServiceRoleClient:vi.fn(),dispatchAssessmentJob:vi.fn()}))
vi.mock('@/lib/server/supabase/server',()=>({createServiceRoleClient}))
vi.mock('@/lib/server/workflows',()=>({dispatchAssessmentJob,enqueueAssessmentGeneration:vi.fn()}))
import {POST,GET} from '@/app/api/internal/close-stale-sessions/route'
const previous=process.env.CRON_SECRET
let rows:any[],jobs:any[],query:any,rpc:ReturnType<typeof vi.fn>
beforeEach(()=>{
  process.env.CRON_SECRET='synthetic-secret';rows=[];jobs=[]
  query={};for(const method of ['select','eq','lt','order','limit'])query[method]=vi.fn(()=>query)
  query.then=(resolve:any,reject:any)=>Promise.resolve({data:rows,error:null}).then(resolve,reject)
  rpc=vi.fn(async(name:string)=>({data:name==='claim_assessment_jobs'?jobs:null,error:null}))
  createServiceRoleClient.mockReturnValue({from:vi.fn(()=>query),rpc})
  dispatchAssessmentJob.mockReset().mockResolvedValue({runId:'synthetic-run'})
})
afterEach(()=>{process.env.CRON_SECRET=previous})
const request=(authorized=true)=>new Request('http://localhost/api/internal/close-stale-sessions',{method:'POST',headers:authorized?{authorization:'Bearer synthetic-secret'}:{}})
describe('bounded authorized closure and recovery sweep',()=>{
  it('accepts the correct secret without a browser cookie',async()=>{expect((await POST(request())).status).toBe(200)})
  it('rejects missing, invalid and unconfigured secrets before service-role creation',async()=>{
    createServiceRoleClient.mockClear()
    expect((await POST(request(false))).status).toBe(401)
    expect((await POST(new Request('http://localhost',{headers:{authorization:'Bearer wrong'}}))).status).toBe(401)
    delete process.env.CRON_SECRET
    expect((await POST(request())).status).toBe(401)
    expect(createServiceRoleClient).not.toHaveBeenCalled()
  })
  it('closes through the same atomic RPC and separately claims recovery jobs',async()=>{
    rows=[{id:'stale',user_id:'owner'}];jobs=[{session_id:'stale',token:'lease'}]
    expect(await (await POST(request())).json()).toEqual({ok:true,closed:1,enqueued:1,failed:0})
    expect(rpc).toHaveBeenCalledWith('close_session_atomic',{p_session_id:'stale',p_user_id:'owner',p_reason:'inactivity'})
    expect(rpc).toHaveBeenCalledWith('recover_assessment_jobs',{p_limit:10})
    expect(query.limit).toHaveBeenCalledWith(10)
  })
  it('recovers closed sessions even when the stale-open query is empty',async()=>{
    jobs=[{session_id:'closed-from-failed-enqueue',token:'lease'}]
    const res=await POST(request());expect(await res.json()).toMatchObject({closed:0,enqueued:1})
    expect(dispatchAssessmentJob).toHaveBeenCalledWith(jobs[0])
  })
  it('reports partial enqueue failure and continues the bounded batch',async()=>{
    jobs=[{session_id:'one',token:'a'},{session_id:'two',token:'b'}]
    dispatchAssessmentJob.mockRejectedValueOnce(new Error('synthetic failure'))
    expect(await (await POST(request())).json()).toMatchObject({enqueued:1,failed:1})
  })
  it('never has more than two enqueue calls in flight',async()=>{
    jobs=Array.from({length:10},(_,i)=>({session_id:String(i),token:'lease'}))
    let active=0,max=0
    dispatchAssessmentJob.mockImplementation(async()=>{active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,2));active--;return{runId:'run'}})
    expect(await (await POST(request())).json()).toMatchObject({enqueued:10})
    expect(max).toBe(2)
  })
  it('does not start workflows without an outbox claim',async()=>{
    expect(await (await POST(request())).json()).toMatchObject({enqueued:0})
    expect(dispatchAssessmentJob).not.toHaveBeenCalled()
  })
  it('returns an observable error on failed SQL recovery',async()=>{
    rpc.mockResolvedValue({data:null,error:{code:'XX000'}})
    expect((await POST(request())).status).toBe(503)
    expect(dispatchAssessmentJob).not.toHaveBeenCalled()
  })
  it('supports GET cron with the same independent secret authentication',async()=>{
    expect((await GET(request())).status).toBe(200)
    expect((await GET(request(false))).status).toBe(401)
  })
})
