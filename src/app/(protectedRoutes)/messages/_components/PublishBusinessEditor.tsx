'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  importServicesCatalogToTenant,
  publishTenantContext,
  saveTenantContextDraft,
} from '@/actions/tenants'
import {
  INDUSTRY_VERTICALS,
  buildCompactProfile,
  normalizeIndustryInput,
  type TenantContextDraft,
} from '@/lib/tenantContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ContextPlatformConfig, PublishNavSection } from './publishTypes'

type ContextStatus = 'DRAFT' | 'PUBLISHED' | 'STALE'

type ServiceRow = NonNullable<TenantContextDraft['industry']['typeSort']>[number]

type Props = {
  tenant: {
    id: string
    name: string
    publishProfile?: { id: string; name: string } | null
    contextStatus: ContextStatus
    contextVersion: string | null
    compactTokenEstimate: number
    contextVertical: string | null
    contextCoreJson: unknown
    contextIndustryJson: unknown
    contextSocialJson: unknown
    compactProfileJson: unknown
  }
  activeSection: PublishNavSection
  socialPlatforms: ContextPlatformConfig[]
  messagingPlatforms: ContextPlatformConfig[]
  otherPlatforms: ContextPlatformConfig[]
  onPublished?: () => void
}

const VERTICAL_LABELS: Record<string, string> = {
  insurance: 'Insurance',
  tax: 'Tax & advisory',
  ecommerce: 'Commerce',
  real_estate: 'Property',
  agency: 'Agency',
  technology: 'Technology',
  fashion: 'Fashion',
  wholesale: 'Wholesale',
  healthcare: 'Healthcare',
  education: 'Education',
}

const SERVICE_GROUPS = [
  { value: 'insurance', label: 'Primary' },
  { value: 'tax', label: 'Secondary' },
  { value: 'other', label: 'General' },
] as const

function defaultServiceType(vertical?: string): string {
  if (vertical === 'insurance') return 'insurance'
  if (vertical === 'tax') return 'tax'
  return 'other'
}

function normalizeServices(typeSort: TenantContextDraft['industry']['typeSort']): ServiceRow[] {
  return normalizeIndustryInput({ typeSort }).typeSort || []
}

function platformMeta(platform: string) {
  const known: Record<string, { prefix: string; placeholder: string }> = {
    INSTAGRAM: { prefix: '@', placeholder: 'username' },
    INSTAGRAM_DM: { prefix: '@', placeholder: 'username' },
    FACEBOOK_DM: { prefix: '', placeholder: 'page name' },
    YOUTUBE: { prefix: '@', placeholder: 'channel' },
    TELEGRAM: { prefix: '@', placeholder: 'username' },
    WHATSAPP: { prefix: '+', placeholder: '15551234567' },
    EMAIL: { prefix: '', placeholder: 'you@business.com' },
    WEBSITE: { prefix: '', placeholder: 'https://' },
  }
  return known[platform] || { prefix: '@', placeholder: 'handle' }
}

