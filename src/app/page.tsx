import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

/** No landing page yet: visitors go to the Clerk sign-in, signed-in users on to the app. */
export default async function Home() {
  const { userId } = await auth()
  redirect(userId ? '/callback' : '/sign-in')
}
