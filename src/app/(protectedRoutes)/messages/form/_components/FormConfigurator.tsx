'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDown,
  ArrowUp,
  BellRing,
  ClipboardList,
  FileText,
  Inbox,
  ListChecks,
  Loader2,
  Palette,
  PartyPopper,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { deleteFormSubmission, saveFormService, submitFormPreview } from '@/actions/services'
import { ServiceStudio } from '@/components/services/studio/ServiceStudio'
import { AccentPicker, ChoiceCards, Field, StudioSection, ToggleRow } from '@/components/services/studio/StudioPrimitives'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SERVICE_SNIPPETS } from '@/lib/services/snippets'
import {
  ACCENTS,
  FORM_FIELD_TYPES,
  SERVICE_LIMITS,
  accentHex,
  fieldId,
  type FormField,
  type FormFieldType,
  type FormServiceConfig,
  type ServiceState,
} from '@/lib/services/types'
import { cn } from '@/lib/utils'

type Submission = { id: string; source: string; createdAt: string; fields: Record<string, string> }

const SELECT_CLASS = 'h-9 rounded-md border border-input bg-transparent px-2 text-sm'
const SECTIONS = [
  { id: 'content', label: 'Content' },
  { id: 'fields', label: 'Fields' },
  { id: 'after', label: 'After submit' },
  { id: 'delivery', label: 'Delivery & spam' },
  { id: 'look', label: 'Look' },
  { id: 'submissions', label: 'Submissions' },
]

