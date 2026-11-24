import { redirect } from 'next/navigation'
import { publicServicePath } from '@/lib/public/publicService'

type Props = { params: Promise<{ roomName: string }> }

/** The form now opens as a panel on the business page; old /form links keep working. */
export default async function FormServicePage({ params }: Props) {
  const { roomName } = await params
  redirect(publicServicePath('form', decodeURIComponent(roomName)))
}
