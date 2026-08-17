export type PublicService = {
  id: number
  title: string
  type: string
  category_id: number
  description: string
  details_short: string
  details_long: string
  price: string
  image_1: string | null
  image_2: string | null
  image_3: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
  category: {
    id: number
    name: string
    type: string
    description: string
    icon: string
    is_active: boolean
    sort_order: number
    created_at: string
    updated_at: string
  }
}

const FALLBACK_DATE = new Date(0).toISOString()

const toLowerText = (value: unknown) => String(value ?? '').toLowerCase()

const looksInvalidText = (value: string) => {
  const normalized = value.trim().toLowerCase()
  return !normalized || normalized === '[object object]' || normalized === 'undefined' || normalized === 'null'
}

const textFromUnknown = (value: unknown): string => {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return looksInvalidText(normalized) ? '' : normalized
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const nested = record.text ?? record.value ?? record.label ?? record.description ?? record.summary
    if (typeof nested === 'string' && nested.trim()) return nested.trim()
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return ''
}

const firstNonEmptyText = (...values: unknown[]) => {
  for (const value of values) {
    const text = textFromUnknown(value)
    if (text) return text
  }
  return ''
}

const toTitle = (value: string) =>
  value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim()

function normalizeService(
  item: Record<string, unknown>,
  type: string,
  categoryName: string,
  index: number,
): PublicService {
  const title = firstNonEmptyText(item.title, item.name) || `Service ${index + 1}`
  const description = firstNonEmptyText(item.description, item.summary, title) || title
  const detailsShort = firstNonEmptyText(
    item.details_short,
    item.detailsShort,
    item.short_description,
    item.shortDescription,
    item.summary,
    description,
  )
  const detailsLong = firstNonEmptyText(
    item.details_long,
    item.detailsLong,
    item.long_description,
    item.longDescription,
    item.description,
    description,
  )
  const idValue = Number(item.id)
  const serviceId = Number.isFinite(idValue) ? idValue : index + 1
  const categoryId = Math.abs(categoryName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0))

  return {
    id: serviceId,
    title,
    type,
    category_id: categoryId,
    description,
    details_short: detailsShort,
    details_long: detailsLong,
    price: String(item.price ?? ''),
    image_1: typeof item.image_1 === 'string' ? item.image_1 : null,
    image_2: typeof item.image_2 === 'string' ? item.image_2 : null,
    image_3: typeof item.image_3 === 'string' ? item.image_3 : null,
    is_active: item.is_active === false ? false : true,
    sort_order: Number(item.sort_order ?? item.sortOrder ?? index + 1),
    created_at: String(item.created_at ?? FALLBACK_DATE),
    updated_at: String(item.updated_at ?? FALLBACK_DATE),
    category: {
      id: categoryId,
      name: categoryName,
      type,
      description: '',
      icon: '',
      is_active: true,
      sort_order: 1,
      created_at: FALLBACK_DATE,
      updated_at: FALLBACK_DATE,
    },
  }
}

function extractServicesByCategory(
  industryPayload: Record<string, unknown> | null,
  type: string,
): Record<string, PublicService[]> {
  const result: Record<string, PublicService[]> = {}
  if (!industryPayload || typeof industryPayload !== 'object') return result

  let globalIndex = 0
  const skipArrayKeys = new Set(['servicecatalog', 'typesort'])
  for (const [key, value] of Object.entries(industryPayload)) {
    if (!Array.isArray(value)) continue
    if (skipArrayKeys.has(key.toLowerCase())) continue
    const normalizedType = toLowerText(type)
    const keyText = toLowerText(key)
    if (
      normalizedType !== 'all' &&
      !keyText.includes(normalizedType) &&
      !value.some((item) => toLowerText((item as Record<string, unknown>)?.type).includes(normalizedType))
    ) {
      continue
    }
    const categoryName = key.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    const services = value
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => normalizeService(item, type, categoryName, globalIndex++))
    if (services.length > 0) result[categoryName] = services
  }

  return result
}

