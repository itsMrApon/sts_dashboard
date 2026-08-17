"use server"

import { prismaClient } from "@/lib/prismaClient"
import { auth, currentUser } from "@clerk/nextjs/server"
import { startPerf, timeAsync } from "@/lib/dev/perf"
import { cache } from "react"
import type { User } from "@prisma/client"
import {
  isDatabaseConnectivityError,
  logDatabaseConnectivityFailure,
} from "@/lib/prismaErrors"

type AuthUserResult =
  | { status: 200 | 201; user: User; error?: undefined }
  | { status: 403; user?: undefined; error?: undefined }
  | { status: 500; user?: undefined; error: string }

/**
 * Request-scoped only (React cache). Avoid unstable_cache here — its background
 * revalidation logs raw Prisma pool/network errors into the Next.js overlay when offline.
 */
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
      prismaClient.user.findUnique({
        where: { clerkId },
      }),
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
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      logDatabaseConnectivityFailure('auth.onAuthenticateUser', error)
      return {
        status: 500,
        error: 'DATABASE_UNAVAILABLE',
      }
    }
    console.warn(
      '[auth.onAuthenticateUser]',
      error instanceof Error ? error.message : String(error),
    )
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
