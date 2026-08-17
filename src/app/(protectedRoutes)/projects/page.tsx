import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Webcam, MessageCircle, HomeIcon } from 'lucide-react'
import PageHeader from '@/components/ReusableComponent/PageHeader'
import { onAuthenticateUser } from '@/actions/auth'
import { redirect } from 'next/navigation'
import { getProjectByPresenterId } from '@/actions/webiner'
import ProjectCard from './_components/ProjectCard '
import { WebinarStatusEnum } from '@prisma/client'
import Link from 'next/link'
import ProjectIntentLauncher from './_components/ProjectIntentLauncher'

type Props = {
  searchParams: Promise<{
    webinarStatus?: string
    tenantId?: string
    intent?: string
    openAdd?: string
  }>
}

const page = async ({ searchParams }: Props) => {
  const [{ webinarStatus, tenantId, intent, openAdd }, checkUser] = await Promise.all([
    searchParams,
    onAuthenticateUser(),
  ])

  if (!checkUser.user) {
    redirect('/')
  }

  const shouldAutoLaunch = openAdd === '1' && (intent === 'product' || intent === 'webinar')

  // Default path: projects list only (cached). Stripe/Vapi/LiveKit only when launcher opens.
  const webinars = await getProjectByPresenterId(
    checkUser.user.id,
    webinarStatus as WebinarStatusEnum,
  )

  let stripeProducts: unknown[] = []
  let assistants: unknown[] = []
  let livekitAgents: unknown[] = []

  if (shouldAutoLaunch) {
    const [{ getAllProductsFromStripe }, { getAllAssistants }, { getLiveKitAgents }] =
      await Promise.all([
        import('@/actions/stripe'),
        import('@/actions/vapi'),
        import('@/actions/livekitAgent'),
      ])
    const launcherData = await Promise.all([
      getAllProductsFromStripe(),
      getAllAssistants(),
      getLiveKitAgents(),
    ])
    stripeProducts =
      launcherData[0]?.success && Array.isArray(launcherData[0].products)
        ? launcherData[0].products
        : []
    assistants =
      launcherData[1]?.success && Array.isArray(launcherData[1].data)
        ? launcherData[1].data
        : []
    livekitAgents =
      launcherData[2]?.success && Array.isArray(launcherData[2].data)
        ? launcherData[2].data
        : []
  }

  const hostUser = {
    id: checkUser.user.id,
    name: checkUser.user.name,
    profileImage: checkUser.user.profileImage,
  }

  return (
    <>
      {shouldAutoLaunch ? (
        <ProjectIntentLauncher
          intent={intent as 'product' | 'webinar'}
          tenantId={tenantId}
          stripeProducts={stripeProducts as never}
          assistants={assistants as never}
          livekitAgents={livekitAgents as never}
        />
      ) : null}
      <Tabs defaultValue="all" className="flex w-full flex-col gap-8">
        <PageHeader
          leftIcon={<HomeIcon className="h-3 w-3" />}
          mainIcon={<Webcam className="h-12 w-12" />}
          rightIcon={<MessageCircle className="h-4 w-4" />}
          heading="The home to all your Projects"
          placeholder="Search option..."
        >
          <TabsList className="space-x-3 bg-transparent">
            <TabsTrigger
              value="all"
              className="bg-secondary px-6 py-4 opacity-50 data-[state=active]:opacity-100"
            >
              <Link href="/webinars?webinarStatus=all">All</Link>
            </TabsTrigger>
            <TabsTrigger value="active" className="bg-secondary px-6 py-4">
              <Link href="/webinars?webinarStatus=upcoming">OnDemand</Link>
            </TabsTrigger>
            <TabsTrigger value="completed" className="bg-secondary px-6 py-4">
              <Link href="/webinars?webinarStatus=ended">Ended</Link>
            </TabsTrigger>
          </TabsList>
        </PageHeader>

        <TabsContent
          value="all"
          className="grid w-full grid-cols-1 place-content-start place-items-start gap-x-6 gap-y-10 sm:grid-cols-3 xl:grid-cols-4"
        >
          {webinars?.length > 0 ? (
            webinars.map((project, index: number) => (
              <ProjectCard key={index} project={project as never} hostUser={hostUser} />
            ))
          ) : (
            <div className="col-span-12 flex h-[200px] w-full items-center justify-center text-2xl font-semibold text-primary">
              No projects found
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="onDemand"
          className="grid w-full grid-cols-1 place-content-start place-items-start gap-x-6 gap-y-10 sm:grid-cols-3 xl:grid-cols-4"
        >
          {webinars?.length > 0 ? (
            webinars.map((project, index: number) => (
              <ProjectCard key={index} project={project as never} hostUser={hostUser} />
            ))
          ) : (
            <div className="col-span-12 flex h-[200px] w-full items-center justify-center text-2xl font-semibold text-primary">
              No onDemand projects found
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="ended"
          className="grid w-full grid-cols-1 place-content-start place-items-start gap-x-6 gap-y-10 sm:grid-cols-3 xl:grid-cols-4"
        >
          {webinars?.length > 0 ? (
            webinars.map((project, index: number) => (
              <ProjectCard key={index} project={project as never} hostUser={hostUser} />
            ))
          ) : (
            <div className="col-span-12 flex h-[200px] w-full items-center justify-center text-2xl font-semibold text-primary">
              No completed projects found
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}

export default page
