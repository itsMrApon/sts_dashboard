 "use server"

 import { onAuthenticateUser } from "./auth"
 import { revalidateTag } from "next/cache"
 import { prismaClient } from "@/lib/prismaClient"
 import { WebinarStatusEnum } from "@prisma/client"



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
    // Only the presenter may start or end their own session.
    const auth = await onAuthenticateUser()
    if (!auth.user) return { status: 401, success: false, message: 'Sign in to change this session' }
    const updated = await prismaClient.webinar.updateMany({
      where: { id: webinarId, presenterId: auth.user.id },
      data: { webinarStatus: status },
    })
    if (updated.count === 0) return { status: 404, success: false, message: 'Session not found' }
    // The Projects cards show the session's status.
    revalidateTag('projects-list')
    return {
      status: 200,
      success: true,
      message: 'project status changed successfully',
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