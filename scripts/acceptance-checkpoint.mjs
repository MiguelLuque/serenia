import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { hydrateWorkflowArguments } from '@workflow/core/serialization'

/** Return a finalized retry only for the actor's recorded database job/run. */
export function findIntendedRetry(events, actor, job, input) {
  if(!job?.run_id||!job.token||job.session_id!==actor.sessionId||input?.[0]?.sessionId!==actor.sessionId||input?.[0]?.jobToken!==job.token)return null
  return events.find(({event})=>event.runId===job.run_id&&event.eventType==='step_retrying')??null
}
export function intendedEvents(directory,runId) {
  if(!/^wrun_[A-Za-z0-9_-]+$/.test(runId))throw new Error('Invalid recorded run identity')
  const folder=resolve(directory,'workflow/events');if(!existsSync(folder))return []
  return readdirSync(folder).filter(name=>name.startsWith(runId+'-')&&name.endsWith('.json')).map(name=>({name,event:JSON.parse(readFileSync(resolve(folder,name),'utf8'))})).filter(row=>row.event.runId===runId)
}
export async function readBoundRun(directory,actor,job) {
  if(!job?.run_id||!/^wrun_[A-Za-z0-9_-]+$/.test(job.run_id)||job.session_id!==actor.sessionId)throw new Error('Actor job/run mismatch')
  const folder=resolve(directory,'workflow/runs');const files=readdirSync(folder).filter(name=>name===job.run_id+'.json'||(name.startsWith(job.run_id+'.')&&name.endsWith('.json')))
  if(files.length!==1)throw new Error('One finalized intended run required')
  const run=JSON.parse(readFileSync(resolve(folder,files[0]),'utf8'))
  if(run.runId!==job.run_id||!run.workflowName?.includes('generateAssessmentWorkflow')||run.input?.__type!=='Uint8Array')throw new Error('Unexpected intended workflow identity')
  const input=await hydrateWorkflowArguments(new Uint8Array(Buffer.from(run.input.data,'base64')),run.runId,undefined,globalThis)
  if(input?.[0]?.sessionId!==actor.sessionId||input?.[0]?.jobToken!==job.token)throw new Error('Intended workflow arguments mismatch')
  return {run,input}
}
