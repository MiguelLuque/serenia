import { loadPromptFromMarkdown } from './loader'

export function getSessionTherapistPrompt(): string {
  return loadPromptFromMarkdown('docs/agents/prompts/session-therapist.md')
}
