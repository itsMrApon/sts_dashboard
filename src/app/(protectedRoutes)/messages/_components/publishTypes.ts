export type PublishNavSection =
  | 'about'
  | 'services'
  | 'policies'
  | 'social'
  | 'advanced'

export type ContextPlatformConfig = {
  platform: string
  title: string
  shortLabel: string
  color: string
  description: string
  category: 'social' | 'messaging' | 'other'
  fields: { key: string; label: string; placeholder: string; type?: 'text' | 'password' }[]
  hasPageUrl?: boolean
  pageUrlLabel?: string
  pageUrlPlaceholder?: string
}
