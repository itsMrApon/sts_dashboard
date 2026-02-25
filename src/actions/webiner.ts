"use server"

import { WebinarFormState } from "@/store/useStsStore"
import { onAuthenticateUser } from "./auth"
import { revalidatePath } from "next/cache"
import { prismaClient } from "@/lib/prismaClient"
import { WebinarStatusEnum } from "@prisma/client"


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





export const createProject = async(formData: WebinarFormState) => {
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
      
      if (!formData.basicInfo.webinarName) {
        return { status : 404, message : 'Project name is required' }
      }
      if (!formData.basicInfo.date) {
        return { status : 404, message : 'Project date is required' }
      }
      if (!formData.basicInfo.time) {
        return { status : 404, message : 'Project time is required' }
      }
      const combinedDateTime = combineDateTime(
        formData.basicInfo.date,
        formData.basicInfo.time,
        formData.basicInfo.timeFormat as 'AM' | 'PM'
      )
      const now = new Date()
      if (combinedDateTime < now) {
        return { 
          status : 400, 
          message : 'Project date and time must be in the past' 
        }
      }

      const webinar = await prismaClient.webinar.create({
        data: {
          title: formData.basicInfo.webinarName,
          description: formData.basicInfo.description || "",
          startTime: combinedDateTime,
          tags: formData.cta.tags || [],
          ctaLabel: formData.cta.ctaLabel,
          ctaType: formData.cta.ctaType, 
          aiAgentId: formData.cta.aiAgent || null,
          priceId: formData.cta.priceld || null, 
          lockChat: formData.additionalInfo.lockChat || false, 
          couponCode: formData.additionalInfo.couponEnabled
            ? formData.additionalInfo.couponCode 
            : null,
          couponEnabled: formData.additionalInfo.couponEnabled || false, 
          presenterId: presenterId,
        },
      });
      revalidatePath('/')
      return {
        status : 201,
        message : 'Project created successfully',
        webinarId: webinar.id,
        webinarLink: `/webinar/${webinar.id}`,
      }
  } catch (error) {
    console.error('Error creating project:', error)
    return {
      status : 500,
      message : 'Failed to create project, please try again later',
    }
  }
}

//todo update frontend to pass webinarstatus
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
        statusFilter = WebinarStatusEnum. ENDED
        break
      default:
        statusFilter = undefined
    }

    const webinars = await prismaClient.webinar.findMany({
      where: { presenterId: presenterId, webinarStatus: statusFilter },
      include: {
        presenter: {
          select: {
            name: true,
            stripeConnectId: true,
            id: true,
          },
        },
      },
    })
    return webinars
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