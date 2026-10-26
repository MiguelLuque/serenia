import { loadPromptFromMarkdown } from './loader'
import { clinicalPilotEnabled } from '../clinical-pilot'

export function getSessionTherapistPrompt(userId?: string): string {
  return loadPromptFromMarkdown(clinicalPilotEnabled(process.env, userId)
    ? 'docs/agents/prompts/session-therapist.pilot.md'
    : 'docs/agents/prompts/session-therapist.md')
}

export function getClinicalReportPrompt(userId?: string): string {
  return loadPromptFromMarkdown(clinicalPilotEnabled(process.env, userId)
    ? 'docs/agents/prompts/clinical-report.pilot.md'
    : 'docs/agents/prompts/clinical-report.md')
}
