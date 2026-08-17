'use client'

import WorkspaceWizard from '@/components/workspace-wizard/WorkspaceWizard'

/** Messages page entry: same wizard steps, Messages module pre-selected (workspace required). */
export function NewMessagesRoomButton() {
  return (
    <WorkspaceWizard
      triggerLabel="New Room"
      presetModules={['messages']}
      triggerClassName="inline-flex h-10 items-center justify-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
    />
  )
}
