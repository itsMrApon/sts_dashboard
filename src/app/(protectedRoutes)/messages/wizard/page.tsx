import { getOrCreateBusinessWizard } from '@/lib/wizard/wizardRepo'
import { loadMessagesContext } from '../_lib/messagesContext'
import { MessagesSubnav } from '../_components/MessagesSubnav'
import { WizardConfigurator } from './_components/configurator/WizardConfigurator'

/** One business → one wizard: open its settings directly (created on first visit). */
export default async function WizardPage() {
  const { business } = await loadMessagesContext()
  const wizard = await getOrCreateBusinessWizard(business)

  return (
    <div className="flex flex-col gap-6">
      <MessagesSubnav />
      <WizardConfigurator initialWizard={wizard} />
    </div>
  )
}
