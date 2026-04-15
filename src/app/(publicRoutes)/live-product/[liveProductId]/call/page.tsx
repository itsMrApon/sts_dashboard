import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ liveProductId: string }>
}

export default async function Page({ params }: Props) {
  const { liveProductId } = await params
  redirect(`/live-product/${liveProductId}`)
}

