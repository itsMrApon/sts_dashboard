'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteFormSubmission, saveFormService, submitFormPreview } from '@/actions/services'
import { ServiceConfigFrame } from '@/components/services/ServiceConfigFrame'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SERVICE_SNIPPETS } from '@/lib/services/snippets'
import {
  FORM_FIELD_TYPES,
  SERVICE_LIMITS,
  fieldId,
  type FormField,
  type FormFieldType,
  type FormServiceConfig,
  type ServiceState,
} from '@/lib/services/types'

type Submission = { id: string; source: string; createdAt: string; fields: Record<string, string> }

const SELECT_CLASS = 'h-9 rounded-md border border-input bg-transparent px-2 text-sm'

function inputTypeFor(type: FormFieldType) {
  if (type === 'email') return 'email'
  if (type === 'phone') return 'tel'
  return 'text'
}

export function FormConfigurator({
  roomName,
  initial,
  ownerEmail,
  submissions,
}: {
  roomName: string
  initial: ServiceState<FormServiceConfig>
  ownerEmail: string
  submissions: Submission[]
}) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initial.enabled)
  const [config, setConfig] = useState(initial.config)
  const [saved, setSaved] = useState(() => JSON.stringify(initial))
  const [isSaving, startSaving] = useTransition()

  const [values, setValues] = useState<Record<string, string>>({})
  const [consent, setConsent] = useState(false)
  const [isSubmitting, startSubmitting] = useTransition()
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  const dirty = JSON.stringify({ enabled, config }) !== saved
  const patch = (partial: Partial<FormServiceConfig>) => setConfig((current) => ({ ...current, ...partial }))
  const patchField = (id: string, partial: Partial<FormField>) =>
    patch({ fields: config.fields.map((field) => (field.id === id ? { ...field, ...partial } : field)) })

  const moveField = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= config.fields.length) return
    const fields = [...config.fields]
    ;[fields[index], fields[target]] = [fields[target], fields[index]]
    patch({ fields })
  }

  const save = () =>
    startSaving(async () => {
      const result = await saveFormService({ enabled, config })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setConfig(result.config)
      setSaved(JSON.stringify({ enabled, config: result.config }))
      toast.success('Form saved')
    })

  const testSubmit = () => {
    if (dirty) {
      toast.error('Save the form first — test submissions use the saved version')
      return
    }
    startSubmitting(async () => {
      const result = await submitFormPreview({ values, consent })
      if (!result.ok) {
        setResultMessage(result.error)
        return
      }
      setResultMessage(result.message + (result.emailed ? '' : ' (email not sent — SMTP is not configured)'))
      setValues({})
      setConsent(false)
      router.refresh()
    })
  }

  const preview = (
    <form
      className="space-y-3 rounded-3xl border border-border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault()
        testSubmit()
      }}
    >
      <div>
        <p className="text-base font-semibold">{config.title}</p>
        {config.description ? <p className="text-sm text-muted-foreground">{config.description}</p> : null}
      </div>
      {config.fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <Label htmlFor={`preview-${field.id}`} className="text-xs">
            {field.label}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </Label>
          {field.type === 'textarea' ? (
            <Textarea
              id={`preview-${field.id}`}
              rows={2}
              value={values[field.id] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
            />
          ) : field.type === 'select' ? (
            <select
              id={`preview-${field.id}`}
              className={`${SELECT_CLASS} w-full`}
              value={values[field.id] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
            >
              <option value="">Choose…</option>
              {field.options.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          ) : (
            <Input
              id={`preview-${field.id}`}
              type={inputTypeFor(field.type)}
              value={values[field.id] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
            />
          )}
        </div>
      ))}
      {config.consentText ? (
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          {config.consentText}
        </label>
      ) : null}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
        {config.submitLabel} (test)
      </Button>
      {resultMessage ? <p className="text-center text-xs text-muted-foreground">{resultMessage}</p> : null}
    </form>
  )

  const submissionsTable = (
    <section className="space-y-3 rounded-2xl border border-border bg-card/60 p-5">
      <h2 className="text-sm font-semibold">Recent submissions</h2>
      {submissions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No submissions yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {submissions.map((submission) => (
            <li key={submission.id} className="flex items-start justify-between gap-3 py-3 text-sm">
              <div className="min-w-0 space-y-0.5">
                {Object.entries(submission.fields).map(([key, value]) => (
                  <p key={key} className="truncate">
                    <span className="text-muted-foreground">
                      {config.fields.find((field) => field.id === key)?.label ?? key}:
                    </span>{' '}
                    {value}
                  </p>
                ))}
                <p className="text-xs text-muted-foreground">
                  {new Date(submission.createdAt).toLocaleString()} · {submission.source}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-destructive"
                aria-label="Delete submission"
                onClick={async () => {
                  const result = await deleteFormSubmission(submission.id)
                  if (result.ok) router.refresh()
                  else toast.error(result.error)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  return (
    <ServiceConfigFrame
      serviceName="Form"
      roomName={roomName}
      enabled={enabled}
      onEnabledChange={setEnabled}
      dirty={dirty}
      saving={isSaving}
      onSave={save}
      preview={preview}
      snippet={SERVICE_SNIPPETS.form}
      footer={submissionsTable}
    >
      <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
        <h2 className="text-sm font-semibold">Form</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="form-title">Title</Label>
            <Input id="form-title" value={config.title} maxLength={SERVICE_LIMITS.formTitle} onChange={(e) => patch({ title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="form-submit">Button label</Label>
            <Input
              id="form-submit"
              value={config.submitLabel}
              maxLength={SERVICE_LIMITS.submitLabel}
              onChange={(e) => patch({ submitLabel: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="form-description">Description</Label>
          <Textarea
            id="form-description"
            rows={2}
            value={config.description}
            maxLength={SERVICE_LIMITS.formDescription}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card/60 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Fields</h2>
          <Button
            variant="outline"
            size="sm"
            disabled={config.fields.length >= SERVICE_LIMITS.maxFields}
            onClick={() =>
              patch({ fields: [...config.fields, { id: fieldId(), label: 'New field', type: 'text', required: false, options: [] }] })
            }
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add field
          </Button>
        </div>
        <ol className="space-y-2">
          {config.fields.map((field, index) => (
            <li key={field.id} className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="min-w-[160px] flex-1"
                  value={field.label}
                  maxLength={SERVICE_LIMITS.fieldLabel}
                  onChange={(e) => patchField(field.id, { label: e.target.value })}
                  aria-label="Field label"
                />
                <select
                  className={SELECT_CLASS}
                  value={field.type}
                  onChange={(e) => patchField(field.id, { type: e.target.value as FormFieldType })}
                  aria-label="Field type"
                >
                  {FORM_FIELD_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs">
                  <Switch checked={field.required} onCheckedChange={(required) => patchField(field.id, { required })} />
                  Required
                </label>
                <div className="ml-auto flex">
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => moveField(index, -1)} aria-label="Move up">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === config.fields.length - 1}
                    onClick={() => moveField(index, 1)}
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    disabled={config.fields.length <= 1}
                    onClick={() => patch({ fields: config.fields.filter((item) => item.id !== field.id) })}
                    aria-label="Remove field"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {field.type === 'select' ? (
                <Input
                  value={field.options.join(', ')}
                  onChange={(e) =>
                    patchField(field.id, {
                      options: e.target.value.split(',').map((option) => option.trim()).filter(Boolean),
                    })
                  }
                  placeholder="Options, comma separated"
                />
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
        <h2 className="text-sm font-semibold">After submit</h2>
        <div className="space-y-2">
          <Label htmlFor="form-consent">Consent checkbox text (leave empty for none)</Label>
          <Textarea
            id="form-consent"
            rows={2}
            value={config.consentText}
            maxLength={SERVICE_LIMITS.consent}
            onChange={(e) => patch({ consentText: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="form-success">Success message</Label>
            <Input
              id="form-success"
              value={config.successMessage}
              maxLength={SERVICE_LIMITS.successMessage}
              onChange={(e) => patch({ successMessage: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="form-email">Send submissions to</Label>
            <Input
              id="form-email"
              type="email"
              value={config.notifyEmail}
              maxLength={SERVICE_LIMITS.email}
              onChange={(e) => patch({ notifyEmail: e.target.value })}
              placeholder={ownerEmail || 'your@email.com'}
            />
          </div>
        </div>
      </section>
    </ServiceConfigFrame>
  )
}
