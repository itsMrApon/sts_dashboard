import { redirect } from 'next/navigation'

/** Partner chats are conversations in Messages now: this address starts a new one there. */
export default function IntegrationsChatPage() {
  redirect('/integrations?inbox=new-chat')
}
