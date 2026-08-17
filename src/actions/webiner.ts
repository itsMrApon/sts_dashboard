 "use server"

 import { WebinarFormState } from "@/store/useStsStore"
 import { onAuthenticateUser } from "./auth"
 import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"
 import { prismaClient } from "@/lib/prismaClient"
 import { CtaTypeEnum, WebinarKind, WebinarStatusEnum } from "@prisma/client"
 import {
  hasBookCallVariant,
  hasProjectVariant,
  sanitizeVariants,
  VARIANT_META,
 } from '@/lib/webinarLinkVariants'


function combineDateTime(
  date: Date, 
  timeStr: string, 
  timeFormat:'AM' |'PM'
): Date {
    const [hoursStr, minutesStr] = timeStr.split(':')
    let hours = Number.parseInt(hoursStr, 10)
    const minutes = Number.parseInt(minutesStr ||'0', 10)

  if (timeFormat === 'PM' && hours < 12){
    hours += 12
  } else if (timeFormat === 'AM' && hours === 12) {
    hours = 0
  }
  
  const result = new Date(date)
  result.setHours(hours, minutes, 0, 0)
  return result
}  





export const createProject = async(
  formData: WebinarFormState,
  options?: { tenantId?: string; workspaceId?: string },
) => {
  try {
    const user = await onAuthenticateUser()
    if (!user.user) {
      return { status : 401, message : 'Unauthorized' }
    }

    if (!user.user.subscription) {
        return { status : 402, message : 'Subscription required' }
      }
      const presenterId = user.user.id
      
      console.log('Form Data:', formData, presenterId)
      
      const selectedVariants = sanitizeVariants(formData.basicInfo.selectedVariants)
      const primaryVariant = selectedVariants[0]
      const primaryMeta = VARIANT_META[primaryVariant]

      if (!formData.basicInfo.webinarName) {
        return { status : 404, message : 'Project name is required' }
      }
      let startTime: Date

      if (!hasProjectVariant(selectedVariants)) {
        // Products are always-on; use current time as startTime and skip scheduling checks.
        startTime = new Date()
      } else {
        if (!formData.basicInfo.date) {
          return { status: 404, message: 'Project date is required' }
        }
        if (!formData.basicInfo.time) {
          return { status: 404, message: 'Project time is required' }
        }
        const combinedDateTime = combineDateTime(
          formData.basicInfo.date,
          formData.basicInfo.time,
          formData.basicInfo.timeFormat as 'AM' | 'PM',
        )
        const now = new Date()
        if (combinedDateTime < now) {
          return {
            status: 400,
            message: 'Project date and time must be in the future',
          }
        }
        startTime = combinedDateTime
      }

      // Parse aiAgent: "vapi:id" or "livekit:id" format
      let aiAgentId: string | null = null
      let livekitAgentId: string | null = null
      const aiAgentValue = formData.cta.aiAgent || ''
      if (aiAgentValue.startsWith('livekit:')) {
        livekitAgentId = aiAgentValue.slice(8) || null
      } else if (aiAgentValue.startsWith('vapi:')) {
        aiAgentId = aiAgentValue.slice(5) || null
      } else if (aiAgentValue) {
        // Backward compat: plain id treated as vapi
        aiAgentId = aiAgentValue
      }

      // Default record fields keep compatibility for existing readers.
      const ctaType = primaryMeta.ctaType === 'BUY_NOW'
        ? CtaTypeEnum.BUY_NOW
        : CtaTypeEnum.BOOK_A_CALL

      if (hasBookCallVariant(selectedVariants) && !aiAgentId && !livekitAgentId) {
        return { status: 400, message: 'AI agent is required for Book a Call links' }
      }
      if (!formData.cta.priceld) {
        return { status: 400, message: 'Stripe product is required for selected links' }
      }

      const workspaceId = options?.workspaceId ?? options?.tenantId

      const data = {
        title: formData.basicInfo.webinarName,
        description: formData.basicInfo.description || "",
        startTime,
        tags: formData.cta.tags || [],
        ctaLabel: formData.cta.ctaLabel,
        ctaType,
        kind: primaryMeta.kind === 'product' ? WebinarKind.PRODUCT : WebinarKind.PROJECT,
        aiAgentId,
        livekitAgentId,
        priceId: formData.cta.priceld || null,
        linkVariants: selectedVariants,
        thumbnail: formData.basicInfo.thumbnail || null,
        lockChat: formData.additionalInfo.lockChat || false,
        couponCode: formData.additionalInfo.couponEnabled
          ? formData.additionalInfo.couponCode
          : null,
        couponEnabled: formData.additionalInfo.couponEnabled || false,
        presenterId: presenterId,
        workspaceId: workspaceId || null,
      }

      const webinar = await prismaClient.webinar.create({ data })

      // Phase 2 unified add flow: if a workspace is selected, attach created project/webinar
      // to the workspace's publish profile so Messages/Publish can discover it immediately.
      if (workspaceId) {
        const workspace = await prismaClient.workspace.findFirst({
          where: { id: workspaceId, userId: presenterId },
          select: { publishProfileId: true },
        })
        if (workspace?.publishProfileId) {
          await prismaClient.publishProduct.upsert({
            where: {
              publishProfileId_webinarId: {
                publishProfileId: workspace.publishProfileId,
                webinarId: webinar.id,
              },
            },
            update: {},
            create: {
              publishProfileId: workspace.publishProfileId,
              webinarId: webinar.id,
              isPrimary: false,
            },
          })
        }
      }

      revalidatePath('/')
      revalidatePath('/projects')
      revalidateTag('projects-list')
      return {
        status : 201,
        message : 'Project created successfully',
        webinarId: webinar.id,
        webinarLink: `/webinar/${webinar.id}`,
      }
  } catch (error) {
    console.error('Error creating project:', error)
    const message = error instanceof Error ? error.message : 'Failed to create project, please try again later'
    return {
      status : 500,
      message,
    }
  }
}

