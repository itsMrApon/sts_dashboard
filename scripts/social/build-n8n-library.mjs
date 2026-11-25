#!/usr/bin/env node
/**
 * Builds src/lib/social/library/items/n8nWorkflows.generated.ts from the Zie619/n8n-workflows
 * search index (docs/api/search-index.json, MIT). Picks the social, content and media workflows,
 * then draws each one as a diagram from the services it uses.
 *
 *   gh api -H 'Accept: application/vnd.github.raw' \
 *     repos/Zie619/n8n-workflows/contents/docs/api/search-index.json > /tmp/n8n-index.json
 *   node scripts/social/build-n8n-library.mjs /tmp/n8n-index.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const input = process.argv[2]
if (!input) {
  console.error('Usage: node scripts/social/build-n8n-library.mjs <search-index.json>')
  process.exit(1)
}
const OUT = resolve(process.cwd(), 'src/lib/social/library/items/n8nWorkflows.generated.ts')
const MAX = 130

const index = JSON.parse(readFileSync(input, 'utf8'))

const SOCIAL_CATEGORIES = new Set([
  'Social Media Management',
  'Creative Content & Video Automation',
  'Creative Design Automation',
  'Marketing & Advertising Automation',
])
const SOCIAL_NAME =
  /instagram|tiktok|youtube|linkedin|twitter|tweet|\bx\b|facebook|whatsapp|social|video|reel|shorts|pinterest|reddit|wordpress|blog|thumbnail|elevenlabs|heygen|runway|creatomate|bannerbear|canva|newsletter|carousel|caption|hashtag|seo|podcast|ugc|avatar|influencer|marketing|threads|bluesky|medium|ghost|dall|midjourney|flux|kling|leonardo|stability|replicate|image|article|content|post|ads?\b|brand|story|meme|voice/i
const OFF_TOPIC = /invoice|payroll|accounting|resume|interview|hr\b|kubernetes|backup|weather|crypto|stock|github issue|jira|error handler|test workflow|^untitled|my workflow|^workflow \d|email headers|spoof|netflix|license plate|strapi|larksuite|\bsms\b|sendgrid|iterable|e-goi|mailerlite|wallabag|postgres|supabase|odoo|certificate|gumroad|search console|auto-?responder|email management|email summary|email processing|\bimap\b|google maps|presentations per lead|training feedback|books from|email verification|subscriber|a new contact|messages from a topic|woocommerce ai chatbot|raindrop|3d|orthographic|virtual try-on|metadata tagging|jpg\/png|chrome extension|profile finder|profile discovery|topsourcer|profile collector|leads scraping|companies|zammad|entra|mattermost|influxdb|docker|anomaly|knn|syncro|dialpad|invite users|a member|xmltojson|lead qualification|qualify|property lead|batchdata|suitecrm|geländewagen|sitemap|knowledge base|calendar events|access token|voiceflow|phone agent|load prompts|coupon|customer-support|business bot|starter workflow|contact form|xmlrpc|squarespace/i

/* --------------------------------------------------------------- roles */

