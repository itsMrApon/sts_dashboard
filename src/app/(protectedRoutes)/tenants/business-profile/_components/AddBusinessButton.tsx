'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { AddBusinessModal } from '../../_components/AddBusinessModal'

export const AddBusinessButton = () => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" size="sm" variant="default" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        Add business
      </Button>
      <AddBusinessModal open={open} onOpenChange={setOpen} redirectOnCreate />
    </>
  )
}
