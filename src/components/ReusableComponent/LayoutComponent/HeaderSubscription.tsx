'use client'

import React from 'react'
import PackagesDialog from '../PlatformPackages/PackagesDialog'

/** Shown in the header for creators without access: opens the $49 setup / $499 monthly packages. */
export default function HeaderSubscription() {
  return <PackagesDialog />
}
