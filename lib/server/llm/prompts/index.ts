import { loadPromptFromMarkdown } from './loader'
import { clinicalPilotEnabled } from '../clinical-pilot'

export function getSessionTherapistPrompt(): string {
  return loadPromptFromMarkdown(clinicalPilotEnabled()
    ? 'docs/agents/prompts/session-therapist.pilot.md'
    : 'docs/agents/prompts/session-therapist.md')
}

export function getClinicalReportPrompt(): string {
  return loadPromptFromMarkdown(clinicalPilotEnabled()
    ? 'docs/agents/prompts/clinical-report.pilot.md'
    : 'docs/agents/prompts/clinical-report.md')
}