const AI = {
  OpenAI: 'OpenAI', Lmchatopenai: 'OpenAI', Lmopenai: 'OpenAI', Embeddingsopenai: 'OpenAI',
  Lmchatgooglegemini: 'Gemini', Googlegemini: 'Gemini', Embeddingsgooglegemini: 'Gemini',
  Anthropic: 'Claude', Lmchatanthropic: 'Claude',
  Lmchatopenrouter: 'OpenRouter', Lmchatmistralcloud: 'Mistral', Lmchatollama: 'Ollama',
  Lmchatdeepseek: 'DeepSeek', Lmchatgroq: 'Groq', Perplexity: 'Perplexity',
}
const AGENTISH = new Set(['Agent', 'Chainllm', 'Chainsummarization', 'Informationextractor', 'Textclassifier', 'Sentimentanalysis'])
const TRIGGER_LABEL = {
  'Form Trigger': ['Form', 'you fill it in'],
  Formtrigger: ['Form', 'you fill it in'],
  Webhook: ['Webhook', 'from your app'],
  Schedule: ['Schedule', 'runs on a timer'],
  Scheduletrigger: ['Schedule', 'runs on a timer'],
  Cron: ['Schedule', 'runs on a timer'],
  Rssfeedread: ['RSS feed', 'new articles'],
  Rssfeedreadtrigger: ['RSS feed', 'new articles'],
  Telegramtrigger: ['Telegram', 'you message the bot'],
  Chattrigger: ['Chat', 'you ask'],
  Googlesheetstrigger: ['Sheet row', 'new idea added'],
  Googledrivetrigger: ['Drive file', 'new upload'],
  Manual: ['Run', 'by hand'],
}
const OUTPUTS = {
  Youtube: ['YouTube', 'upload'], Facebook: ['Facebook', 'post'], Facebookgraphapi: ['Facebook / IG', 'Graph API'],
  Instagram: ['Instagram', 'post'], LinkedIn: ['LinkedIn', 'post'], Linkedin: ['LinkedIn', 'post'],
  Twitter: ['X', 'post'], Twittertool: ['X', 'post'], Wordpress: ['WordPress', 'draft'], Ghost: ['Ghost', 'post'],
  Medium: ['Medium', 'post'], Telegram: ['Telegram', 'send'], Telegramtool: ['Telegram', 'send'],
  Discord: ['Discord', 'send'], Discordtool: ['Discord', 'send'], Slack: ['Slack', 'send'],
  Gmail: ['Gmail', 'send'], Mailchimp: ['Mailchimp', 'campaign'], 'Google Drive': ['Google Drive', 'save'],
  'Google Sheets': ['Google Sheets', 'log'], Airtable: ['Airtable', 'log'], Notion: ['Notion', 'log'],
  Pinterest: ['Pinterest', 'pin'], Reddit: ['Reddit', 'post'], Whatsapp: ['WhatsApp', 'send'],
  Postgres: ['Postgres', 'store'], Nocodb: ['NocoDB', 'log'], Bannerbear: ['Bannerbear', 'render'],
  Editimage: ['Edit image', 'resize / text'], Hubspot: ['HubSpot', 'contact'],
}
const MEDIA_BY_NAME = [
  [/elevenlabs/i, 'ElevenLabs', 'voice'], [/kling/i, 'Kling', 'video'], [/runway/i, 'Runway', 'video'],
  [/creatomate/i, 'Creatomate', 'render'], [/heygen/i, 'HeyGen', 'avatar'], [/flux/i, 'FLUX', 'image'],
  [/midjourney/i, 'Midjourney', 'image'], [/dall[-\s]?e/i, 'DALL·E', 'image'], [/leonardo/i, 'Leonardo', 'image'],
  [/replicate/i, 'Replicate', 'model'], [/json2video/i, 'JSON2Video', 'render'], [/apify/i, 'Apify', 'scrape'],
  [/firecrawl/i, 'Firecrawl', 'scrape'], [/perplexity/i, 'Perplexity', 'research'],
]

const NEED_BY_INTEGRATION = {
  OpenAI: 'openai', Lmchatopenai: 'openai', Lmchatgooglegemini: 'gemini', Googlegemini: 'gemini',
  Anthropic: 'anthropic', Lmchatanthropic: 'anthropic', 'Google Drive': 'googleDrive', 'Google Sheets': 'googleSheets',
  Airtable: 'airtable', Notion: 'notion', Telegram: 'telegramBot', Telegramtool: 'telegramBot', Telegramtrigger: 'telegramBot',
  Discord: 'discord', Discordtool: 'discord', Slack: 'slack', Wordpress: 'wordpress', LinkedIn: 'linkedinApi',
  Linkedin: 'linkedinApi', Twitter: 'xApi', Twittertool: 'xApi', Youtube: 'youtubeApi', Facebook: 'metaGraph',
  Facebookgraphapi: 'metaGraph', Instagram: 'metaGraph', Bannerbear: 'bannerbear', Whatsapp: 'metaGraph',
}
const NEED_BY_NAME = [
  [/elevenlabs/i, 'elevenlabs'], [/kling/i, 'kling'], [/flux/i, 'flux'], [/creatomate/i, 'creatomate'],
  [/heygen/i, 'heygen'], [/apify/i, 'apify'], [/firecrawl/i, 'firecrawl'], [/gemini/i, 'gemini'],
  [/ffmpeg/i, 'ffmpeg'], [/comfy/i, 'comfyui'],
]

