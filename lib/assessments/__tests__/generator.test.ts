import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  AssessmentGenerationSchema,
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
  recommended_actions_for_clinician: ['[SEGUIMIENTO] cita en 1 semana'],
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
          nota: null,
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
      nota: null,
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

describe('AssessmentSchema.risk_assessment legacy compatibility', () => {
  it('parses legacy rows missing heteroaggression and substance_use_acute (Plan 7 T4 defaults)', () => {
    // Simulates a row stored before T4 — risk_assessment only has the original
    // three keys (suicidality, self_harm, notes). This is the realistic shape
    // for Pacientes A/B/C/D rows in BD.
    const legacy = {
      ...baseSummary,
      risk_assessment: {
        suicidality: 'passive' as const,
        self_harm: 'historic' as const,
        notes: 'paciente verbaliza ganas de no estar',
      },
    }

    const parsed = AssessmentSchema.parse(legacy)

    expect(parsed.risk_assessment.suicidality).toBe('passive')
    expect(parsed.risk_assessment.self_harm).toBe('historic')
    expect(parsed.risk_assessment.heteroaggression).toBe('none')
    expect(parsed.risk_assessment.substance_use_acute).toBeNull()
    expect(parsed.risk_assessment.notes).toBe('paciente verbaliza ganas de no estar')
  })

  it('parses new rows with heteroaggression="verbal" and substance_use_acute="none"', () => {
    const fresh = {
      ...baseSummary,
      risk_assessment: {
        suicidality: 'none' as const,
        self_harm: 'none' as const,
        heteroaggression: 'verbal' as const,
        substance_use_acute: 'none' as const,
        notes: 'paciente verbaliza rabia difusa hacia entorno',
      },
    }

    const parsed = AssessmentSchema.parse(fresh)

    expect(parsed.risk_assessment.heteroaggression).toBe('verbal')
    expect(parsed.risk_assessment.substance_use_acute).toBe('none')
  })

  it('parses rows with substance_use_acute=null (LLM marks topic as not relevant)', () => {
    const fresh = {
      ...baseSummary,
      risk_assessment: {
        suicidality: 'none' as const,
        self_harm: 'none' as const,
        heteroaggression: 'none' as const,
        substance_use_acute: null,
        notes: '',
      },
    }

    const parsed = AssessmentSchema.parse(fresh)

    expect(parsed.risk_assessment.substance_use_acute).toBeNull()
  })

  it('parses rows with heteroaggression="plan" and substance_use_acute="confirmed"', () => {
    const fresh = {
      ...baseSummary,
      risk_assessment: {
        suicidality: 'none' as const,
        self_harm: 'none' as const,
        heteroaggression: 'plan' as const,
        substance_use_acute: 'confirmed' as const,
        notes: 'cita textual: "voy a darle una paliza al jefe"',
      },
    }

    const parsed = AssessmentSchema.parse(fresh)

    expect(parsed.risk_assessment.heteroaggression).toBe('plan')
    expect(parsed.risk_assessment.substance_use_acute).toBe('confirmed')
  })

  it('rejects invalid heteroaggression value', () => {
    const bad = {
      ...baseSummary,
      risk_assessment: {
        suicidality: 'none' as const,
        self_harm: 'none' as const,
        heteroaggression: 'high',
        substance_use_acute: null,
        notes: '',
      },
    }

    const result = AssessmentSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })
})