export default function PublishBusinessEditor({
  tenant,
  activeSection,
  socialPlatforms,
  messagingPlatforms,
  otherPlatforms,
  onPublished,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [dirty, setDirty] = useState(false)
  const skipAutosave = useRef(true)
  const importRef = useRef<HTMLInputElement | null>(null)

  const [draft, setDraft] = useState<TenantContextDraft>(() => ({
    vertical: tenant.contextVertical || '',
    core: (tenant.contextCoreJson as TenantContextDraft['core']) || {},
    industry: normalizeIndustryInput(
      tenant.contextIndustryJson as TenantContextDraft['industry'],
    ),
    social: (tenant.contextSocialJson as TenantContextDraft['social']) || {},
    blog:
      ((tenant.compactProfileJson as { blog?: TenantContextDraft['blog'] } | null)?.blog) ||
      {},
  }))

  const [socialPlatform, setSocialPlatform] = useState('')
  const [socialHandle, setSocialHandle] = useState('')

  const platformOptions = useMemo(() => {
    const items = [...socialPlatforms, ...messagingPlatforms, ...otherPlatforms]
    return items.length ? items : [{ platform: 'INSTAGRAM', title: 'Instagram' } as ContextPlatformConfig]
  }, [socialPlatforms, messagingPlatforms, otherPlatforms])

  const activePlatform = socialPlatform || platformOptions[0]?.platform || 'INSTAGRAM'
  const activeMeta = platformMeta(activePlatform)
  const services = normalizeServices(draft.industry.typeSort)
  const businessName = tenant.publishProfile?.name || tenant.name
  const isLive = tenant.contextStatus === 'PUBLISHED'

  const compactPreview = useMemo(
    () =>
      JSON.stringify(
        buildCompactProfile(tenant.name, tenant.publishProfile?.name ?? null, draft, []).compact,
        null,
        2,
      ),
    [draft, tenant.name, tenant.publishProfile?.name],
  )

  const persistDraft = async (silent: boolean) => {
    setSaveState('saving')
    const result = await saveTenantContextDraft(tenant.id, draft)
    if (!result.success) {
      setSaveState('idle')
      if (!silent) toast.error(result.error || 'Could not save draft')
      return false
    }
    setDirty(false)
    setSaveState('saved')
    return true
  }

  useEffect(() => {
    if (skipAutosave.current) {
      skipAutosave.current = false
      return
    }
    setDirty(true)
    setSaveState('idle')
    const timer = window.setTimeout(() => {
      void persistDraft(true)
    }, 1400)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist latest draft after edits
  }, [draft])

  const updateDraft = (updater: (prev: TenantContextDraft) => TenantContextDraft) => {
    setDraft(updater)
  }

  const addService = () => {
    updateDraft((prev) => ({
      ...prev,
      industry: {
        ...prev.industry,
        typeSort: [
          ...normalizeServices(prev.industry.typeSort),
          {
            type: defaultServiceType(prev.vertical),
            category: '',
            title: '',
            description: '',
            detailsShort: '',
            detailsLong: '',
            price: '',
            sortOrder: normalizeServices(prev.industry.typeSort).length + 1,
            isActive: true,
          },
        ],
      },
    }))
  }

  const updateService = (
    index: number,
    key: keyof ServiceRow,
    value: string | number | boolean,
  ) => {
    updateDraft((prev) => {
      const next = normalizeServices(prev.industry.typeSort)
      next[index] = { ...next[index], [key]: value }
      return { ...prev, industry: { ...prev.industry, typeSort: next } }
    })
  }

  const removeService = (index: number) => {
    updateDraft((prev) => ({
      ...prev,
      industry: {
        ...prev.industry,
        typeSort: normalizeServices(prev.industry.typeSort).filter((_, i) => i !== index),
      },
    }))
  }

  const addSocial = () => {
    const handle = socialHandle.trim().replace(/^@/, '')
    if (!handle) return
    updateDraft((prev) => ({
      ...prev,
      social: {
        ...prev.social,
        socials: [...(prev.social.socials || []), { platform: activePlatform, handle }],
      },
    }))
    setSocialHandle('')
  }

  const publish = () => {
    startTransition(async () => {
      const saved = await persistDraft(true)
      if (!saved) return
      const result = await publishTenantContext(tenant.id)
      if (!result.success) {
        toast.error(result.error || 'Could not publish')
        return
      }
      toast.success('Published to website')
      onPublished?.()
    })
  }

  const importServices = async (file: File) => {
    const content = await file.text()
    const lower = file.name.toLowerCase()
    const format = lower.endsWith('.sql') ? 'sql' : lower.endsWith('.csv') ? 'csv' : 'auto'
    startTransition(async () => {
      const result = await importServicesCatalogToTenant(tenant.id, { content, format })
      if (!result.success) {
        toast.error(result.error || 'Import failed')
        return
      }
      updateDraft((prev) => ({
        ...prev,
        industry: { ...prev.industry, typeSort: result.typeSort || [] },
      }))
      toast.success(`Imported ${result.importedCount || 0} services`)
    })
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="min-h-0 flex-1 space-y-6">
        {activeSection === 'about' ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold">About</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                What the website shows for this workspace.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Business name</Label>
              <Input value={businessName} readOnly className="bg-muted/40" />
              <p className="text-[11px] text-muted-foreground">
                Comes from the linked publish profile.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="publish-vertical">Industry</Label>
              <select
                id="publish-vertical"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.vertical || ''}
                onChange={(e) => updateDraft((prev) => ({ ...prev, vertical: e.target.value }))}
              >
                <option value="">Select industry</option>
                {INDUSTRY_VERTICALS.map((vertical) => (
                  <option key={vertical} value={vertical}>
                    {VERTICAL_LABELS[vertical] || vertical}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="publish-summary">Short pitch</Label>
              <Textarea
                id="publish-summary"
                value={draft.industry.summary || ''}
                onChange={(e) =>
                  updateDraft((prev) => ({
                    ...prev,
                    industry: { ...prev.industry, summary: e.target.value },
                  }))
                }
                placeholder="2–4 lines on what you sell and who it is for."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publish-website">Website</Label>
              <Input
                id="publish-website"
                value={draft.social.websiteUrl || ''}
                onChange={(e) =>
                  updateDraft((prev) => ({
                    ...prev,
                    social: { ...prev.social, websiteUrl: e.target.value },
                  }))
                }
                placeholder="https://yourbusiness.com"
              />
            </div>
          </section>
        ) : null}

        {activeSection === 'services' ? (
          <section className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Services</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Title, short text, price, and whether it is listed.
                </p>
              </div>
              <Button type="button" size="sm" onClick={addService}>
                <Plus className="mr-1 size-4" />
                Add service
              </Button>
            </div>
            {services.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                No services yet. Add one for the website catalog.
              </p>
            ) : null}
            {services.map((service, index) => (
              <div key={`service-${index}`} className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Service {index + 1}</p>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={service.isActive ?? true}
                        onCheckedChange={(checked) => updateService(index, 'isActive', checked)}
                        aria-label={`List ${service.title || `service ${index + 1}`}`}
                      />
                      Listed
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeService(index)}
                      aria-label={`Remove service ${index + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Title</Label>
                    <Input
                      value={service.title || ''}
                      placeholder="Home insurance review"
                      onChange={(e) => updateService(index, 'title', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Price</Label>
                    <Input
                      value={service.price || ''}
                      placeholder="89.99"
                      onChange={(e) => updateService(index, 'price', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Group</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={service.type || defaultServiceType(draft.vertical)}
                      onChange={(e) => updateService(index, 'type', e.target.value)}
                    >
                      {SERVICE_GROUPS.map((group) => (
                        <option key={group.value} value={group.value}>
                          {group.label}
                        </option>
                      ))}
                      {service.type &&
                      !SERVICE_GROUPS.some((group) => group.value === service.type) ? (
                        <option value={service.type}>{service.type}</option>
                      ) : null}
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Short text</Label>
                    <Textarea
                      value={service.description || ''}
                      placeholder="What the customer gets."
                      onChange={(e) => updateService(index, 'description', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Category</Label>
                    <Input
                      value={service.category || ''}
                      placeholder="Optional grouping"
                      onChange={(e) => updateService(index, 'category', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {activeSection === 'policies' ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Policies</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Terms and legal text the website and agents can reuse.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="publish-terms">Terms and conditions</Label>
              <Textarea
                id="publish-terms"
                className="min-h-[220px]"
                value={draft.core.termsAndConditions || ''}
                onChange={(e) =>
                  updateDraft((prev) => ({
                    ...prev,
                    core: { ...prev.core, termsAndConditions: e.target.value },
                  }))
                }
                placeholder="Write your terms in plain language."
              />
            </div>
          </section>
        ) : null}

        {activeSection === 'social' ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Social</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Public handles stored on the workspace profile.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={activePlatform} onValueChange={setSocialPlatform}>
                <SelectTrigger className="sm:w-[180px]">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  {platformOptions.map((item) => (
                    <SelectItem key={item.platform} value={item.platform}>
                      {item.title || item.platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={socialHandle}
                onChange={(e) => setSocialHandle(e.target.value)}
                placeholder={
                  activeMeta.prefix
                    ? `${activeMeta.prefix}${activeMeta.placeholder}`
                    : activeMeta.placeholder
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSocial()
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addSocial}>
                <Plus className="mr-1 size-4" />
                Add
              </Button>
            </div>
            {(draft.social.socials || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No public handles yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {(draft.social.socials || []).map((item, index) => (
                  <li
                    key={`${item.platform}-${item.handle}-${index}`}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {platformOptions.find((p) => p.platform === item.platform)?.title ||
                          item.platform}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.handle || item.url}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        updateDraft((prev) => ({
                          ...prev,
                          social: {
                            ...prev.social,
                            socials: (prev.social.socials || []).filter((_, i) => i !== index),
                          },
                        }))
                      }
                      aria-label={`Remove ${item.platform} handle`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {activeSection === 'advanced' ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Advanced</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Import, optional blog copy, and the published JSON snapshot.
              </p>
            </div>
            <div className="space-y-2 rounded-lg border border-border p-4">
              <p className="text-sm font-medium">Import services</p>
              <p className="text-xs text-muted-foreground">CSV or SQL. Replaces the current catalog.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => importRef.current?.click()}
                disabled={isPending}
              >
                Import CSV / SQL
              </Button>
              <input
                ref={importRef}
                type="file"
                accept=".sql,.csv,text/csv,text/plain"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  void importServices(file)
                  event.target.value = ''
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publish-blog">Blog intro</Label>
              <Textarea
                id="publish-blog"
                value={draft.blog?.intro || ''}
                onChange={(e) =>
                  updateDraft((prev) => ({
                    ...prev,
                    blog: { ...prev.blog, intro: e.target.value },
                  }))
                }
                placeholder="Optional intro for partner-site blog blocks."
              />
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p>Workspace: {tenant.name}</p>
              <p>Status: {tenant.contextStatus}</p>
              <p>Version: {tenant.contextVersion || 'not published'}</p>
              <p>Services in draft: {services.length}</p>
            </div>
            <Textarea
              readOnly
              value={compactPreview}
              className="min-h-[240px] font-mono text-xs"
              aria-label="Published JSON preview"
            />
          </section>
        ) : null}
      </div>

      <div className="sticky bottom-0 mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 py-3 backdrop-blur">
        <p className="text-xs text-muted-foreground">
          {saveState === 'saving'
            ? 'Saving…'
            : dirty
              ? 'Unsaved edits'
              : saveState === 'saved'
                ? 'Draft saved'
                : isLive
                  ? 'Live on website'
                  : 'Not published yet'}
          {isLive && dirty ? ' · unpublished changes' : ''}
        </p>
        <Button type="button" onClick={publish} disabled={isPending}>
          {isPending ? 'Publishing…' : 'Publish to website'}
        </Button>
      </div>
    </div>
  )
}
