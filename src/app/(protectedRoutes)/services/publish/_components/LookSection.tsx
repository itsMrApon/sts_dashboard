'use client'

import { AccentPicker, ChoiceCards, Field } from '@/components/services/studio/StudioPrimitives'
import { Switch } from '@/components/ui/switch'
import { SITE_ACTIONS, SITE_BLOCKS, type SiteAppearance } from '@/lib/business/siteContent'
import type { SectionProps } from './BusinessConfigurator'

function FlagGrid<K extends string>({
  items,
  values,
  onChange,
  ariaLabel,
}: {
  items: { id: K; label: string }[]
  values: Record<K, boolean>
  onChange: (id: K, on: boolean) => void
  ariaLabel: string
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <label
          key={item.id}
          className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 text-sm hover:bg-muted/40"
        >
          {item.label}
          <Switch checked={values[item.id]} onCheckedChange={(on) => onChange(item.id, on)} />
        </label>
      ))}
    </div>
  )
}

/** Business → Look: colour, hero alignment, which blocks show and which hero buttons appear. */
export function LookSection({ content, onChange }: SectionProps) {
  const appearance = content.appearance
  const set = (patch: Partial<SiteAppearance>) => onChange({ ...content, appearance: { ...appearance, ...patch } })

  return (
    <div className="space-y-5">
      <Field label="Accent colour" hint="Buttons, prices and highlights on your business page.">
        <AccentPicker value={appearance.accent} onChange={(accent) => set({ accent })} />
      </Field>
      <Field label="Hero">
        <ChoiceCards
          ariaLabel="Hero alignment"
          columns={2}
          value={appearance.heroAlign}
          options={[
            { id: 'center', label: 'Centred', hint: 'Bold and balanced' },
            { id: 'left', label: 'Left-aligned', hint: 'Editorial, reads like an article' },
          ]}
          onChange={(heroAlign) => set({ heroAlign })}
        />
      </Field>
      <Field label="Hero buttons" hint="Each one also needs its service switched on.">
        <FlagGrid
          ariaLabel="Hero buttons"
          items={SITE_ACTIONS}
          values={appearance.actions}
          onChange={(id, on) => set({ actions: { ...appearance.actions, [id]: on } })}
        />
      </Field>
      <Field label="Blocks on the page" hint="Blocks with nothing in them stay hidden anyway.">
        <FlagGrid
          ariaLabel="Blocks on the page"
          items={SITE_BLOCKS}
          values={appearance.show}
          onChange={(id, on) => set({ show: { ...appearance.show, [id]: on } })}
        />
      </Field>
    </div>
  )
}