describe('AssessmentGenerationSchema strict mode (LLM output)', () => {
  it('requires heteroaggression and substance_use_acute (no defaults at generation boundary)', () => {
    // Same legacy shape — at the generation boundary the LLM MUST emit the
    // new fields. This guards against a future regression where the LLM
    // schema accidentally inherits defaults from AssessmentSchema.
    const legacyShape = {
      ...baseSummary,
      proposed_tasks: [],
      risk_assessment: {
        suicidality: 'none' as const,
        self_harm: 'none' as const,
        notes: '',
      },
    }

    const result = AssessmentGenerationSchema.safeParse(legacyShape)
    expect(result.success).toBe(false)
  })

  it('accepts a complete LLM output with all new fields', () => {
    const llmOutput = {
      ...baseSummary,
      proposed_tasks: [],
      risk_assessment: {
        suicidality: 'passive' as const,
        self_harm: 'none' as const,
        heteroaggression: 'verbal' as const,
        substance_use_acute: null,
        notes: 'paciente verbaliza ganas de desaparecer sin plan',
      },
    }

    const result = AssessmentGenerationSchema.safeParse(llmOutput)
    expect(result.success).toBe(true)
  })

  it('requires substance_use_acute to be present (null is allowed, missing is not)', () => {
    const missingField = {
      ...baseSummary,
      proposed_tasks: [],
      risk_assessment: {
        suicidality: 'none' as const,
        self_harm: 'none' as const,
        heteroaggression: 'none' as const,
        // substance_use_acute intentionally missing
        notes: '',
      },
    }

    const result = AssessmentGenerationSchema.safeParse(missingField)
    expect(result.success).toBe(false)
  })

  it('requires proposed_tasks (no default at generation boundary)', () => {
    const missingTasks = {
      ...baseSummary,
      risk_assessment: {
        suicidality: 'none' as const,
        self_harm: 'none' as const,
        heteroaggression: 'none' as const,
        substance_use_acute: null,
        notes: '',
      },
    }

    const result = AssessmentGenerationSchema.safeParse(missingTasks)
    expect(result.success).toBe(false)
  })
})

describe('clinical-report.md prompt structure', () => {
  // Snapshot-style guard: the prompt is the contract between the LLM and the
  // clinical safety logic in this module. If a section header disappears,
  // we want the test suite to fail loudly.
  const promptPath = join(
    process.cwd(),
    'docs/agents/prompts/clinical-report.md',
  )
  const prompt = readFileSync(promptPath, 'utf-8')

  it('contains the binding clinical criteria section', () => {
    expect(prompt).toContain(
      '## Criterios clínicos para los enums (vinculantes)',
    )
  })

  it('defines all four risk_assessment enums', () => {
    expect(prompt).toContain('### `suicidality`')
    expect(prompt).toContain('### `self_harm`')
    expect(prompt).toContain('### `heteroaggression` (nuevo enum)')
    expect(prompt).toContain('### `substance_use_acute` (nuevo enum, nullable)')
  })

  it('contains the ASQ anti-overclassification rule', () => {
    expect(prompt).toContain(
      'ASQ banda `positive` significa **"necesita seguimiento clínico"**',
    )
  })

  it('contains the patient_facing_summary tone rules section', () => {
    expect(prompt).toContain('## Tono del patient_facing_summary')
    expect(prompt).toContain('**PROHIBIDO**')
    expect(prompt).toContain('**SÍ**')
  })

  it('contains the recommended_actions_for_clinician framework with all three prefixes', () => {
    expect(prompt).toContain(
      '## Framework de recommended_actions_for_clinician',
    )
    expect(prompt).toContain('`[URGENTE]`')
    expect(prompt).toContain('`[CONSULTA]`')
    expect(prompt).toContain('`[SEGUIMIENTO]`')
  })

  it('contains the regeneration-context handling section', () => {
    expect(prompt).toContain('## Cuando recibes un Contexto de regeneración')
    expect(prompt).toContain(
      'el clínico revisor ha rechazado tu versión anterior',
    )
  })

  it('preserves stable section order (criteria → tone → framework → regeneration → output)', () => {
    const idxCriteria = prompt.indexOf(
      '## Criterios clínicos para los enums (vinculantes)',
    )
    const idxTone = prompt.indexOf('## Tono del patient_facing_summary')
    const idxFramework = prompt.indexOf(
      '## Framework de recommended_actions_for_clinician',
    )
    const idxRegen = prompt.indexOf(
      '## Cuando recibes un Contexto de regeneración',
    )
    const idxOutput = prompt.indexOf('## Formato de salida')

    expect(idxCriteria).toBeGreaterThan(0)
    expect(idxTone).toBeGreaterThan(idxCriteria)
    expect(idxFramework).toBeGreaterThan(idxTone)
    expect(idxRegen).toBeGreaterThan(idxFramework)
    expect(idxOutput).toBeGreaterThan(idxRegen)
  })

  it('JSON example includes heteroaggression and substance_use_acute', () => {
    expect(prompt).toContain('"heteroaggression": "none|verbal|plan"')
    expect(prompt).toContain(
      '"substance_use_acute": "none|suspected|confirmed|null"',
    )
  })
})
