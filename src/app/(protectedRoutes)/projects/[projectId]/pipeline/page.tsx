import { redirect } from 'next/navigation'

/**
 * The old per-project pipeline. Buyers' chats, calls and orders now live in Messages (top right),
 * which shows what the AI replied and has "Take over from Chat AI". Old links open it there.
 */
export default function PipelinePage() {
  redirect('/projects?inbox=1')
}
