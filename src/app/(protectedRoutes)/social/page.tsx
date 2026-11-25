import { prismaClient } from '@/lib/prismaClient'
import { loadSocialContext } from './_lib/socialContext'
import { SocialShell } from './_components/SocialShell'
import { SocialHubCards } from './_components/SocialHubCards'

/** Social home: the channels where customers find and message the business. */
export default async function SocialPage() {
  const { user } = await loadSocialContext()
  const [instagram, campaigns, whatsapp] = await Promise.all([
    prismaClient.instagramConnection.findUnique({ where: { userId: user.id }, select: { username: true } }),
    prismaClient.instagramCampaign.count({ where: { userId: user.id, active: true } }),
    prismaClient.whatsAppConnection.findUnique({ where: { userId: user.id }, select: { displayPhone: true, aiReplies: true } }),
  ])

  return (
    <SocialShell title="Social" description="Instagram and WhatsApp: where customers find you and message you.">
      <SocialHubCards
        status={{
          instagram: instagram
            ? { on: true, label: `@${instagram.username ?? 'connected'} · ${campaigns} campaign${campaigns === 1 ? '' : 's'} on` }
            : { on: false, label: 'Not connected' },
          whatsapp: whatsapp
            ? { on: whatsapp.aiReplies, label: `${whatsapp.displayPhone ?? 'Connected'} · AI ${whatsapp.aiReplies ? 'on' : 'off'}` }
            : { on: false, label: 'Not connected' },
        }}
      />
    </SocialShell>
  )
}
