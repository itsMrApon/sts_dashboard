'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateTenantModal } from './CreateTenantModal'
import { AddBusinessModal } from './AddBusinessModal'

type BusinessOption = { id: string; name: string }

type Props = {
  businesses: BusinessOption[]
}

export function OutboundEmptyState({ businesses }: Props) {
  const router = useRouter()
  const [createTenantOpen, setCreateTenantOpen] = useState(false)
  const [createBusinessOpen, setCreateBusinessOpen] = useState(false)
  const [pendingBusinessId, setPendingBusinessId] = useState<string | undefined>(
    businesses.length === 1 ? businesses[0].id : undefined,
  )

  return (
    <>
      <Card className="mx-auto w-full max-w-lg py-0">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your first workspace</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            A workspace is for partner tools and internal chat. Website business details are
            edited on the Messages room under Publish.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 px-6 pb-8">
          {businesses.length === 0 ? (
            <Button onClick={() => setCreateBusinessOpen(true)}>Add business</Button>
          ) : (
            <Button onClick={() => setCreateTenantOpen(true)}>Add workspace</Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/tenants">Back to workspace console</Link>
          </Button>
        </CardContent>
      </Card>

      <AddBusinessModal
        open={createBusinessOpen}
        onOpenChange={setCreateBusinessOpen}
        redirectOnCreate={false}
        onCreated={(publishProfileId) => {
          setPendingBusinessId(publishProfileId)
          setCreateTenantOpen(true)
        }}
      />
      <CreateTenantModal
        open={createTenantOpen}
        onOpenChange={setCreateTenantOpen}
        businesses={businesses}
        defaultBusinessId={pendingBusinessId}
        onCreated={(tenantId) => {
          router.push('/messages/publish')
          router.refresh()
        }}
      />
    </>
  )
}
