import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { getTelegramSetup } from '@/actions/telegram'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import { TelegramSetup } from './_components/TelegramSetup'

export default async function TelegramPage() {
  const auth = await onAuthenticateUser()
  if (!auth.user) redirect('/sign-in')
  const setup = await getTelegramSetup()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  return (
    <PageViewport scrollable>
      <TelegramSetup initialSetup={setup} publicAppUrl={appUrl.startsWith('https://')} />
    </PageViewport>
  )
}
