"use server"

import { prismaClient } from '@/lib/prismaClient'
import { AttendanceData } from '@/lib/type'
import { AttendedTypeEnum, CallStatusEnum, CtaTypeEnum } from '@prisma/client'
import { revalidatePath } from 'next/cache'

export const getWebinarAttendance = async (
  webinarId: string, 
  options: {
    includeUsers?: boolean 
    userLimit?: number
  } = { includeUsers: true, userLimit: 100}
) => {
  try {
    const webinar = await prismaClient.webinar.findUnique({
      where: { id: webinarId }, 
      select: { 
        id: true, 
        ctaType: true, 
        tags: true,
        presenter: true,
        _count: {
          select: {
            attendances: true,
          }
        }
      }
    })
    if (!webinar) {
      return {
        success: false,
        status: 404,
        error: "Project not found"
      }
    }
    const attendancesCount = await prismaClient.attendance.groupBy({
      by: ['attendedType'],
      where: { 
        webinarId 
      },
      _count: {
        attendedType: true,
      }
    })
    const result: Record<AttendedTypeEnum, AttendanceData> = {} as Record<AttendedTypeEnum, AttendanceData>

    for (const type of Object.values(AttendedTypeEnum)) {
      if (
        type === AttendedTypeEnum.ADDED_TO_CART && 
        webinar.ctaType === CtaTypeEnum.BOOK_A_CALL
      )
        continue
      if (
        type === AttendedTypeEnum.BREAKOUT_ROOM && 
        webinar.ctaType !== CtaTypeEnum.BOOK_A_CALL
      )
        continue
      
      const countItem = attendancesCount.find(item => {
        if (
          webinar.ctaType === CtaTypeEnum.BOOK_A_CALL && 
          type === AttendedTypeEnum.BREAKOUT_ROOM && 
          item.attendedType === AttendedTypeEnum.ADDED_TO_CART
        ){
          return item
        }
        return item.attendedType === type
      })

      result[type] = {
        count: countItem ? countItem._count.attendedType : 0, 
        users: [],
      }
    }
    if (options.includeUsers) {
      for (const type of Object.values(AttendedTypeEnum)) {
        if (
          (type === AttendedTypeEnum.ADDED_TO_CART && 
            webinar.ctaType === CtaTypeEnum.BOOK_A_CALL) || 
            (type === AttendedTypeEnum.BREAKOUT_ROOM && 
              webinar.ctaType !== CtaTypeEnum.BOOK_A_CALL)
            ) {
              continue
            }

            const queryType = 
              webinar.ctaType === CtaTypeEnum.BOOK_A_CALL &&
              type === AttendedTypeEnum.BREAKOUT_ROOM 
              ? AttendedTypeEnum.ADDED_TO_CART 
              : type
        
        if (result[type].count > 0) {
          const attendances = await prismaClient.attendance.findMany({
            where: { 
              webinarId, 
              attendedType: queryType,
            },
            include: {
              user: true,
            },
            take: options.userLimit, // Limit the number of users returned
            orderBy: {
              joinedAt: 'desc', // Most recent first
            },
          })
// fix this type
          result[type].users = attendances.map((attendance) => ({
            id: attendance.user.id, 
            name: attendance.user.name, 
            email: attendance.user.email, 
            attendedAt: attendance.joinedAt,
            stripeConnectId: null, 
            callStatus: attendance.user.callStatus,
            createdAt: attendance.user.createdAt,
            updatedAt: attendance.user.updatedAt,
          }))
        }
      }
    }

    // revalidatePath(`/projects/${webinarId}/pipeline`)
    return {
      success: true,
      data: result,
      ctaType: webinar.ctaType, 
      webinarTags: webinar.tags || [],  
      presenter: webinar.presenter,
    }

  } catch (error) {
    console.error('Failed to fetch attendance data:', error)
    return {
      success: false, 
      error: 'Failed to fetch attendance data',
    }
  }
}

export const registerAttendee = async ({
  email,
  name,
  projectId,
}: {
  projectId: string
  email: string
  name: string
}) => {
  try {
    if (!projectId || !email) {
      return {
        success: false,
        status: 400,
        message: "Project ID and email are required",
      }
    }
    const webinar = await prismaClient.webinar.findUnique({
      where: { id: projectId },
    })
    if (!webinar) {
      return {
        success: false,
        status: 404,
        message: "Project not found",
      }
    }
    // Find or create the attendee by email
    let attendee = await prismaClient.attendee.findUnique({
      where: { email },
    })
    if (!attendee) {
      attendee = await prismaClient.attendee.create({
        data: {
          email,
          name,
        },
      })
    }
    // Check for existing attendance
    const existingAttendance = await prismaClient.attendance.findFirst({
      where: {
        attendeeId: attendee.id,
        webinarId: projectId,
      },
      include: {
        user: true,
      },
    })
    if (existingAttendance) {
      return {
        success: false,
        status: 400,
        data: existingAttendance,
        message: "You have already registered for this project",
      }
    }
    // Create attendance
    const attendance = await prismaClient.attendance.create({
      data: {
        attendedType: AttendedTypeEnum.REGISTERED,
        attendeeId: attendee.id,
        webinarId: projectId,
      },
      include: {
        user: true,
      },
    })

    revalidatePath(`/${projectId}`)

    return {
      success: true,
      status: 200,
      data: attendance,
      message: "You have been added to the waiting list",
    }
  } catch (error) {
    console.error('register error 🦺:', error)
    return {
      success: false,
      status: 500,
      error: error,
      message: "Failed to register attendee",
    }
  }
}

export
const changeAttendanceType = async (
  attendeeId: string, 
  webinarId: string, 
  attendedType: AttendedTypeEnum
) => {
  try {
    const attendance = await prismaClient.attendance.update({
      where: { 
        attendeeId_webinarId: { 
          attendeeId, 
          webinarId 
        } 
      },
      data: { 
        attendedType,
      },
    })
    return {
      success: true,
      status: 200,
      message: "Attendance type changed successfully",
      data: attendance,
    }
  } catch (error) {
    console.error('changeAttendanceType error 🦺:', error)
    return {
      success: false,
      status: 500,
      message: "Failed to change attendance type",
      error,
    }
  }
}

export const getAttendeeById = async (id: string, projectId: string) => {
  try {
    const attendee = await prismaClient.attendee.findUnique({
      where: { id },
    })
    const attendance = await prismaClient.attendance.findFirst({
       where: { attendeeId: id, webinarId: projectId },
    })
    if (!attendee || !attendance) {
      return {
        success: false,
        status: 404,
        message: "Attendee not found",
      }
    }
    return {
      success: true,
      status: 200,
      message: "Attendee found",
      data: attendee,
    }
  } catch (error) {
    console.log('Error', error)
    return {
      status: 500,
      success: false,
      message: "Failed to get attendee by id",
      error,
    }
  }
}

export const changeCallStatus = async (
  attendeeId: string, 
  callStatus: CallStatusEnum
) => {
  try {
    const attendee = await prismaClient.attendee.update({
      where: { id: attendeeId },
      data: { callStatus },
    })
    return {
      success: true,
      status: 200,
      message: "Call status updated successfully",
      data: attendee,
    }
  } catch (error) {
    console.error('changeCallStatus error 🦺:', error)
    return {
      success: false,
      status: 500,
      message: "Failed to change call status",
      error,
    }
  }
}