const CHANNEL_RULES = [
  ['instagram', /instagram|reels?\b|\big\b/i], ['tiktok', /tiktok/i], ['youtube', /youtube|shorts/i],
  ['facebook', /facebook/i], ['linkedin', /linkedin/i], ['x', /twitter|tweet|\bx\b/i],
  ['whatsapp', /whatsapp/i], ['telegram', /telegram/i], ['blog', /wordpress|blog|seo|article|ghost|medium/i],
  ['email', /gmail|email|newsletter|mailchimp/i],
]
const FORMAT_RULES = [
  ['video', /video|reel|shorts|tiktok|kling|runway|creatomate|heygen|json2video/i],
  ['image', /image|thumbnail|flux|dall|midjourney|bannerbear|editimage|leonardo|photo|picture/i],
  ['article', /blog|wordpress|seo|article|newsletter/i],
  ['audio', /podcast|elevenlabs|voice|tts|audio/i],
  ['carousel', /carousel/i],
  ['ads', /\bads?\b|advert/i],
  ['research', /scrap|research|summar|analy|monitor|trend|competitor|report/i],
  ['post', /post|linkedin|twitter|tweet|instagram|facebook|social/i],
]

/** Names n8n-workflows made up from the file name ("Splitout Editimage Automate Triggered"): skip them. */
const GENERIC_WORDS = new Set(
  'manual code splitout form http webhook schedule scheduled cron triggered trigger create update automate automation automated import export send process monitor sync report workflow noop filter wait aggregate stickynote executeworkflow functionitem function respondtowebhook datetime set if switch merge item lists limit stopanderror extractfromfile summarize readbinaryfile writebinaryfile'.split(' '),
)
const isGeneratedName = (name, integrations) => {
  const known = new Set(integrations.map((i) => i.toLowerCase().replace(/\s+/g, '')))
  return name
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .every((word) => GENERIC_WORDS.has(word) || known.has(word) || /^(youtube|editimage|telegram|linkedin|twitter|wordpress|openai|googlesheets|googledrive|airtable|slack|discord|gmail|hubspot|notion|facebook|instagram|bannerbear|mailchimp|rssfeedread|postgres|lmchatopenai)$/.test(word))
}

