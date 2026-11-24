import { redirect } from 'next/navigation'
import { publicServicePath } from '@/lib/public/publicService'

type Props = { params: Promise<{ roomName: string }> }

/** Talk now opens as a panel on the business page; old /speak links keep working. */
export default async function SpeakServicePage({ params }: Props) {
  const { roomName } = await params
  redirect(publicServicePath('speak', decodeURIComponent(roomName)))
}
