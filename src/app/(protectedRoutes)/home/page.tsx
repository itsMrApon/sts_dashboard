import React from 'react'
import OnBoarding from './_Component/OnBoarding'
import { Upload, Webcam } from 'lucide-react'
import FeatureCard from './_Component/FeatureCard'
import FeatureSectionLayout from './_Component/FeatureSectionLayout'
import Image from 'next/image'
import UserInfoCard from '@/components/ReusableComponent/UserInfoCard'
import { potentialCustomer } from '@/lib/data'

type Props = {}

const Pages = (props: Props) => {
  return (
    <div className="w-full mx-auto h-full">
      <div className="w-full flex flex-col sm:flex-row justify-between items-start gap-14">
        <div className="space-y-6">
          <h2 className="text-primary font-semibold text-4xl">
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
          Icon={ <Webcam className="w-10 h-10" />}
          heading="Go live and interact with your audience in real-time"
          link="/webinars"
          />
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 rounded-xl bg-background-10">
        <FeatureSectionLayout
            heading="see how far along are your potential customers"
            link="/lead"
        >
          <div className="p-5 flex flex-col gap-4 items-start border rounded-xl border-border backdrop-blur-3xl">
            <div className="w-full flex justify-between items-center gap-3">
              <p className="text-primary font-semibold text-sm">Conversions</p>
              <p className="text-xs text-muted-foreground font-normal">50</p>
            </div>
            <div className="flex flex-col gap-4 items-start">
              {Array.from({ length: 3 }).map((_, index) => (
                <Image
                   src="/featurecard.png"
                   alt="Info-card"
                   width={250}
                   height={250}
                   className="w-full h-full object-cover rounded-xl"
                   key={index}
                   />
                ))}
            </div>
          </div>
        </FeatureSectionLayout>
        
        <FeatureSectionLayout
          heading="See the list of your current customers" 
          link="/pipeline"
        >
          <div className="flex gap-4 items-center h-full w-full justify-center relative flex-wrap">
            {potentialCustomer.slice(0, 2).map((customer, index) =>
            (
              <UserInfoCard
                customer={customer}
                tags={customer.tags}
                key={index}
              />
            ))}
              <Image
                src="/glowcard.png"
                alt="Info-card"
                width={350}
                height={350}
              className="object-cover rounded-xl absolute px-5 mb-28 hidden sm:flex backdrop-blur-[20px]"
              />
          </div>
        </FeatureSectionLayout>
      </div>
    </div>
  )
}

export default Pages