"use server"

import { prismaClient } from "@/lib/prismaClient"
import { auth, currentUser } from "@clerk/nextjs/server"
import { startPerf, timeAsync } from "@/lib/dev/perf"
import { cache } from "react"
import { unstable_cache } from "next/cache"
import type { User } from "@prisma/client"

type AuthUserResult =
  | { status: 200 | 201; user: User; error?: undefined }
  | { status: 403; user?: undefined; error?: undefined }
  | { status: 500; user?: undefined; error: string }

const getUserByClerkIdCached = unstable_cache(
  async (clerkId: string) =>
    prismaClient.user.findUnique({
      where: { clerkId },
    }),
  ['auth-user-by-clerk-id'],
  { revalidate: 20 },
)

const resolveAuthenticatedUser = cache(async (): Promise<AuthUserResult> => {
  const routeTimer = startPerf('auth.onAuthenticateUser')
  try {
    const { userId: clerkId } = await timeAsync('auth.clerk.auth', () => auth())
    if (!clerkId) {
      return {
        status: 403,
      }
    }

    const userExists = await timeAsync('auth.user.findUnique', () =>
      getUserByClerkIdCached(clerkId),
    )

    if (userExists) {
      return {
        status: 200,
        user: userExists
      }
    }
    const clerkUser = await timeAsync('auth.clerk.currentUser', () => currentUser())
    if (!clerkUser) {
      return {
        status: 403,
      }
    }

    const newUser = await timeAsync('auth.user.create', () =>
      prismaClient.user.create({
        data: {
          clerkId,
          email: clerkUser.emailAddresses[0].emailAddress,
          name: clerkUser.firstName + " " + clerkUser.lastName,
          profileImage: clerkUser.imageUrl,
        },
      }),
    )
    if (!newUser) {
      return {
        status: 500,
        error: "Failed to create user"
      }
    }
    return {
      status: 201,
      user: newUser
    }
  }
  catch (error) {
    console.error("Error 🦺", error)
    return {
      status: 500,
      error: "Internal server error"
    }
    
  } finally {
    routeTimer.end()
  }
})

export async function onAuthenticateUser() {
  return resolveAuthenticatedUser()
}