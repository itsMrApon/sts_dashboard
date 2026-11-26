import { redirect } from 'next/navigation'

/** Intel lives at /lead itself now. */
export default function LeadIntelPage() {
  redirect('/lead')
}
