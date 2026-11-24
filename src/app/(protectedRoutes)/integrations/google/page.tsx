import { LeadSourcePage } from '../_components/lead-sources/LeadSourcePage'
import { GoogleSettings } from '../_components/lead-sources/LeadSourceSettings'

export default function GoogleIntegrationPage() {
  return (
    <LeadSourcePage title="Google OAuth" description="Link your Google Calendar and schedule Meet calls with leads.">
      {(settings) => <GoogleSettings {...settings} />}
    </LeadSourcePage>
  )
}
