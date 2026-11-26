import { redirect } from 'next/navigation'

/** Video became Message. */
export default function LeadVideoPage() {
  redirect('/lead?inbox=1')
}
