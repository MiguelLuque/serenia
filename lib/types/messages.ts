import { z } from 'zod'

export const TextPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
})

export const QuestionnaireOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
})

export const QuestionnaireItemRenderSchema = z.object({
  itemId: z.string(),
  prompt: z.string(),
  responseType: z.enum(['single_choice', 'yes_no']),
  options: z.array(QuestionnaireOptionSchema),
})

export const QuestionnaireRenderPartSchema = z.object({
  type: z.literal('questionnaire_render'),
  instanceId: z.string(),
  code: z.string(),
  title: z.string(),
  description: z.string(),
  items: z.array(QuestionnaireItemRenderSchema),
  submitLabel: z.string(),
})

export const QuestionnaireResultPartSchema = z.object({
  type: z.literal('questionnaire_result'),
  instanceId: z.string(),
  code: z.string(),
  totalScore: z.number(),
  severityBand: z.string(),
  summary: z.string(),
  flags: z.array(z.string()),
})

export const CrisisResourceSchema = z.object({
  name: z.string(),
  number: z.string(),
  description: z.string(),
})

export const RiskAlertPartSchema = z.object({
  type: z.literal('risk_alert'),
  severity: z.enum(['low', 'moderate', 'high', 'critical']),
  resources: z.array(CrisisResourceSchema),
  protocolScript: z.string(),
  requiresAcknowledgement: z.literal(true),
})

export const ToolInvocationPartSchema = z.object({
  type: z.literal('tool_invocation'),
  toolName: z.string(),
  state: z.enum(['pending', 'result', 'error']),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
})

export const MessagePartSchema = z.discriminatedUnion('type', [
  TextPartSchema,
  QuestionnaireRenderPartSchema,
  QuestionnaireResultPartSchema,
  RiskAlertPartSchema,
  ToolInvocationPartSchema,
])

export type MessagePart = z.infer<typeof MessagePartSchema>
export type TextPart = z.infer<typeof TextPartSchema>
export type QuestionnaireRenderPart = z.infer<typeof QuestionnaireRenderPartSchema>
export type QuestionnaireResultPart = z.infer<typeof QuestionnaireResultPartSchema>
export type RiskAlertPart = z.infer<typeof RiskAlertPartSchema>
export type ToolInvocationPart = z.infer<typeof ToolInvocationPartSchema>
export type CrisisResource = z.infer<typeof CrisisResourceSchema>

export const ES_CRISIS_RESOURCES: CrisisResource[] = [
  {
    name: 'Línea de Atención a la Conducta Suicida',
    number: '024',
    description: 'Servicio público gratuito, disponible 24h. Atiende situaciones de crisis suicida.',
  },
  {
    name: 'Emergencias',
    number: '112',
    description: 'Servicios de emergencia generales.',
  },
]
