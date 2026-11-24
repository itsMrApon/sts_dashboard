import { LeadSourcePage } from '../_components/lead-sources/LeadSourcePage'
import { FathomSettings } from '../_components/lead-sources/LeadSourceSettings'

export default function FathomIntegrationPage() {
  return (
    <LeadSourcePage setupKind="fathom" title="Fathom" description="Bring your recorded calls in as leads, with their summaries.">
      {(settings) => <FathomSettings fathomOk={settings.fathomOk} />}
    </LeadSourcePage>
  )
}
