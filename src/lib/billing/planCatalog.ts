/**
 * The six plans sold to creators and the add-on modules they are built from. Pure data, so the
 * server (billing) and the picker (client) read the same catalog. Prices here are what is shown and
 * charged: one-time plans charge `amountCents` directly; monthly plans use a Stripe price found by
 * `lookupKey` (created on first use). Changing a monthly price means a new lookup key (`_v2`), so
 * existing subscribers keep the price they signed up for.
 *
 * Every plan includes Launchpad. Signal, Autopilot and Mission Control also include Liftoff's setup;
 * Supernova's 3D site replaces the basic one.
 */

export type PlatformPackageId = 'LAUNCHPAD' | 'LIFTOFF' | 'SIGNAL' | 'AUTOPILOT' | 'MISSION_CONTROL' | 'SUPERNOVA'

export type PlanModuleId =
  | 'SITEFORGE'
  | 'LEADRADAR'
  | 'VOICEPILOT'
  | 'REELHOUSE'
  | 'SOCIALPULSE'
  | 'ADMIND'
  | 'DEPTH3D'
  | 'CAMPAIGNDROP'

export type PlanBilling = 'one_time' | 'month'

export type PlanModuleMeta = {
  name: string
  description: string
  group: PlanModuleGroup
}

export type PlanModuleGroup = 'Website & leads' | 'AI' | 'Agency marketing' | 'Brand marketing'

export type PlatformPackageMeta = {
  name: string
  /** What kind of plan this is, shown as a label (e.g. "Full integration"). */
  track: string
  tagline: string
  features: string[]
  amountCents: number
  billing: PlanBilling
  /** Stripe price lookup key (monthly plans subscribe to it; one-time plans only record it). */
  lookupKey: string
  /** Add-on modules switched on in this plan, on top of Launchpad. */
  modules: PlanModuleId[]
  /** Plans whose contents this plan already covers (Launchpad is in all of them). */
  includes: PlatformPackageId[]
  /** One-time plan whose fee this monthly plan waives. */
  waivesSetup?: PlatformPackageId
  /** Minimum term in months; cancelling earlier is not offered. */
  minimumMonths?: number
}

/** Cheapest first: the picker and the price ladder both read this order. */
export const PLATFORM_PACKAGE_IDS: readonly PlatformPackageId[] = [
  'LAUNCHPAD',
  'LIFTOFF',
  'SIGNAL',
  'AUTOPILOT',
  'MISSION_CONTROL',
  'SUPERNOVA',
]

export const PLAN_MODULE_IDS: readonly PlanModuleId[] = [
  'SITEFORGE',
  'LEADRADAR',
  'VOICEPILOT',
  'REELHOUSE',
  'SOCIALPULSE',
  'ADMIND',
  'DEPTH3D',
  'CAMPAIGNDROP',
]

export const PLAN_MODULES: Record<PlanModuleId, PlanModuleMeta> = {
  SITEFORGE: {
    name: 'SiteForge',
    description: 'Business website: 5 pages, mobile, your domain, SEO basics',
    group: 'Website & leads',
  },
  LEADRADAR: {
    name: 'LeadRadar',
    description: '200 researched leads a month, AI email & WhatsApp follow-ups',
    group: 'Website & leads',
  },
  VOICEPILOT: {
    name: 'VoicePilot',
    description: 'Chat + Voice AI on your own server, voice website tour',
    group: 'AI',
  },
  REELHOUSE: {
    name: 'ReelHouse',
    description: '3 short marketing videos a month',
    group: 'Agency marketing',
  },
  SOCIALPULSE: {
    name: 'SocialPulse',
    description: '12 social posts a month on 3 channels',
    group: 'Agency marketing',
  },
  ADMIND: {
    name: 'AdMind',
    description: 'AI ad copy and an email campaign every month',
    group: 'Agency marketing',
  },
  DEPTH3D: {
    name: 'Depth3D',
    description: '3D brand website built with GSAP and three.js',
    group: 'Brand marketing',
  },
  CAMPAIGNDROP: {
    name: 'CampaignDrop',
    description: 'One brand campaign every month',
    group: 'Brand marketing',
  },
}

export const PLAN_MODULE_GROUPS: readonly PlanModuleGroup[] = ['Website & leads', 'AI', 'Agency marketing', 'Brand marketing']

/** What Launchpad sets up; shown as the row that is always on. */
export const LAUNCHPAD_SUMMARY = 'Stripe payments, products & webinars, AI chat, share link and lead capture'

