import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import { ConnectAgentButton } from '@/components/agent/ConnectAgentButton'
import { loadSocialContext } from './_lib/socialContext'
import { SocialFolders } from './_components/SocialFolders'

/**
 * Social home: the folder tray (skills, prompts, workflows, plugins, reports, saved) on a page that
 * does not scroll, like Lead, with the Connect agent button centred over it. Each folder opens its part of
 * the library.
 */
export default async function SocialPage() {
  // Signs the creator in (and sends them to sign-in when they are not).
  await loadSocialContext()
  return (
    <PageViewport bottomPad={16}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 justify-center">
          <ConnectAgentButton />
        </div>
        <div className="min-h-0 flex-1">
          <SocialFolders />
        </div>
      </div>
    </PageViewport>
  )
}
