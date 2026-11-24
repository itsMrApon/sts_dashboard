import { LeadSectionEmpty, LeadSectionPage } from '../_components/LeadSectionPage'

export default function LeadVideoPage() {
  return (
    <LeadSectionPage>
      {() => <LeadSectionEmpty title="Video" body="Videos for your leads will live here." />}
    </LeadSectionPage>
  )
}
