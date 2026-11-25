import { CLI_CLIENT_LABEL, findPendingCliLogin, isCliClient, normalizeUserCode } from '@/lib/cli/cliAuth'
import { CliAuthorizeCard } from './CliAuthorizeCard'

/**
 * /cli/authorize?code=ABCD-EFGH — the page `npx @sts-ai/cli init` opens. The signed-in creator
 * checks the code matches their terminal and approves; the CLI then gets its token.
 */
export default async function CliAuthorizePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams
  const userCode = code ? normalizeUserCode(code) : null
  const request = userCode ? await findPendingCliLogin(userCode) : null

  return (
    <div className="flex w-full justify-center px-4 py-10">
      <CliAuthorizeCard
        userCode={userCode}
        found={Boolean(request)}
        clientLabel={request && isCliClient(request.client) ? CLI_CLIENT_LABEL[request.client] : 'your AI agent'}
        deviceName={request?.deviceName ?? null}
      />
    </div>
  )
}
