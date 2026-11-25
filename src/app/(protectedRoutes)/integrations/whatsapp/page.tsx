import { redirect } from 'next/navigation'

/** WhatsApp moved to Social. */
export default function OldWhatsAppPage() {
  redirect('/social/whatsapp')
}
