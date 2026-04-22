'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Trash2, Plus } from 'lucide-react'

import type { AssessmentSummary, ProposedTask } from '@/lib/assessments/generator'
import type { SessionDetail } from '@/lib/clinician/session-detail'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { saveAssessmentAction } from '@/app/app/clinica/sesion/[sessionId]/actions'

type SuicidalityLevel = AssessmentSummary['risk_assessment']['suicidality']
type SelfHarmLevel = AssessmentSummary['risk_assessment']['self_harm']

const SUICIDALITY_OPTIONS: Array<{ value: SuicidalityLevel; label: string }> = [
  { value: 'none', label: 'Sin ideación' },
  { value: 'passive', label: 'Ideación pasiva' },
  { value: 'active', label: 'Ideación activa' },
  { value: 'acute', label: 'Ideación aguda' },
]

const SELF_HARM_OPTIONS: Array<{ value: SelfHarmLevel; label: string }> = [
  { value: 'none', label: 'Sin autolesiones' },
  { value: 'historic', label: 'Autolesiones previas' },
  { value: 'current', label: 'Autolesiones actuales' },
]

type PatientTaskStatus = SessionDetail['inheritedTasks'][number]['estado']

const TASK_STATUS_OPTIONS: Array<{ value: PatientTaskStatus; label: string }> = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'cumplida', label: 'Cumplida' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'no_realizada', label: 'No realizada' },
  { value: 'no_abordada', label: 'No abordada' },
]

type InheritedTaskEdit = { estado: PatientTaskStatus; nota: string }

type ListField =
  | 'presenting_issues'
  | 'cognitive_patterns'
  | 'areas_for_exploration'
  | 'recommended_actions_for_clinician'

/**
 * Trim string entries and drop empty ones. Used before submitting so a
 * clinician's blank "Add" row doesn't become an empty bullet.
 */
function cleanStringList(list: readonly string[]): string[] {
  return list.map((s) => s.trim()).filter((s) => s.length > 0)
}

