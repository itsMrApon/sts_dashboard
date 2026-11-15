'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BellRing,
  ClipboardList,
  FileText,
  ListChecks,
  Loader2,
  Palette,
  PartyPopper,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { draftFormWithAI, saveFormService, submitFormPreview } from '@/actions/services'
import { FormFlow } from '@/components/services/form/FormFlow'
import { ServiceStudio } from '@/components/services/studio/ServiceStudio'
import { AccentPicker, ChoiceCards, Field, StudioSection, ToggleRow } from '@/components/services/studio/StudioPrimitives'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { guardAction } from '@/lib/clientActionErrors'
import { SERVICE_SNIPPETS } from '@/lib/services/snippets'
import {
  ACCENTS,
  FORM_FIELD_TYPES,
  SERVICE_LIMITS,
  accentHex,
  newFormField,
  type FormField,
  type FormFieldType,
  type FormServiceConfig,
  type ServiceState,
} from '@/lib/services/types'

const SELECT_CLASS = 'h-9 rounded-md border border-input bg-transparent px-2 text-sm'
const SECTIONS = [
  { id: 'content', label: 'Content' },
  { id: 'questions', label: 'Questions' },
  { id: 'after', label: 'After submit' },
  { id: 'delivery', label: 'Delivery & spam' },
  { id: 'look', label: 'Look' },
]

/** Question types where a placeholder shows (choice-style questions have none). */
const TYPED_ANSWER: FormFieldType[] = ['text', 'textarea', 'email', 'phone', 'number', 'url']

