import React from 'react'
import Link from 'next/link'

type Props = {
  Icon: React.ReactNode
  heading: string
  link: string
}

/** Sits on the dark cubes hero on /home, styled like the hero's dark pills. */
const FeatureCard = ({ Icon, heading, link }: Props) => {
  return (
    <Link
      href={link}
      className="px-8 py-6 flex flex-col items-start justify-center gap-14 rounded-xl bg-neutral-900/80 text-neutral-50 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-colors hover:bg-neutral-900"
    >
      {Icon}
      <p className="font-semibold text-xl">{heading}</p>
    </Link>
  )
}

export default FeatureCard