const clean = (s) =>
  s
    .replace(/^[\p{Extended_Pictographic}️\s]+/u, '')
    .replace(/\s+copy$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
const short = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

function describe(w) {
  const text = `${w.name} ${w.integrations.join(' ')}`
  const ints = w.integrations

  const triggerKey = ints.find((i) => TRIGGER_LABEL[i])
  const fallbackTrigger =
    w.trigger_type === 'Scheduled' ? 'Schedule' : w.trigger_type === 'Webhook' ? 'Webhook' : w.trigger_type === 'Manual' ? 'Manual' : null
  const [triggerLabel, triggerSub] = TRIGGER_LABEL[triggerKey ?? fallbackTrigger ?? ''] ?? ['Trigger', 'an app event']

  const ai = [...new Set(ints.map((i) => AI[i]).filter(Boolean))]
  const agent = ints.some((i) => AGENTISH.has(i))
  const media = MEDIA_BY_NAME.filter(([re]) => re.test(w.name)).map(([, l, s]) => ({ label: l, sub: s }))
  const outputs = []
  const seen = new Set()
  for (const i of ints) {
    const o = OUTPUTS[i]
    if (o && !seen.has(o[0]) && o[0] !== triggerLabel) {
      seen.add(o[0])
      outputs.push({ label: o[0], sub: o[1] })
    }
  }
  const httpCount = ints.filter((i) => /Httprequest|Httprequesttool/.test(i)).length

  const aiNode = ai.length
    ? { label: agent ? `${ai[0]} agent` : ai[0], sub: agent ? 'plans + writes' : 'writes', tag: 'AI', focal: true }
    : agent
      ? { label: 'AI agent', sub: 'plans + writes', tag: 'AI', focal: true }
      : null
  const trigger = { label: triggerLabel, sub: triggerSub, tag: 'TRIGGER' }
  const mediaNode = media[0]
    ? { label: media[0].label, sub: media[0].sub, tag: 'MEDIA', focal: !aiNode }
    : httpCount && !aiNode
      ? { label: 'HTTP API', sub: 'external service', tag: 'API', focal: true }
      : null

  let diagram
  const toolCount = ints.filter((i) => /tool$/i.test(i)).length
  if (agent && toolCount >= 2) {
    diagram = {
      type: 'hub',
      center: aiNode ?? { label: 'AI agent', tag: 'AI', focal: true },
      around: [trigger, ...(mediaNode ? [mediaNode] : []), ...outputs].slice(0, 6),
    }
  } else if (outputs.length >= 2) {
    diagram = {
      type: 'fan',
      source: trigger,
      via: aiNode ?? mediaNode ?? { label: 'n8n', sub: `${w.node_count} nodes`, tag: 'FLOW', focal: true },
      outputs: outputs.slice(0, 5),
    }
  } else {
    const nodes = [trigger]
    if (aiNode) nodes.push(aiNode)
    if (mediaNode) nodes.push(mediaNode)
    if (outputs[0]) nodes.push({ ...outputs[0], tag: 'OUTPUT' })
    if (nodes.length < 3) nodes.splice(1, 0, { label: 'n8n steps', sub: `${w.node_count} nodes`, tag: 'FLOW', focal: !aiNode && !mediaNode })
    diagram = { type: 'flow', nodes: nodes.slice(0, 5) }
  }

  const channels = CHANNEL_RULES.filter(([, re]) => re.test(text)).map(([c]) => c)
  const formats = FORMAT_RULES.filter(([, re]) => re.test(text)).map(([f]) => f)
  if (!formats.includes('automation')) formats.push('automation')

  const needs = new Set(['stsBrain', 'n8n'])
  for (const i of ints) if (NEED_BY_INTEGRATION[i]) needs.add(NEED_BY_INTEGRATION[i])
  for (const [re, n] of NEED_BY_NAME) if (re.test(w.name)) needs.add(n)
  if (['Webhook', 'Form Trigger', 'Formtrigger', 'Telegramtrigger', 'Chattrigger'].some((t) => ints.includes(t)) || w.trigger_type === 'Webhook')
    needs.add('tunnel')

  const parts = []
  parts.push(
    triggerLabel === 'Run'
      ? 'You run it'
      : triggerLabel === 'Schedule'
        ? 'Runs on a schedule'
        : triggerLabel === 'Trigger'
          ? 'Starts on an app event'
          : `Starts from ${/^[aeiou]/i.test(triggerLabel) ? 'an' : 'a'} ${triggerLabel}`,
  )
  if (aiNode) parts.push(`${aiNode.label} ${agent ? 'plans and writes' : 'writes'}`)
  if (media[0]) parts.push(`${media[0].label} makes the ${media[0].sub}`)
  if (outputs.length) parts.push(`then ${outputs.slice(0, 3).map((o) => o.label).join(', ')}`)
  const summary = `${parts.join(', ')}. ${w.node_count} nodes.`

  return { diagram, channels, formats, needs: [...needs], summary }
}

/* ------------------------------------------------------------ select */

const picked = []
const names = new Set()
const ranked = index.workflows
  .filter((w) => !OFF_TOPIC.test(w.name) && !isGeneratedName(w.name, w.integrations))
  .filter((w) => SOCIAL_NAME.test(w.name))
  .filter((w) => w.node_count >= 4)
  .map((w) => ({
    w,
    score:
      (SOCIAL_CATEGORIES.has(w.category) ? 3 : 0) +
      (/(video|reel|shorts|tiktok|instagram|youtube|linkedin|carousel|thumbnail|ugc|avatar|image)/i.test(w.name) ? 3 : 0) +
      (/(post|social|content|blog|seo|caption|twitter|facebook)/i.test(w.name) ? 2 : 0) +
      Math.min(w.node_count, 40) / 20,
  }))
  .sort((a, b) => b.score - a.score)

for (const { w } of ranked) {
  const title = clean(w.name)
  const key = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (!title || title.length < 8 || names.has(key)) continue
  names.add(key)
  const d = describe(w)
  picked.push({
    id: `wf-${w.id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    kind: 'workflow',
    title: short(title, 72),
    summary: d.summary,
    channels: d.channels,
    formats: d.formats,
    needs: d.needs,
    source: { label: 'n8n-workflows', url: `https://github.com/Zie619/n8n-workflows/blob/main/workflows/${w.download_url.split('/workflows/')[1]}` },
    diagram: d.diagram,
    goal: `Import the n8n workflow “${title}” into the creator’s n8n and adapt it to their business.`,
    steps: [],
    output: 'The workflow in the creator’s n8n, switched off, with credentials mapped and one successful test run.',
    workflowUrl: w.download_url,
    nodeCount: w.node_count,
  })
  if (picked.length >= MAX) break
}

const header = `// Generated by scripts/social/build-n8n-library.mjs from Zie619/n8n-workflows (MIT). Do not edit by hand.
import type { SocialItem } from '../types'

export const N8N_WORKFLOW_ITEMS: SocialItem[] = `
writeFileSync(OUT, `${header}${JSON.stringify(picked, null, 2)}\n`)
console.log(`Wrote ${picked.length} workflows to ${OUT}`)
