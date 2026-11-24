import { LeadSectionEmpty, LeadSectionPage } from '../_components/LeadSectionPage'

export default function LeadDiagramPage() {
  return (
    <LeadSectionPage>
      {() => <LeadSectionEmpty title="Diagram" body="Diagrams for your leads will live here." />}
    </LeadSectionPage>
  )
}