export const PLATFORM_PACKAGES: Record<PlatformPackageId, PlatformPackageMeta> = {
  LAUNCHPAD: {
    name: 'Launchpad',
    track: 'Main pack',
    tagline: 'We set up your sts-ai business for you.',
    features: [
      'Stripe payments connected to your account',
      'Your products and webinars added',
      'AI chat assistant trained on your business',
      'Share link with lead capture (email or WhatsApp)',
    ],
    amountCents: 4900,
    billing: 'one_time',
    lookupKey: 'sts_launchpad_v1',
    modules: [],
    includes: [],
  },
  LIFTOFF: {
    name: 'Liftoff',
    track: 'Business website',
    tagline: 'Launchpad plus a business website, built and published.',
    features: [
      'Everything in Launchpad',
      'SiteForge: business website, up to 5 pages',
      'Mobile-ready, connected to your own domain',
      'SEO basics and a lead form that sends to your inbox',
    ],
    amountCents: 7900,
    billing: 'one_time',
    lookupKey: 'sts_liftoff_v1',
    modules: ['SITEFORGE'],
    includes: ['LAUNCHPAD'],
  },
  SIGNAL: {
    name: 'Signal',
    track: 'Lead engine',
    tagline: 'Your website, plus new leads found and followed up every month.',
    features: [
      'Everything in Liftoff',
      'LeadRadar: 200 researched leads a month',
      'AI email and WhatsApp follow-up sequences',
      'Monthly report: leads, replies and sales',
    ],
    amountCents: 11900,
    billing: 'month',
    lookupKey: 'sts_signal_monthly_v1',
    modules: ['SITEFORGE', 'LEADRADAR'],
    includes: ['LAUNCHPAD', 'LIFTOFF'],
    waivesSetup: 'LIFTOFF',
  },
  AUTOPILOT: {
    name: 'Autopilot',
    track: 'Full integration',
    tagline: 'Every AI tool on your own server, run with you every month.',
    features: [
      'Everything in Signal',
      'VoicePilot: Chat AI and Voice AI trained on your business',
      'Your own VPS: hosting, database, backups and monitoring',
      'Voice-guided tour of your website',
      '400 voice minutes a month, then $0.08 a minute',
    ],
    amountCents: 19900,
    billing: 'month',
    lookupKey: 'sts_autopilot_monthly_v1',
    modules: ['SITEFORGE', 'LEADRADAR', 'VOICEPILOT'],
    includes: ['LAUNCHPAD', 'LIFTOFF', 'SIGNAL'],
    waivesSetup: 'LIFTOFF',
  },
  MISSION_CONTROL: {
    name: 'Mission Control',
    track: 'Digital agency',
    tagline: 'Your full digital agency: AI, video, social and marketing.',
    features: [
      'Everything in Autopilot',
      'ReelHouse: 3 short marketing videos a month',
      'SocialPulse: 12 posts a month on 3 channels',
      'AdMind: AI ad copy and a monthly email campaign',
      'Monthly strategy call',
    ],
    amountCents: 39900,
    billing: 'month',
    lookupKey: 'sts_mission_control_monthly_v1',
    modules: ['SITEFORGE', 'LEADRADAR', 'VOICEPILOT', 'REELHOUSE', 'SOCIALPULSE', 'ADMIND'],
    includes: ['LAUNCHPAD', 'LIFTOFF', 'SIGNAL', 'AUTOPILOT'],
    waivesSetup: 'LIFTOFF',
  },
  SUPERNOVA: {
    name: 'Supernova',
    track: 'Brand marketing',
    tagline: 'A 3D brand website and a new campaign every month.',
    features: [
      'Everything in Launchpad',
      'Depth3D: 3D brand website with GSAP and three.js',
      'Custom 3D scene and scroll animations, build included',
      'CampaignDrop: one brand campaign a month',
      'Ad creatives and a launch video for each campaign',
    ],
    amountCents: 44900,
    billing: 'month',
    lookupKey: 'sts_supernova_monthly_v1',
    modules: ['DEPTH3D', 'CAMPAIGNDROP'],
    includes: ['LAUNCHPAD'],
    minimumMonths: 6,
  },
}

export function isPlatformPackageId(value: unknown): value is PlatformPackageId {
  return PLATFORM_PACKAGE_IDS.includes(value as PlatformPackageId)
}

export function isOneTimePackage(packageId: PlatformPackageId): boolean {
  return PLATFORM_PACKAGES[packageId].billing === 'one_time'
}

/** Payments made under the earlier four-plan catalog, mapped to the plan that replaced them. */
export const LEGACY_ONE_TIME_PACKAGES: Record<string, PlatformPackageId> = {
  SETUP: 'LAUNCHPAD',
  AI_SETUP: 'LIFTOFF',
}

/**
 * The plan the picker moves to when a module switch flips.
 * On: the cheapest plan with everything the current plan has plus the module, else the cheapest
 * plan with the module (switching to another track, e.g. Brand marketing).
 * Off: the plan that keeps the most of what is left without the module (ties: the cheaper one).
 */
export function planForModuleToggle(
  current: PlatformPackageId,
  moduleId: PlanModuleId,
  on: boolean,
): PlatformPackageId {
  const has = (plan: PlatformPackageId, modules: readonly PlanModuleId[]) =>
    modules.every((module) => PLATFORM_PACKAGES[plan].modules.includes(module))
  const currentModules = PLATFORM_PACKAGES[current].modules

  if (on) {
    const wanted = [...currentModules, moduleId]
    return (
      PLATFORM_PACKAGE_IDS.find((plan) => has(plan, wanted)) ??
      PLATFORM_PACKAGE_IDS.find((plan) => has(plan, [moduleId])) ??
      current
    )
  }

  const remaining = currentModules.filter((module) => module !== moduleId)
  let best: PlatformPackageId = 'LAUNCHPAD'
  for (const plan of PLATFORM_PACKAGE_IDS) {
    const modules = PLATFORM_PACKAGES[plan].modules
    const fits = modules.every((module) => remaining.includes(module))
    if (fits && modules.length > PLATFORM_PACKAGES[best].modules.length) best = plan
  }
  return best
}
