import { redirect } from 'next/navigation'

/** Messages lives in the top-right button now. */
export default function LeadMessagePage() {
  redirect('/lead?inbox=1')
}
