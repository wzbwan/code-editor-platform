import { prisma } from '@/lib/prisma'

export const APP_SETTING_KEYS = {
  studentChallengesNavVisible: 'studentChallengesNavVisible',
} as const

export async function getBooleanAppSetting(key: string, defaultValue: boolean) {
  const setting = await prisma.appSetting.findUnique({
    where: { key },
    select: { value: true },
  })

  if (!setting) {
    return defaultValue
  }

  if (setting.value === 'true') {
    return true
  }

  if (setting.value === 'false') {
    return false
  }

  return defaultValue
}

export async function setBooleanAppSetting(key: string, value: boolean) {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value: String(value) },
    create: {
      key,
      value: String(value),
    },
  })

  return value
}
