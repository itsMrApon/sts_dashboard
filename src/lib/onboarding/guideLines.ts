/**
 * What the setup wizard says on each card. Spoken with the creator's Cartesia voice and shown as
 * text. {name} = business name, {agent} = the agent just built.
 */
export const GUIDE_LINES = {
  name: "Hi, I'm your setup wizard. Let's start with your business name.",
  type: 'What kind of business is {name}?',
  location: 'Where is it based?',
  service: 'Now your first agent. Which service should it run?',
  tags: 'Add a tag or two so we can find you online later. A username or a website works.',
  goals: 'What should it do?',
  tone: 'How should it sound?',
  language: 'Which language should it speak?',
  ready: '{agent} is ready.',
  tools: 'These are the tools your agents can use. Connect them whenever you like.',
  leads: 'Leads come from Google Maps, your calls and your calendar. Connect them whenever you like.',
  finish: "That's it. You can add more providers any time in Config.",
} as const

export type GuideLineId = keyof typeof GUIDE_LINES
export type GuideVars = { name?: string; agent?: string }

export function isGuideLineId(value: unknown): value is GuideLineId {
  return typeof value === 'string' && Object.hasOwn(GUIDE_LINES, value)
}

/** The line with its names filled in (kept as typed, Bangla included). */
export function guideLine(id: GuideLineId, vars: GuideVars = {}): string {
  return GUIDE_LINES[id]
    .replace('{name}', vars.name?.trim().slice(0, 80) || 'your business')
    .replace('{agent}', vars.agent?.trim().slice(0, 80) || 'Your agent')
}