/** Long text and dropdowns always take the full row in the two-column layout. */
const isWide = (field: FormField) => field.type === 'textarea' || field.type === 'select'

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
  const savedEnabled = (JSON.parse(saved) as { enabled: boolean }).enabled
  const accent = accentHex(config.accent)
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

  const addField = () =>
    patch({
      fields: [
        ...config.fields,
        { id: fieldId(), label: 'New field', type: 'text', required: false, options: [], placeholder: '', helpText: '' },
      ],
    })

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
      toast.error('Save the form first. Test submissions use the saved version.')
      return
    }
    startSubmitting(async () => {
      const result = await submitFormPreview({ values, consent })
      if (!result.ok) {
        setResultMessage(result.error)
        return
      }
      setResultMessage(result.message + (result.emailed ? '' : ' (email not sent: SMTP is not configured)'))
      setValues({})
      setConsent(false)
      router.refresh()
    })
  }

  const preview = (
    <form
      className="max-h-[640px] space-y-4 overflow-y-auto p-5"
      onSubmit={(event) => {
        event.preventDefault()
        testSubmit()
      }}
    >
      <div>
        <p className="text-base font-semibold">{config.title}</p>
        {config.description ? <p className="mt-0.5 text-sm text-muted-foreground">{config.description}</p> : null}
      </div>
      <div className={cn('grid gap-3', config.layout === 'double' && 'sm:grid-cols-2')}>
        {config.fields.map((field) => (
          <div key={field.id} className={cn('space-y-1', config.layout === 'double' && isWide(field) && 'sm:col-span-2')}>
            <label htmlFor={`preview-${field.id}`} className="text-xs font-medium">
              {field.label}
              {field.required ? <span className="text-destructive"> *</span> : null}
            </label>
            {field.type === 'textarea' ? (
              <Textarea
                id={`preview-${field.id}`}
                rows={2}
                placeholder={field.placeholder}
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
                <option value="">{field.placeholder || 'Choose…'}</option>
                {field.options.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            ) : (
              <Input
                id={`preview-${field.id}`}
                type={inputTypeFor(field.type)}
                placeholder={field.placeholder}
                value={values[field.id] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
              />
            )}
            {field.helpText ? <p className="text-[11px] text-muted-foreground">{field.helpText}</p> : null}
          </div>
        ))}
      </div>
      {config.consentText ? (
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" className="mt-0.5" style={{ accentColor: accent }} checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          {config.consentText}
        </label>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-full text-sm font-medium text-white disabled:opacity-60"
        style={{ backgroundColor: accent }}
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {config.submitLabel} (test)
      </button>
      {resultMessage ? <p className="text-center text-xs text-muted-foreground">{resultMessage}</p> : null}
    </form>
  )

  return (
    <ServiceStudio
      name="Form"
      icon={ClipboardList}
      tagline="A callback and lead form. Submissions land here and in your inbox."
      status={{ live: savedEnabled, label: savedEnabled ? 'Live' : 'Off' }}
      toggle={{ label: 'On website', checked: enabled, onChange: setEnabled }}
      publicHref={`/form/${encodeURIComponent(roomName)}`}
      dirty={dirty}
      saving={isSaving}
      onSave={save}
      sections={SECTIONS}
      preview={preview}
      previewTitle="form · live preview"
      integrate={{
        serviceName: 'Form',
        roomName,
        snippet: SERVICE_SNIPPETS.form,
        snippetFile: 'components/CallbackForm.tsx',
        hostedHref: `/form/${encodeURIComponent(roomName)}`,
        offNotice: enabled ? null : 'The form is off. Turn it on and save, or the SDK and hosted page will refuse submissions.',
      }}
    >
      <StudioSection
        id="content"
        icon={FileText}
        title="Content"
        description="The heading, the line under it and the button."
        summary={[
          { label: 'title', value: config.title },
          { label: 'button', value: config.submitLabel },
        ]}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Title" htmlFor="form-title" counter={`${config.title.length}/${SERVICE_LIMITS.formTitle}`}>
            <Input id="form-title" value={config.title} maxLength={SERVICE_LIMITS.formTitle} onChange={(e) => patch({ title: e.target.value })} />
          </Field>
          <Field label="Button label" htmlFor="form-submit">
            <Input
              id="form-submit"
              value={config.submitLabel}
              maxLength={SERVICE_LIMITS.submitLabel}
              onChange={(e) => patch({ submitLabel: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Description" htmlFor="form-description" counter={`${config.description.length}/${SERVICE_LIMITS.formDescription}`}>
          <Textarea
            id="form-description"
            rows={2}
            value={config.description}
            maxLength={SERVICE_LIMITS.formDescription}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </Field>
      </StudioSection>

      <StudioSection
        id="fields"
        icon={ListChecks}
        accent="sky"
        title="Fields"
        description="What you ask for. Phone fields get a country-code picker on the hosted page."
        summary={[
          { label: 'fields', value: `${config.fields.length} of ${SERVICE_LIMITS.maxFields}` },
          { label: 'required', value: config.fields.filter((field) => field.required).map((field) => field.label).join(', ') || 'none' },
        ]}
        action={
          <Button variant="outline" size="sm" disabled={config.fields.length >= SERVICE_LIMITS.maxFields} onClick={addField}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add field
          </Button>
        }
      >
        <ol className="space-y-2">
          {config.fields.map((field, index) => (
            <li key={field.id} className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border font-mono text-[10px] text-muted-foreground">
                  {index + 1}
                </span>
                <Input
                  className="min-w-[160px] flex-1"
                  value={field.label}
                  maxLength={SERVICE_LIMITS.fieldLabel}
                  onChange={(e) => patchField(field.id, { label: e.target.value })}
                  aria-label={`Field ${index + 1} label`}
                />
                <select
                  className={SELECT_CLASS}
                  value={field.type}
                  onChange={(e) => patchField(field.id, { type: e.target.value as FormFieldType })}
                  aria-label={`Field ${index + 1} type`}
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
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={field.placeholder}
                  maxLength={SERVICE_LIMITS.placeholder}
                  onChange={(e) => patchField(field.id, { placeholder: e.target.value })}
                  placeholder={field.type === 'select' ? 'First option text, e.g. Choose a service' : 'Placeholder (optional)'}
                  aria-label={`Field ${index + 1} placeholder`}
                />
                <Input
                  value={field.helpText}
                  maxLength={SERVICE_LIMITS.helpText}
                  onChange={(e) => patchField(field.id, { helpText: e.target.value })}
                  placeholder="Help text under the field (optional)"
                  aria-label={`Field ${index + 1} help text`}
                />
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
                  aria-label={`Field ${index + 1} options`}
                />
              ) : null}
            </li>
          ))}
        </ol>
      </StudioSection>

      <StudioSection
        id="after"
        icon={PartyPopper}
        accent="emerald"
        title="After submit"
        description="What visitors see once they send the form."
        summary={[
          { label: 'then', value: config.redirectUrl ? `go to ${config.redirectUrl}` : 'show success message' },
          { label: 'chat link', value: config.showChatLink ? 'on' : 'off' },
        ]}
      >
        <Field label="Success message" htmlFor="form-success" counter={`${config.successMessage.length}/${SERVICE_LIMITS.successMessage}`}>
          <Input
            id="form-success"
            value={config.successMessage}
            maxLength={SERVICE_LIMITS.successMessage}
            onChange={(e) => patch({ successMessage: e.target.value })}
          />
        </Field>
        <Field
          label="Send visitors to a page instead"
          htmlFor="form-redirect"
          hint="Optional. An https:// link (a thank-you page, a booking calendar…). Saved only if it's a safe link."
        >
          <Input
            id="form-redirect"
            type="url"
            value={config.redirectUrl}
            maxLength={SERVICE_LIMITS.url}
            onChange={(e) => patch({ redirectUrl: e.target.value })}
            placeholder="https://your-site.com/thank-you"
          />
        </Field>
        <ToggleRow
          label="Offer “Chat with us” after sending"
          hint="Shown on the success screen when Chat AI is on."
          checked={config.showChatLink}
          onChange={(showChatLink) => patch({ showChatLink })}
        />
      </StudioSection>

      <StudioSection
        id="delivery"
        icon={BellRing}
        accent="amber"
        title="Delivery & spam"
        description="Where submissions go, the consent box, and protection from bots."
        summary={[
          { label: 'email to', value: config.notifyEmail || ownerEmail || 'your account email' },
          { label: 'consent', value: config.consentText ? 'required' : 'none' },
          { label: 'spam trap', value: config.spamProtection ? 'on' : 'off' },
        ]}
      >
        <Field label="Send submissions to" htmlFor="form-email" hint="Empty uses your account email.">
          <Input
            id="form-email"
            type="email"
            value={config.notifyEmail}
            maxLength={SERVICE_LIMITS.email}
            onChange={(e) => patch({ notifyEmail: e.target.value })}
            placeholder={ownerEmail || 'your@email.com'}
          />
        </Field>
        <Field label="Consent checkbox" htmlFor="form-consent" hint="Leave empty for no checkbox.">
          <Textarea
            id="form-consent"
            rows={2}
            value={config.consentText}
            maxLength={SERVICE_LIMITS.consent}
            onChange={(e) => patch({ consentText: e.target.value })}
          />
        </Field>
        <ToggleRow
          label="Spam protection"
          hint="A hidden field only bots fill in. Their submissions are dropped quietly."
          checked={config.spamProtection}
          onChange={(spamProtection) => patch({ spamProtection })}
        />
      </StudioSection>

      <StudioSection
        id="look"
        icon={Palette}
        accent="rose"
        title="Look"
        description="Colour and layout on the hosted form. The SDK passes both to your designer."
        summary={[
          { label: 'accent', value: `${ACCENTS.find((item) => item.id === config.accent)?.label} ${accent}` },
          { label: 'layout', value: config.layout === 'double' ? 'two columns' : 'one column' },
        ]}
      >
        <Field label="Accent colour">
          <AccentPicker value={config.accent} onChange={(value) => patch({ accent: value })} />
        </Field>
        <Field label="Layout">
          <ChoiceCards
            ariaLabel="Layout"
            columns={2}
            value={config.layout}
            options={[
              { id: 'single', label: 'One column', hint: 'Best on phones and short forms' },
              { id: 'double', label: 'Two columns', hint: 'Short fields side by side on wide screens' },
            ]}
            onChange={(layout) => patch({ layout })}
          />
        </Field>
      </StudioSection>

      <StudioSection
        id="submissions"
        icon={Inbox}
        accent="sky"
        title="Submissions"
        description="The latest 50, newest first. Test sends from the preview are marked “preview”."
        summary={[{ label: 'shown', value: String(submissions.length) }]}
      >
        {submissions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No submissions yet. Try the preview on the right.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border/70">
            {submissions.map((submission) => (
              <li key={submission.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 space-y-0.5">
                  {Object.entries(submission.fields).map(([key, value]) => (
                    <p key={key} className="truncate">
                      <span className="text-muted-foreground">{config.fields.find((field) => field.id === key)?.label ?? key}:</span>{' '}
                      {value}
                    </p>
                  ))}
                  <p className="font-mono text-[11px] text-muted-foreground">
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
      </StudioSection>
    </ServiceStudio>
  )
}
