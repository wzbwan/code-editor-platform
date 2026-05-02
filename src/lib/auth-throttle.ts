import { prisma } from '@/lib/prisma'

const LOGIN_RETRY_DELAYS_SECONDS = [5, 10, 20, 40, 80, 160, 300]
const LOGIN_FAILURE_RESET_AFTER_MS = 30 * 60 * 1000

function getRetryDelaySeconds(failedCount: number) {
  const index = Math.min(Math.max(failedCount, 1), LOGIN_RETRY_DELAYS_SECONDS.length) - 1
  return LOGIN_RETRY_DELAYS_SECONDS[index]
}

export async function getLoginRetryAfterSeconds(username: string, now = new Date()) {
  const throttle = await prisma.loginAttemptThrottle.findUnique({
    where: { username },
    select: {
      lockedUntil: true,
    },
  })

  if (!throttle?.lockedUntil) {
    return 0
  }

  const retryAfterMs = throttle.lockedUntil.getTime() - now.getTime()
  return retryAfterMs > 0 ? Math.ceil(retryAfterMs / 1000) : 0
}

export async function recordLoginFailure(username: string, now = new Date()) {
  const existing = await prisma.loginAttemptThrottle.findUnique({
    where: { username },
    select: {
      failedCount: true,
      lastFailedAt: true,
    },
  })

  const shouldReset =
    existing?.lastFailedAt &&
    now.getTime() - existing.lastFailedAt.getTime() > LOGIN_FAILURE_RESET_AFTER_MS
  const failedCount = (shouldReset ? 0 : existing?.failedCount || 0) + 1
  const retryAfterSeconds = getRetryDelaySeconds(failedCount)
  const lockedUntil = new Date(now.getTime() + retryAfterSeconds * 1000)

  await prisma.loginAttemptThrottle.upsert({
    where: { username },
    update: {
      failedCount,
      lockedUntil,
      lastFailedAt: now,
    },
    create: {
      username,
      failedCount,
      lockedUntil,
      lastFailedAt: now,
    },
  })

  return retryAfterSeconds
}

export async function clearLoginFailures(username: string) {
  await prisma.loginAttemptThrottle.deleteMany({
    where: { username },
  })
}