function extractServicesFromStructuredResource(
  payload: Record<string, unknown> | null,
  type: string,
): Record<string, PublicService[]> {
  if (!payload || typeof payload !== 'object') return {}

  const candidates: unknown[] = [
    payload.services_by_category,
    payload.servicesByCategory,
    payload.categories,
    payload.services,
  ]

  let globalIndex = 0
  const result: Record<string, PublicService[]> = {}
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    for (const [categoryNameRaw, values] of Object.entries(candidate as Record<string, unknown>)) {
      if (!Array.isArray(values)) continue
      const categoryName = toTitle(categoryNameRaw)
      const services = values
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .filter((item) => {
          if (type === 'all') return true
          const itemType = toLowerText(item.type)
          const categoryType = toLowerText(categoryNameRaw)
          return itemType.includes(type) || categoryType.includes(type)
        })
        .map((item) => normalizeService(item, type, categoryName, globalIndex++))
      if (services.length > 0) result[categoryName] = services
    }
  }
  return result
}

function extractServicesFromCatalogArray(
  payload: Record<string, unknown> | null,
  type: string,
): Record<string, PublicService[]> {
  if (!payload || typeof payload !== 'object') return {}
  const items = Array.isArray(payload.typeSort)
    ? payload.typeSort
    : Array.isArray(payload.serviceCatalog)
      ? payload.serviceCatalog
      : null
  if (!items) return {}

  const result: Record<string, PublicService[]> = {}
  let globalIndex = 0

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const rowType = toLowerText(row.type || 'insurance')
    if (type !== 'all' && rowType !== type) continue
    if (row.isActive === false) continue

    const typeName = toTitle(String(row.type || 'insurance'))
    if (!result[typeName]) result[typeName] = []
    result[typeName].push(normalizeService(row, rowType, typeName, globalIndex++))
  }

  return result
}

function extractServicesFromCompactIndustryArrays(
  industryPayload: Record<string, unknown> | null,
  type: string,
): Record<string, PublicService[]> {
  if (!industryPayload || typeof industryPayload !== 'object') return {}

  const keyTypeHints: Record<string, 'insurance' | 'tax' | 'other' | 'all'> = {
    coverageTypes: 'insurance',
    exclusions: 'insurance',
    filingTypes: 'tax',
    deadlines: 'tax',
    catalog: 'other',
    deliverables: 'other',
    servicePackages: 'all',
    areas: 'all',
    budgetBands: 'all',
    propertyTypes: 'all',
  }

  const summary = String(industryPayload.summary ?? '').trim()
  const result: Record<string, PublicService[]> = {}
  let globalIndex = 0

  for (const [key, value] of Object.entries(industryPayload)) {
    if (!Array.isArray(value)) continue
    const hint = keyTypeHints[key] ?? 'all'
    if (type !== 'all' && hint !== 'all' && hint !== type) continue

    const items = value
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean)
      .map((entry) =>
        normalizeService(
          {
            title: entry,
            description: summary || `${entry} service details from tenant compact profile.`,
            details_short: summary || entry,
            details_long: summary || `${entry} information.`,
          },
          hint === 'all' ? type : hint,
          toTitle(key),
          globalIndex++,
        ),
      )

    if (items.length > 0) result[toTitle(key)] = items
  }

  return result
}

export function extractServicesFromIndustry(
  industryPayload: Record<string, unknown> | null,
  type = 'all',
): Record<string, PublicService[]> {
  const serviceType = type.trim().toLowerCase() || 'all'

  let servicesByCategory = extractServicesByCategory(industryPayload, serviceType)
  if (Object.keys(servicesByCategory).length === 0) {
    servicesByCategory = extractServicesFromStructuredResource(industryPayload, serviceType)
  }
  if (Object.keys(servicesByCategory).length === 0) {
    servicesByCategory = extractServicesFromCatalogArray(industryPayload, serviceType)
  }
  if (Object.keys(servicesByCategory).length === 0) {
    servicesByCategory = extractServicesFromCompactIndustryArrays(industryPayload, serviceType)
  }

  return servicesByCategory
}

export function buildServicesResponse(
  workspaceId: string,
  contextVersion: string | null,
  industryPayload: Record<string, unknown> | null,
  type = 'all',
) {
  const serviceType = type.trim().toLowerCase() || 'all'
  const services_by_category = extractServicesFromIndustry(industryPayload, serviceType)
  const categoryCount = Object.keys(services_by_category).length
  const totalServices = Object.values(services_by_category).reduce((count, services) => count + services.length, 0)

  return {
    success: true,
    workspaceId,
    contextVersion,
    type: serviceType,
    services_by_category,
    meta: { categoryCount, totalServices },
  }
}