export function AssessmentEditor({
  assessmentId,
  sessionId,
  userId,
  initial,
  inheritedTasks,
  onCancel,
  onSaved,
}: {
  assessmentId: string
  sessionId: string
  userId: string
  initial: AssessmentSummary
  inheritedTasks: SessionDetail['inheritedTasks']
  onCancel: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<AssessmentSummary>(initial)
  const [inheritedEdits, setInheritedEdits] = useState<
    Record<string, InheritedTaskEdit>
  >({})
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function updateField<K extends keyof AssessmentSummary>(
    key: K,
    value: AssessmentSummary[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function updateListItem(field: ListField, index: number, value: string) {
    setDraft((prev) => {
      const next = [...prev[field]]
      next[index] = value
      return { ...prev, [field]: next }
    })
  }

  function removeListItem(field: ListField, index: number) {
    setDraft((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }))
  }

  function addListItem(field: ListField) {
    setDraft((prev) => ({ ...prev, [field]: [...prev[field], ''] }))
  }

  function updateRisk<K extends keyof AssessmentSummary['risk_assessment']>(
    key: K,
    value: AssessmentSummary['risk_assessment'][K],
  ) {
    setDraft((prev) => ({
      ...prev,
      risk_assessment: { ...prev.risk_assessment, [key]: value },
    }))
  }

  function updateProposedTask(index: number, field: keyof ProposedTask, value: string) {
    setDraft((prev) => {
      const next = [...prev.proposed_tasks]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, proposed_tasks: next }
    })
  }

  function removeProposedTask(index: number) {
    setDraft((prev) => ({
      ...prev,
      proposed_tasks: prev.proposed_tasks.filter((_, i) => i !== index),
    }))
  }

  function addProposedTask() {
    setDraft((prev) => ({
      ...prev,
      proposed_tasks: [...prev.proposed_tasks, { descripcion: '', nota: undefined }],
    }))
  }

  function updateInheritedEstado(id: string, value: PatientTaskStatus) {
    setInheritedEdits((prev) => {
      const original = inheritedTasks.find((t) => t.id === id)
      const base: InheritedTaskEdit = prev[id] ?? {
        estado: original!.estado,
        nota: original!.nota ?? '',
      }
      return { ...prev, [id]: { ...base, estado: value } }
    })
  }

  function updateInheritedNota(id: string, value: string) {
    setInheritedEdits((prev) => {
      const original = inheritedTasks.find((t) => t.id === id)
      const base: InheritedTaskEdit = prev[id] ?? {
        estado: original!.estado,
        nota: original!.nota ?? '',
      }
      return { ...prev, [id]: { ...base, nota: value } }
    })
  }

  function handleSubmit() {
    setError(null)
    const cleaned: AssessmentSummary = {
      ...draft,
      presenting_issues: cleanStringList(draft.presenting_issues),
      cognitive_patterns: cleanStringList(draft.cognitive_patterns),
      areas_for_exploration: cleanStringList(draft.areas_for_exploration),
      recommended_actions_for_clinician: cleanStringList(
        draft.recommended_actions_for_clinician,
      ),
      proposed_tasks: draft.proposed_tasks
        .map((t) => ({
          descripcion: t.descripcion.trim(),
          nota: t.nota?.trim() || undefined,
        }))
        .filter((t) => t.descripcion.length >= 3),
    }

    // Only send rows where the clinician changed at least one field vs original.
    const inherited_task_updates = inheritedTasks
      .filter((original) => {
        const edit = inheritedEdits[original.id]
        if (!edit) return false
        return (
          edit.estado !== original.estado ||
          (edit.nota ?? '') !== (original.nota ?? '')
        )
      })
      .map((original) => {
        const edit = inheritedEdits[original.id]!
        const nota = edit.nota.trim() || undefined
        return nota !== undefined
          ? { id: original.id, estado: edit.estado, nota }
          : { id: original.id, estado: edit.estado }
      })

    startTransition(async () => {
      const result = await saveAssessmentAction({
        assessmentId,
        sessionId,
        userId,
        summary: cleaned,
        inherited_task_updates,
      })
      if (result.ok) {
        toast.success('Informe actualizado.')
        onSaved()
      } else {
        setError(result.error)
        toast.error(`Error al guardar: ${result.error}`)
      }
    })
  }

  return (
    <>
      {/* Motivo de consulta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Motivo de consulta</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={draft.chief_complaint}
            onChange={(e) => updateField('chief_complaint', e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Problemas presentes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Problemas presentes</CardTitle>
        </CardHeader>
        <CardContent>
          <EditableList
            field="presenting_issues"
            items={draft.presenting_issues}
            onChange={updateListItem}
            onRemove={removeListItem}
            onAdd={addListItem}
          />
        </CardContent>
      </Card>

      {/* Estado anímico / afecto */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado anímico y afecto</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={draft.mood_affect}
            onChange={(e) => updateField('mood_affect', e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Patrones cognitivos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Patrones cognitivos</CardTitle>
        </CardHeader>
        <CardContent>
          <EditableList
            field="cognitive_patterns"
            items={draft.cognitive_patterns}
            onChange={updateListItem}
            onRemove={removeListItem}
            onAdd={addListItem}
          />
        </CardContent>
      </Card>

      {/* Evaluación de riesgo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evaluación de riesgo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-col gap-2">
            <Label htmlFor="risk-suicidality">Ideación suicida</Label>
            <Select
              value={draft.risk_assessment.suicidality}
              onValueChange={(value) =>
                updateRisk('suicidality', value as SuicidalityLevel)
              }
            >
              <SelectTrigger id="risk-suicidality" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUICIDALITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="risk-selfharm">Autolesión</Label>
            <Select
              value={draft.risk_assessment.self_harm}
              onValueChange={(value) =>
                updateRisk('self_harm', value as SelfHarmLevel)
              }
            >
              <SelectTrigger id="risk-selfharm" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SELF_HARM_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="risk-notes">Notas</Label>
            <Textarea
              id="risk-notes"
              value={draft.risk_assessment.notes}
              onChange={(e) => updateRisk('notes', e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Cuestionarios completados — read only */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Cuestionarios completados
          </CardTitle>
          <CardDescription>
            Los cuestionarios vienen del scoring y no se editan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {draft.questionnaires.length === 0 ? (
            <p className="text-sm text-slate-600">
              Sin cuestionarios completados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-600">
                    <th className="py-2 pr-3 font-medium">Código</th>
                    <th className="py-2 pr-3 font-medium">Puntuación</th>
                    <th className="py-2 font-medium">Banda</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.questionnaires.map((q, i) => (
                    <tr key={`${q.code}-${i}`} className="border-b last:border-b-0">
                      <td className="py-2 pr-3 font-medium">{q.code}</td>
                      <td className="py-2 pr-3">{q.score}</td>
                      <td className="py-2">
                        <Badge variant="secondary">{q.band}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Áreas a explorar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Áreas a explorar</CardTitle>
        </CardHeader>
        <CardContent>
          <EditableList
            field="areas_for_exploration"
            items={draft.areas_for_exploration}
            onChange={updateListItem}
            onRemove={removeListItem}
            onAdd={addListItem}
          />
        </CardContent>
      </Card>

      {/* Impresión preliminar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Impresión preliminar</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={draft.preliminary_impression}
            onChange={(e) =>
              updateField('preliminary_impression', e.target.value)
            }
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Acciones recomendadas al clínico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Acciones recomendadas al clínico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EditableList
            field="recommended_actions_for_clinician"
            items={draft.recommended_actions_for_clinician}
            onChange={updateListItem}
            onRemove={removeListItem}
            onAdd={addListItem}
          />
        </CardContent>
      </Card>

      {/* Tareas propuestas en esta sesión */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tareas propuestas en esta sesión</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {draft.proposed_tasks.length === 0 ? (
            <p className="text-sm text-slate-600">Sin tareas propuestas.</p>
          ) : (
            draft.proposed_tasks.map((task, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`task-desc-${i}`}>Descripción</Label>
                    <Input
                      id={`task-desc-${i}`}
                      value={task.descripcion}
                      onChange={(e) =>
                        updateProposedTask(i, 'descripcion', e.target.value)
                      }
                      placeholder="Descripción de la tarea (mín. 3 caracteres)"
                    />
                    <Label htmlFor={`task-nota-${i}`}>Nota (opcional)</Label>
                    <Textarea
                      id={`task-nota-${i}`}
                      value={task.nota ?? ''}
                      onChange={(e) =>
                        updateProposedTask(i, 'nota', e.target.value)
                      }
                      rows={2}
                      placeholder="Nota adicional…"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeProposedTask(i)}
                    aria-label="Eliminar tarea"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
          <Button variant="outline" size="sm" onClick={addProposedTask}>
            <Plus className="size-4" />
            Añadir tarea
          </Button>
        </CardContent>
      </Card>

      {/* Acuerdos heredados de sesiones anteriores */}
      {inheritedTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Acuerdos heredados de sesiones anteriores
            </CardTitle>
            <CardDescription>
              Tareas pendientes o parciales acordadas en sesiones previas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {inheritedTasks.map((task) => {
              const edit = inheritedEdits[task.id]
              const currentEstado = edit?.estado ?? task.estado
              const currentNota = edit?.nota ?? task.nota ?? ''
              return (
                <div key={task.id} className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">{task.descripcion}</p>
                  <p className="text-xs text-slate-500">
                    Acordada el{' '}
                    {new Date(task.createdAt).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}{' '}
                    · Sesión anterior
                  </p>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`inherited-estado-${task.id}`}>
                      Estado
                    </Label>
                    <Select
                      value={currentEstado}
                      onValueChange={(value) =>
                        updateInheritedEstado(task.id, value as PatientTaskStatus)
                      }
                    >
                      <SelectTrigger
                        id={`inherited-estado-${task.id}`}
                        className="w-full sm:w-48"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`inherited-nota-${task.id}`}>
                      Nota (opcional)
                    </Label>
                    <Textarea
                      id={`inherited-nota-${task.id}`}
                      value={currentNota}
                      onChange={(e) =>
                        updateInheritedNota(task.id, e.target.value)
                      }
                      rows={2}
                      placeholder="Nota sobre el seguimiento…"
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Resumen para el paciente */}
      <Card className="bg-slate-50">
        <CardHeader>
          <CardTitle className="text-base">Resumen para el paciente</CardTitle>
          <CardDescription>
            Este es el texto que verá el paciente en su panel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={draft.patient_facing_summary}
            onChange={(e) =>
              updateField('patient_facing_summary', e.target.value)
            }
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Controles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Guardar cambios</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={isPending}
            >
              Cancelar
            </Button>
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function EditableList({
  field,
  items,
  onChange,
  onRemove,
  onAdd,
}: {
  field: ListField
  items: readonly string[]
  onChange: (field: ListField, index: number, value: string) => void
  onRemove: (field: ListField, index: number) => void
  onAdd: (field: ListField) => void
}) {
  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-sm text-slate-600">Sin entradas.</p>
      ) : (
        items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <Input
              value={item}
              onChange={(e) => onChange(field, i, e.target.value)}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(field, i)}
              aria-label="Eliminar entrada"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))
      )}
      <Button variant="outline" size="sm" onClick={() => onAdd(field)}>
        <Plus className="size-4" />
        Añadir
      </Button>
    </div>
  )
}