export function FormConfigurator({
  roomName,
  initial,
  ownerEmail,
  emailReady,
}: {
  roomName: string
  initial: ServiceState<FormServiceConfig>
  ownerEmail: string
  /** SMTP is configured on the server. Without it no submission can be delivered. */
  emailReady: boolean
}) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [config, setConfig] = useState(initial.config)
  const [saved, setSaved] = useState(() => JSON.stringify(initial))
  const [isSaving, startSaving] = useTransition()
  const [isDrafting, startDrafting] = useTransition()
  // Remounts the preview (back to question 1, answers cleared).
  const [previewKey, setPreviewKey] = useState(0)

  const dirty = JSON.stringify({ enabled, config }) !== saved
  const savedEnabled = (JSON.parse(saved) as { enabled: boolean }).enabled
  const accent = accentHex(config.accent)
  const patch = (partial: Partial<FormServiceConfig>) => setConfig((current) => ({ ...current, ...partial }))
  const patchField = (id: string, partial: Partial<FormField>) =>
    patch({ fields: config.fields.map((field) => (field.id === id ? { ...field, ...partial } : field)) })

  // Blank choices being typed stay in the editor but not in the preview.
  const previewConfig = useMemo(
    () => ({ ...config, fields: config.fields.map((field) => ({ ...field, options: field.options.filter((option) => option.trim()) })) }),
    [config],
  )

  const moveField = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= config.fields.length) return
    const fields = [...config.fields]
    ;[fields[index], fields[target]] = [fields[target], fields[index]]
    patch({ fields })
  }

  const changeType = (field: FormField, type: FormFieldType) =>
    patchField(field.id, {
      type,
      // A new choice question starts with two choices to edit.
      options: type === 'select' && field.options.length === 0 ? ['Option 1', 'Option 2'] : field.options,
    })

  const save = () =>
    startSaving(
      guardAction(async () => {
        const result = await saveFormService({ enabled, config })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        setConfig(result.config)
        setSaved(JSON.stringify({ enabled, config: result.config }))
        toast.success('Form saved')
      }),
    )

  const buildWithAI = () =>
    startDrafting(
      guardAction(async () => {
        const result = await draftFormWithAI()
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        patch(result.draft)
        setPreviewKey((key) => key + 1)
        toast.success('Draft ready. Review the questions, then save.')
      }),
    )

  const preview = (
    <FormFlow
      key={previewKey}
      frame="embedded"
      config={previewConfig}
      defaultCountry="US"
      followRedirect={false}
      onSubmit={async (values, consent) => {
        if (dirty) return { ok: false, error: 'Save the form first. Test sends use the saved version.' }
        return submitFormPreview({ values, consent })
      }}
    />
  )

  return (
    <ServiceStudio
      name="Form"
      icon={ClipboardList}
      tagline="A one-question-at-a-time form. Every answer is emailed to you."
      status={{ live: savedEnabled, label: savedEnabled ? 'Live' : 'Off' }}
      toggle={{ label: 'On website', checked: enabled, onChange: setEnabled }}
      publicHref={`/form/${encodeURIComponent(roomName)}`}
      dirty={dirty}
      saving={isSaving}
      onSave={save}
      sections={SECTIONS}
      preview={preview}
      previewTitle="form · live preview"
      previewActions={
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setPreviewKey((key) => key + 1)}>
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          Restart
        </Button>
      }
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
        description="Shown above the first question, plus the button on the last one."
        summary={[
          { label: 'title', value: config.title },
          { label: 'button', value: config.submitLabel },
        ]}
        action={
          <Button size="sm" onClick={buildWithAI} disabled={isDrafting}>
            {isDrafting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            Build with AI
          </Button>
        }
      >
        <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <strong className="text-foreground">Build with AI</strong> writes the title, intro and questions from your business
          details, services and AI agent prompt. It replaces the current questions; nothing is saved until you press Save.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Title" htmlFor="form-title" counter={`${config.title.length}/${SERVICE_LIMITS.formTitle}`}>
            <Input id="form-title" value={config.title} maxLength={SERVICE_LIMITS.formTitle} onChange={(e) => patch({ title: e.target.value })} />
          </Field>
          <Field label="Last button" htmlFor="form-submit" hint="Earlier questions use “OK”.">
            <Input
              id="form-submit"
              value={config.submitLabel}
              maxLength={SERVICE_LIMITS.submitLabel}
              onChange={(e) => patch({ submitLabel: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Intro" htmlFor="form-description" counter={`${config.description.length}/${SERVICE_LIMITS.formDescription}`}>
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
        id="questions"
        icon={ListChecks}
        accent="sky"
        title="Questions"
        description="One question per screen, in this order. Phone questions get a country-code picker."
        summary={[
          { label: 'questions', value: `${config.fields.length} of ${SERVICE_LIMITS.maxFields}` },
          { label: 'required', value: config.fields.filter((field) => field.required).map((field) => field.label).join(', ') || 'none' },
        ]}
        action={
          <Button
            variant="outline"
            size="sm"
            disabled={config.fields.length >= SERVICE_LIMITS.maxFields}
            onClick={() => patch({ fields: [...config.fields, newFormField()] })}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add question
          </Button>
        }
      >
        <ol className="space-y-2">
          {config.fields.map((field, index) => (
            <li key={field.id} className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] text-white"
                  style={{ backgroundColor: accent }}
                >
                  {index + 1}
                </span>
                <Input
                  className="min-w-[180px] flex-1"
                  value={field.label}
                  maxLength={SERVICE_LIMITS.fieldLabel}
                  onChange={(e) => patchField(field.id, { label: e.target.value })}
                  aria-label={`Question ${index + 1}`}
                />
                <select
                  className={SELECT_CLASS}
                  value={field.type}
                  onChange={(e) => changeType(field, e.target.value as FormFieldType)}
                  aria-label={`Question ${index + 1} type`}
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
                    aria-label="Remove question"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className={TYPED_ANSWER.includes(field.type) ? 'grid gap-2 sm:grid-cols-2' : undefined}>
                {TYPED_ANSWER.includes(field.type) ? (
                  <Input
                    value={field.placeholder}
                    maxLength={SERVICE_LIMITS.placeholder}
                    onChange={(e) => patchField(field.id, { placeholder: e.target.value })}
                    placeholder="Placeholder (optional)"
                    aria-label={`Question ${index + 1} placeholder`}
                  />
                ) : null}
                <Input
                  value={field.helpText}
                  maxLength={SERVICE_LIMITS.helpText}
                  onChange={(e) => patchField(field.id, { helpText: e.target.value })}
                  placeholder="Description under the question (optional)"
                  aria-label={`Question ${index + 1} description`}
                />
              </div>

              {field.type === 'select' ? (
                <ChoicesEditor field={field} accent={accent} onChange={(partial) => patchField(field.id, partial)} />
              ) : null}

              {field.type === 'rating' ? (
                <ChoiceCards
                  ariaLabel={`Question ${index + 1} rating scale`}
                  columns={2}
                  value={String(field.scale) as '5' | '10'}
                  options={[
                    { id: '5', label: '1–5 stars' },
                    { id: '10', label: '0–10 scale' },
                  ]}
                  onChange={(scale) => patchField(field.id, { scale: scale === '10' ? 10 : 5 })}
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
          { label: 'then', value: config.redirectUrl ? `go to ${config.redirectUrl}` : 'show thank-you message' },
          { label: 'chat link', value: config.showChatLink ? 'on' : 'off' },
        ]}
      >
        <Field label="Thank-you message" htmlFor="form-success" counter={`${config.successMessage.length}/${SERVICE_LIMITS.successMessage}`}>
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
          hint="Shown on the thank-you screen when Chat AI is on."
          checked={config.showChatLink}
          onChange={(showChatLink) => patch({ showChatLink })}
        />
      </StudioSection>

      <StudioSection
        id="delivery"
        icon={BellRing}
        accent="amber"
        title="Delivery & spam"
        description="Answers are emailed to you and not stored anywhere else."
        summary={[
          { label: 'email to', value: config.notifyEmail || ownerEmail || 'your account email' },
          { label: 'consent', value: config.consentText ? 'required' : 'none' },
          { label: 'spam trap', value: config.spamProtection ? 'on' : 'off' },
        ]}
      >
        {!emailReady ? (
          <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span>
              Email (SMTP) isn&apos;t set up on the server, so submissions can&apos;t be delivered and visitors will see an
              error. Add <code>SMTP_HOST</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code> and <code>SMTP_FROM</code> to the
              environment.
            </span>
          </p>
        ) : null}
        <Field label="Send answers to" htmlFor="form-email" hint="Empty uses your account email. Replying goes to the visitor when they gave an email.">
          <Input
            id="form-email"
            type="email"
            value={config.notifyEmail}
            maxLength={SERVICE_LIMITS.email}
            onChange={(e) => patch({ notifyEmail: e.target.value })}
            placeholder={ownerEmail || 'your@email.com'}
          />
        </Field>
        <Field label="Consent checkbox" htmlFor="form-consent" hint="Shown on the last question. Leave empty for no checkbox.">
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
        description="The hosted form fills the whole screen. The SDK passes these to your designer."
        summary={[
          { label: 'accent', value: `${ACCENTS.find((item) => item.id === config.accent)?.label} ${accent}` },
          { label: 'background', value: config.theme },
        ]}
      >
        <Field label="Background">
          <ChoiceCards
            ariaLabel="Background"
            columns={2}
            value={config.theme}
            options={[
              { id: 'light', label: 'Light', hint: 'Clean off-white page' },
              { id: 'dark', label: 'Dark', hint: 'Near-black page' },
            ]}
            onChange={(theme) => patch({ theme })}
          />
        </Field>
        <Field label="Accent colour" hint="Buttons, progress bar and selected answers.">
          <AccentPicker value={config.accent} onChange={(value) => patch({ accent: value })} />
        </Field>
      </StudioSection>
    </ServiceStudio>
  )
}

const LETTERS = 'ABCDEFGHIJKL'

/** The choices of a multiple-choice question, one row each (A, B, C…). */
function ChoicesEditor({
  field,
  accent,
  onChange,
}: {
  field: FormField
  accent: string
  onChange: (partial: Partial<FormField>) => void
}) {
  const setOption = (index: number, value: string) =>
    onChange({ options: field.options.map((option, i) => (i === index ? value : option)) })

  return (
    <div className="space-y-2">
      {field.options.map((option, index) => (
        <div key={index} className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded border text-[11px] font-semibold"
            style={{ borderColor: `${accent}80`, color: accent }}
          >
            {LETTERS[index]}
          </span>
          <Input
            value={option}
            maxLength={SERVICE_LIMITS.option}
            onChange={(e) => setOption(index, e.target.value)}
            placeholder={`Choice ${index + 1}`}
            aria-label={`Choice ${LETTERS[index]}`}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            disabled={field.options.length <= 1}
            onClick={() => onChange({ options: field.options.filter((_, i) => i !== index) })}
            aria-label={`Remove choice ${LETTERS[index]}`}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          disabled={field.options.length >= SERVICE_LIMITS.maxOptions}
          onClick={() => onChange({ options: [...field.options, ''] })}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add choice
        </Button>
        <label className="flex items-center gap-1.5 text-xs">
          <Switch checked={field.multiple} onCheckedChange={(multiple) => onChange({ multiple })} />
          Allow several answers
        </label>
      </div>
    </div>
  )
}
