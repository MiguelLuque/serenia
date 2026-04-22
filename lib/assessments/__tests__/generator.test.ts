import { describe, it, expect } from 'vitest'
import {
  AssessmentSchema,
  ProposedTaskSchema,
} from '@/lib/assessments/generator'

const baseSummary = {
  chief_complaint: 'Tristeza persistente',
  presenting_issues: ['ánimo bajo'],
  mood_affect: 'deprimido',
  cognitive_patterns: ['rumiación'],
  risk_assessment: {
    suicidality: 'none' as const,
    self_harm: 'none' as const,
    notes: '',
  },
  questionnaires: [],
  areas_for_exploration: ['antecedentes familiares'],
  preliminary_impression: 'Sintomatología consistente con ánimo bajo leve.',
  recommended_actions_for_clinician: ['seguimiento en 1 semana'],
  patient_facing_summary: 'Gracias por compartir esto hoy.',
}

describe('AssessmentSchema.proposed_tasks', () => {
  it('defaults proposed_tasks to [] for legacy rows that omit the field', () => {
    const parsed = AssessmentSchema.parse(baseSummary)
    expect(parsed.proposed_tasks).toEqual([])
  })

  it('preserves both proposed_tasks when present', () => {
    const withTasks = {
      ...baseSummary,
      proposed_tasks: [
        {
          descripcion: 'Salir a caminar 20 minutos tres veces por semana',
          nota: 'Propuesto por el paciente tras hablar de falta de energía',
        },
        {
          descripcion: 'Registrar pensamientos rumiativos en una libreta',
        },
      ],
    }

    const parsed = AssessmentSchema.parse(withTasks)

    expect(parsed.proposed_tasks).toHaveLength(2)
    expect(parsed.proposed_tasks[0]).toEqual({
      descripcion: 'Salir a caminar 20 minutos tres veces por semana',
      nota: 'Propuesto por el paciente tras hablar de falta de energía',
    })
    expect(parsed.proposed_tasks[1]).toEqual({
      descripcion: 'Registrar pensamientos rumiativos en una libreta',
    })
  })
})

describe('ProposedTaskSchema', () => {
  it('rejects descripcion shorter than 3 chars', () => {
    const result = ProposedTaskSchema.safeParse({ descripcion: 'ok' })
    expect(result.success).toBe(false)
  })

  it('rejects nota longer than 300 chars', () => {
    const result = ProposedTaskSchema.safeParse({
      descripcion: 'valid task description',
      nota: 'x'.repeat(301),
    })
    expect(result.success).toBe(false)
  })
})
