import React from 'react'

type Props = {
  children: React.ReactNode
}

/** Lead routes use the same protected py-10 chrome as projects. */
export default function LeadLayout({ children }: Props) {
  return children
}