//todo update frontend to pass webinarstatus
const getProjectsByPresenterCached = unstable_cache(
  async (userId: string, statusKey: string) =>
    prismaClient.webinar.findMany({
      where: {
        presenterId: userId,
        webinarStatus: statusKey === 'all' ? undefined : (statusKey as WebinarStatusEnum),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnail: true,
        startTime: true,
        kind: true,
        ctaType: true,
        linkVariants: true,
        webinarStatus: true,
      },
    }),
  ['projects-by-presenter-v1'],
  { revalidate: 20, tags: ['projects-list'] },
)

export const getProjectByPresenterId = async (
  presenterId: string,
  webinarStatus?: string
) => {
  try {
    let statusFilter: WebinarStatusEnum | undefined
    switch (webinarStatus) {
      case 'upcoming':
        statusFilter = WebinarStatusEnum.SCHEDULED
        break
      case 'ended':
        statusFilter = WebinarStatusEnum.ENDED
        break
      default:
        statusFilter = undefined
    }

    return await getProjectsByPresenterCached(presenterId, statusFilter ?? 'all')
  } catch (error) {
    console.error('Error getting projects:', error)
    return []
  }
}

export const getProjectbyId = async (projectId: string) =>{
  try {
    const project = await prismaClient.webinar.findUnique({
      where: { id: projectId },
      include: {
        presenter: {
          select: {
            id: true, 
            name: true, 
            profileImage: true, 
            stripeConnectId: true,
          },
        },
      },
    })  

    return project
  } catch (error) {
    console.error ('Error fetching project:', error)
    throw new Error ('Failed to fetch project')
  }
}

export const changeProjectStatus = async (
  webinarId: string,
  status: WebinarStatusEnum
) => {
  try {
    const webinar = await prismaClient.webinar.update({
      where: { id: webinarId },
      data: { webinarStatus: status },
    })
    return {
      status: 200,
      success: true,
      message: 'project status changed successfully',
      data: webinar,
    }
  } catch (error) {
    console.error('Error changing webinar status:', error)
    return {
      status: 500,
      success: false,
      message: 'Failed to change webinar status',
    };
  }
};