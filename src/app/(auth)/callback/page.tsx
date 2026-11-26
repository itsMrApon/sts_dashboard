import { onAuthenticateUser } from '@/actions/auth'
import { redirect } from 'next/navigation'
import { cliReturnPath } from '@/lib/cli/returnPath'

export const dynamic = 'force-dynamic'

const AuthCallbackPage = async ({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) => {
  const auth = await onAuthenticateUser()
  if (auth.status === 200 || auth.status === 201) {
    redirect(cliReturnPath((await searchParams).next) ?? '/home')
  } else if (
    auth.status === 403 ||
    auth.status === 500 ||
    auth.status === 400
  ) {
    redirect('/')
  }
}

export default AuthCallbackPage
