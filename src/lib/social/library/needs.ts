import type { NeedId } from './types'

export type Need = {
  label: string
  /** One line the prompt gives the agent: how to connect it. */
  how: string
  /** Short group shown as a chip colour hint. */
  group: 'brain' | 'automation' | 'model' | 'media' | 'channel' | 'data' | 'agent'
}

/**
 * Everything an item may ask the agent to connect. Keys stay stable: items refer to them, and the
 * prompt turns each into a "connect this" line. Keys are never sent anywhere.
 */
export const NEEDS: Record<NeedId, Need> = {
  stsBrain: {
    label: 'sts-ai business brain',
    how: 'Run the sts-ai CLI init (above). It adds an MCP server called sts-ai: get_business_brain (profile, offers, prices, links, social accounts, reviews, answers) and list tools for connections, leads and the Social library. Tools that change something (propose_answer, propose_business_description, propose_connection, import_n8n_workflow, act_on_connection) wait for the creator’s approval in Lead → Approval. Call get_business_brain first; when the creator tells you facts about the business, offer to save them with propose_answer.',
    group: 'brain',
  },
  n8n: {
    label: 'Your n8n',
    how: 'The creator’s own n8n (self-hosted in Docker or n8n Cloud). Ask for the base URL and an API key (Settings → n8n API) and keep them in env vars N8N_URL and N8N_API_KEY.',
    group: 'automation',
  },
  n8nMcp: {
    label: 'n8n MCP',
    how: 'Add an n8n MCP server (the community n8n-mcp package, or n8n’s own MCP Server Trigger) so you can search nodes, create and update workflows instead of hand-editing JSON.',
    group: 'automation',
  },
  tunnel: {
    label: 'Tunnel (Cloudflare / ngrok)',
    how: 'If n8n or another tool runs on the creator’s machine, expose it with a Cloudflare Tunnel (cloudflared) or ngrok so webhooks from Instagram, Telegram or sts-ai can reach it. Never expose it without auth.',
    group: 'automation',
  },
  docker: {
    label: 'Docker',
    how: 'Docker Desktop (or Docker on a VPS) to run self-hosted tools: n8n, ComfyUI, Postiz, Mautic. Use docker compose with a named volume so data survives restarts.',
    group: 'automation',
  },
  higgsfield: {
    label: 'Higgsfield',
    how: 'A Higgsfield account and API key for cinematic image and video models (camera moves, UGC, product shots). Keep the key in HIGGSFIELD_API_KEY.',
    group: 'media',
  },
  gemini: {
    label: 'Gemini API',
    how: 'The creator’s Gemini API key (Google AI Studio) in GEMINI_API_KEY: text, image and video generation. Video needs a paid key.',
    group: 'model',
  },
  openai: {
    label: 'OpenAI API',
    how: 'An OpenAI API key in OPENAI_API_KEY for text, image (gpt-image) or transcription.',
    group: 'model',
  },
  anthropic: {
    label: 'Claude API',
    how: 'An Anthropic API key in ANTHROPIC_API_KEY when the workflow itself calls Claude (n8n Anthropic node or an HTTP request).',
    group: 'model',
  },
  elevenlabs: {
    label: 'ElevenLabs',
    how: 'An ElevenLabs API key for voice-over and voice cloning (ElevenLabs also ships an MCP server). Key in ELEVENLABS_API_KEY.',
    group: 'media',
  },
  heygen: {
    label: 'HeyGen',
    how: 'A HeyGen API key for talking-avatar videos. Key in HEYGEN_API_KEY.',
    group: 'media',
  },
  kling: {
    label: 'Kling video',
    how: 'Kling image-to-video, through its API or a host such as fal or PiAPI. Key in env, never in the workflow JSON.',
    group: 'media',
  },
  flux: {
    label: 'FLUX images',
    how: 'FLUX image models through Black Forest Labs (bfl.ai) or a host such as fal or Replicate.',
    group: 'media',
  },
  creatomate: {
    label: 'Creatomate',
    how: 'A Creatomate API key and a template ID to render videos and images from JSON.',
    group: 'media',
  },
  bannerbear: {
    label: 'Bannerbear',
    how: 'A Bannerbear API key and template to render branded images (quote cards, thumbnails, OG images).',
    group: 'media',
  },
  hyperframes: {
    label: 'HyperFrames',
    how: 'HyperFrames (github.com/heygen-com/hyperframes): write the video as HTML and render it to MP4 locally. Install its skills into the agent first.',
    group: 'media',
  },
  remotion: {
    label: 'Remotion',
    how: 'Remotion (React → MP4) in a small local project; render with npx remotion render.',
    group: 'media',
  },
  ffmpeg: {
    label: 'ffmpeg',
    how: 'ffmpeg on the machine (brew install ffmpeg) for cutting, resizing to 9:16, burning captions and joining clips.',
    group: 'media',
  },
  comfyui: {
    label: 'ComfyUI',
    how: 'ComfyUI running locally or in Docker (GPU) for open image and video models; call it through its HTTP API.',
    group: 'media',
  },
  postiz: {
    label: 'Postiz',
    how: 'Postiz (github.com/gitroomhq/postiz-app), self-hosted or cloud, to schedule posts to many networks. Use its public API key; posts stay as drafts until the creator approves.',
    group: 'channel',
  },
  metaGraph: {
    label: 'Instagram / Facebook (Meta Graph API)',
    how: 'The creator’s Meta app token with instagram_content_publish (and pages_manage_posts for Facebook). In sts-ai this connection lives in Integrations → Instagram.',
    group: 'channel',
  },
  youtubeApi: {
    label: 'YouTube Data API',
    how: 'A Google Cloud OAuth client with the YouTube Data API v3 enabled, for uploads and channel stats.',
    group: 'channel',
  },
  linkedinApi: {
    label: 'LinkedIn API',
    how: 'A LinkedIn app with w_member_social (or the n8n LinkedIn node credentials) to post as the creator.',
    group: 'channel',
  },
  xApi: {
    label: 'X (Twitter) API',
    how: 'X API keys with write access (a paid tier is required to post). Keep keys in env vars.',
    group: 'channel',
  },
  telegramBot: {
    label: 'Telegram bot',
    how: 'A bot token from @BotFather, used to send drafts and reports to the creator and take their approval.',
    group: 'channel',
  },
  wordpress: {
    label: 'WordPress',
    how: 'A WordPress site with an application password for the REST API (posts are created as drafts).',
    group: 'channel',
  },
  googleDrive: {
    label: 'Google Drive',
    how: 'Google Drive OAuth (drive.file scope) to save finished videos and images in the creator’s own Drive.',
    group: 'data',
  },
  googleSheets: {
    label: 'Google Sheets',
    how: 'A Google Sheet as the content queue: one row per idea with status (idea → draft → approved → posted).',
    group: 'data',
  },
  notion: {
    label: 'Notion',
    how: 'The Notion MCP server (or an integration token) to read and write the content calendar database.',
    group: 'data',
  },
  airtable: {
    label: 'Airtable',
    how: 'An Airtable personal access token and base for the content queue.',
    group: 'data',
  },
  apify: {
    label: 'Apify',
    how: 'An Apify token to run scrapers (Instagram, TikTok, YouTube, Google Maps). Pay-per-use; set a spending limit.',
    group: 'data',
  },
  agentReach: {
    label: 'Agent-Reach',
    how: 'Agent-Reach (github.com/Panniantong/Agent-Reach): one CLI to read and search X, Reddit, YouTube and more without API fees.',
    group: 'data',
  },
  scrapeAgent: {
    label: 'sts-ai scrape agent',
    how: 'The sts-ai scrape agent (agents/python/scrape-agent, SCRAPE_AGENT_URL) to read a website into structured facts.',
    group: 'data',
  },
  serper: {
    label: 'Serper (Google search)',
    how: 'A Serper API key for Google search, news and Maps results.',
    group: 'data',
  },
  mautic: {
    label: 'Mautic',
    how: 'Mautic (open-source marketing automation) for email segments and campaigns; use its API with basic auth or OAuth2.',
    group: 'channel',
  },
  twenty: {
    label: 'Twenty CRM',
    how: 'Twenty (open-source CRM) API key to log people who engaged and the deals they became.',
    group: 'data',
  },
  claudePlugin: {
    label: 'Claude Code plugin',
    how: 'Install the plugin in Claude Code with /plugin marketplace add <owner/repo>, then /plugin install. Other agents: copy its skills folder into the agent’s skills directory.',
    group: 'agent',
  },
  canva: {
    label: 'Canva',
    how: 'The Canva connector (Canva MCP / Connect API) to fill brand templates. Designs stay in the creator’s Canva.',
    group: 'media',
  },
  playwright: {
    label: 'Playwright',
    how: 'The Playwright MCP server (@playwright/mcp) so the agent can open pages, take screenshots and record screen captures.',
    group: 'agent',
  },
  whisper: {
    label: 'Whisper / transcription',
    how: 'Transcribe audio with Whisper (local whisper.cpp or the OpenAI API) or Deepgram, with word timestamps for cuts and captions.',
    group: 'model',
  },
  slack: {
    label: 'Slack',
    how: 'A Slack incoming webhook or bot token to post reports to a channel.',
    group: 'channel',
  },
  discord: {
    label: 'Discord',
    how: 'A Discord webhook URL to post drafts and reports to a channel.',
    group: 'channel',
  },
}
