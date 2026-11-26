import { SignIn } from '@clerk/nextjs'
import { cliReturnPath } from '@/lib/cli/returnPath'

/** Sign-in. Back to the CLI approve page when that's where the creator came from. */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string | string[] }> }) {
  const next = cliReturnPath((await searchParams).redirect_url)
  return <SignIn forceRedirectUrl={next ? `/callback?next=${encodeURIComponent(next)}` : undefined} />
}
