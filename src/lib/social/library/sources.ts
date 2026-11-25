import type { SocialSource } from './types'

const gh = (repo: string, label = repo): SocialSource => ({ label, url: `https://github.com/${repo}` })

/** The repos the library is built from (the creator's "video-marketing" stars list and friends). */
export const SOURCES = {
  herkEditKit: gh('nateherkai/herk-edit-kit', 'Herk Edit Kit'),
  openfilm: gh('openfilm/openfilm', 'OpenFilm'),
  hyperframes: gh('heygen-com/hyperframes', 'HyperFrames'),
  autoclip: gh('zhouxiaoka/autoclip', 'AutoClip'),
  openHiggsfield: gh('wide-trace/open-higgsfield', 'Open Higgsfield'),
  wanGP: gh('deepbeepmeep/WanGP', 'WanGP'),
  marketingSkills: gh('coreyhaines31/marketingskills', 'Marketing Skills'),
  agentReach: gh('Panniantong/Agent-Reach', 'Agent-Reach'),
  sellbird: gh('ethanplusai/sellbird', 'Sellbird'),
  brag: gh('latent-spaces/brag', 'brag'),
  openMontage: gh('OpenMontageInc/OpenMontage', 'OpenMontage'),
  mautic: gh('mautic/mautic', 'Mautic'),
  twenty: gh('twentyhq/twenty', 'Twenty'),
  postiz: gh('gitroomhq/postiz-app', 'Postiz'),
  n8nWorkflows: gh('Zie619/n8n-workflows', 'n8n-workflows'),
  diagramDesign: gh('cathrynlavery/diagram-design', 'Diagram Design'),
  n8nMcp: gh('czlonkowski/n8n-mcp', 'n8n-mcp'),
  stsAi: { label: 'sts-ai', url: 'https://www.npmjs.com/package/@sts-ai/cli' },
} as const satisfies Record<string, SocialSource>
