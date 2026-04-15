"use server"

import { Attendee, Webinar } from '@prisma/client'
import { UserRequest } from '@stream-io/node-sdk'
import { getStreamClient } from '@/lib/stream/streamClient'
import { prismaClient } from '@/lib/prismaClient'

export const getStreamIoToken = async (attendee: Attendee | null) => {
  try {
    const newUser: UserRequest = {
      id: attendee?.id || 'guest', 
      role: 'user',
      name: attendee?.name || 'Guest',
      image: `https://api.dicebear.com/7.x/initials/svg?seed=${
        attendee?.name || 'Guest'
      }` ,
    }
    await getStreamClient.upsertUsers([newUser])
    // validity is optional(by default the token is valid for an hour)
    const validity = 60 * 60 *60;
    const token = await getStreamClient.generateUserToken
    ({
      user_id: attendee?.id || 'guest',
      validity_in_seconds: validity,
    })
    return token;
  } catch (error) {
    console.error('Stream IO token error 🦺:', error)
    throw new Error('Failed to get Stream IO token')
  }
}

export const getTokenForHost = async (
  userId: string,
  userName: string,
  profilePic: string
) => {
  try {
    const newUser: UserRequest = {
      id: userId,
      role: 'user',
      name: userName || 'Guest',
      image: profilePic || `https://api.dicebear.com/7.x/initials/svg?seed=${userName || 'Guest'}`
    }
    await getStreamClient.upsertUsers([newUser])

    const validity = 60 * 60 *60;
    const token = await getStreamClient.generateUserToken({
      user_id: userId,
      validity_in_seconds: validity,
    })

    return token
  } catch (error) {
    console.error('Stream IO token error 🦺:', error)
    throw new Error('Failed to get Stream IO token')
  }
}

export const getTokenForGuest = async (guestUserId: string, guestName: string) => {
  try {
    const newUser: UserRequest = {
      id: guestUserId,
      role: 'user',
      name: guestName || 'Guest',
      image: `https://api.dicebear.com/7.x/initials/svg?seed=${guestName || 'Guest'}`,
    }

    await getStreamClient.upsertUsers([newUser])

    const validity = 60 * 60 * 60
    const token = await getStreamClient.generateUserToken({
      user_id: guestUserId,
      validity_in_seconds: validity,
    })

    return token
  } catch (error) {
    console.error('Stream IO token error 🦺:', error)
    throw new Error('Failed to get Stream IO token')
  }
}

export const createOrGetStream1to1Call = async (params: {
  callId: string
  hostUserId: string
  attendeeUserId: string
}) => {
  const { callId, hostUserId, attendeeUserId } = params

  const call = getStreamClient.video.call('livestream', callId)

  await call.getOrCreate({
    data: {
      created_by_id: hostUserId,
      members: [
        {
          user_id: hostUserId,
          role: 'host',
        },
        {
          user_id: attendeeUserId,
          role: 'user',
        },
      ],
    },
  })

  // Best-effort: if host hasn't joined yet, this may still be a no-op.
  try {
    await call.goLive()
  } catch {
    // ignore: host join will still work
  }

  return call
}

export const createAndStartStream = async (project: Webinar) => {
  try {
    const checkProject = await prismaClient.webinar.findMany ({
      where: {
        presenterId: project.presenterId,
        webinarStatus: 'LIVE',
      },  
    })

    if(checkProject.length > 0) {
      throw new Error('You already have a live stream running');
    }
    const call = getStreamClient.video.call( 'livestream', project.id)
    await call.getOrCreate ({
      data: {
        created_by_id: project.presenterId,
        members: [
          {
            user_id: project.presenterId,
            role: 'host',
          },
        ],
      },
    })

    call.goLive({
      // todo: add the rtmp url and start recording
      
    })

    console.log('Stream created and started successfully')

  } catch (error) {
    console.error('Error creating and starting stream:', error)
    throw new Error('Failed to create and start stream')
  }
}

//todo: make a call  to get the recording