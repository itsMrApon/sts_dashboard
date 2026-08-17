'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { CONNECTION_LOST_MESSAGE } from '@/lib/prismaErrors'

type ConnectionLostToastProps = {
  message?: string
}

/** Fires a top toast once when the page could not reach the database / network. */
export function ConnectionLostToast({
  message = CONNECTION_LOST_MESSAGE,
}: ConnectionLostToastProps) {
  useEffect(() => {
    toast.error(message, { id: 'connection-lost', duration: 6000 })
  }, [message])

  return null
}
