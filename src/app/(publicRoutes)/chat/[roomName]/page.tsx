import { redirect } from 'next/navigation'
import { publicServicePath } from '@/lib/public/publicService'

type Props = { params: Promise<{ roomName: string }> }

/** Chat now opens as a panel on the business page; old /chat links keep working. */
export default async function ChatServicePage({ params }: Props) {
  const { roomName } = await params
  redirect(publicServicePath('chat', decodeURIComponent(roomName)))
}
