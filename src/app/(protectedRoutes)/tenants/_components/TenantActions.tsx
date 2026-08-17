'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { CreateTenantModal } from './CreateTenantModal'

type BusinessOption = { id: string; name: string }

type Props = {
  businesses: BusinessOption[]
}

export const TenantActions = ({ businesses }: Props) => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={businesses.length === 0}>
        <Plus className="mr-1 h-4 w-4" />
        New tenant
      </Button>
      <CreateTenantModal open={open} onOpenChange={setOpen} businesses={businesses} />
    </>
  )
}
