import { prisma } from '@/lib/prisma'
import { CHALLENGE_SUBMIT_COOLDOWN_SECONDS } from '@/lib/challenges/cooldown-config'

export async function getChallengeSubmitRetryAfterSeconds(studentId: string, now = new Date()) {
  const cooldown = await prisma.challengeSubmitCooldown.findUnique({
    where: { studentId },
    select: {
      nextAllowedAt: true,
    },
  })

  if (!cooldown) {
    return 0
  }

  const retryAfterMs = cooldown.nextAllowedAt.getTime() - now.getTime()
  return retryAfterMs > 0 ? Math.ceil(retryAfterMs / 1000) : 0
}

export async function recordChallengeSubmitCooldown(studentId: string, now = new Date()) {
  const nextAllowedAt = new Date(now.getTime() + CHALLENGE_SUBMIT_COOLDOWN_SECONDS * 1000)

  await prisma.challengeSubmitCooldown.upsert({
    where: { studentId },
    update: {
      nextAllowedAt,
    },
    create: {
      studentId,
      nextAllowedAt,
    },
  })

  return nextAllowedAt
}
