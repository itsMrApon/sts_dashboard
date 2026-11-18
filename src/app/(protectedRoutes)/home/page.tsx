import React from 'react'
import OnBoarding from './_Component/OnBoarding'
import { Upload, Webcam } from 'lucide-react'
import FeatureCard from './_Component/FeatureCard'
import { LandingHero } from '@/components/landing/landing-hero'

const Pages = () => {
  return (
    <div className="w-full mx-auto h-full">
      <LandingHero
        signedIn
        fullBleed
        top={
          // On the dark cubes surface, so colors are fixed light-on-dark.
          <div className="w-full flex flex-col sm:flex-row justify-between items-start gap-14">
            <div className="space-y-6">
              <h2 className="text-neutral-50 font-semibold text-4xl tracking-[-0.03em]">
                Get maximum conversion in the industry with us.
              </h2>
              <OnBoarding />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 home place-content-center">
              <FeatureCard
                Icon={<Upload className="w-10 h-10" />}
                heading="Browse or drag a pre-recorded video file"
                link="#"
              />
              <FeatureCard
                Icon={<Webcam className="w-10 h-10" />}
                heading="Go live and interact with your audience in real-time"
                link="/webinars"
              />
            </div>
          </div>
        }
      />
    </div>
  )
}

export default Pages
