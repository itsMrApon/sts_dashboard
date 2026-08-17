import { redirect } from 'next/navigation'

/** SMTP inbox removed — callback forms email the room creator directly. */
export default function SmtpConversationsRedirect() {
  redirect('/messages')
}
