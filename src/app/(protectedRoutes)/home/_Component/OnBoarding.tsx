'use client'
import CheckCircle from '@/icons/CheckCircle'
import {onBoardingSteps } from '@/lib/data'
import Link from 'next/link'
import React from 'react'

/** Sits on the dark cubes hero on /home, so it uses fixed light-on-dark colors. */
const OnBoarding = () => {
  return (
    <div className="flex flex-col gap-1 items-start justify-start">
      {onBoardingSteps.map ((step, index) => (
      <Link
        key={index}
        href={step.link}
        className="flex items-center gap-2 text-neutral-50"
      >
      <CheckCircle />
      <p className="text-base text-neutral-400 transition-colors hover:text-neutral-50">{step.title}</p>
      </Link>
      ))}
    </div>
  )
}


export default OnBoarding
