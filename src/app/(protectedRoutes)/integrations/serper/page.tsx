import { LeadSourcePage } from '../_components/lead-sources/LeadSourcePage'
import { SerperSettings } from '../_components/lead-sources/LeadSourceSettings'

export default function SerperIntegrationPage() {
  return (
    <LeadSourcePage title="Serper" description="Find businesses on Google Maps for your outreach.">
      {(settings) => (
        <SerperSettings serperConfigured={settings.serperConfigured} hasUserSerperKey={settings.hasUserSerperKey} />
      )}
    </LeadSourcePage>
  )
}
