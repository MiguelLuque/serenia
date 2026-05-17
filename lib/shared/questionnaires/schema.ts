import { z } from 'zod'

// Plan 8 Bloque 2 Fix 4 — schema validador para POST
// /api/questionnaires/[instanceId]/answers.
//
// ADR-019: el schema vive en `lib/` (puro, sin dependencias de Next/Supabase)
// y `app/api/.../answers/route.ts` lo consume. Antes el handler sólo
// chequeaba `Array.isArray(body.answers)`, así que un cliente podía enviar
// `[{itemOrder: "abc", valueNumeric: null, valueRaw: undefined}]` y el
// payload llegaba sin filtrado al insert de Supabase, donde la propagación
// del error técnico se devolvía crudo al cliente filtrando detalle.
//
// Las cotas (max items=50, max valueNumeric=10, max valueRaw chars=200) son
// holguras razonables para los cuestionarios actuales (PHQ-9 / GAD-7 / BDI-II
// / BAI ≤ 21 items con escala 0-3; C-SSRS 7 items con escala 0-1). Cualquier
// instrumento futuro con más items o escala más amplia ajustará el schema
// explícitamente — falla mejor con un 400 que con un INSERT raro.

export const AnswerSchema = z.object({
  itemOrder: z.number().int().min(1).max(50),
  valueNumeric: z.number().int().min(0).max(10),
  valueRaw: z.string().min(1).max(200),
})

export const SubmitAnswersSchema = z.object({
  answers: z.array(AnswerSchema).min(1).max(50),
})

export type SubmitAnswersInput = z.infer<typeof SubmitAnswersSchema>
