import { prisma } from '@/lib/prisma'

export async function authenticateMobileApiRequest(request: Request) {
  const configuredToken = process.env.MOBILE_API_TOKEN?.trim()

  if (!configuredToken) {
    return {
      ok: false as const,
      status: 503,
      message: '未配置 MOBILE_API_TOKEN',
    }
  }

  const authorization = request.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : ''

  if (!token || token !== configuredToken) {
    return {
      ok: false as const,
      status: 401,
      message: '未授权',
    }
  }

  const operatorUsername = process.env.MOBILE_API_OPERATOR_USERNAME?.trim()
  if (!operatorUsername) {
    return {
      ok: true as const,
      operatorId: null,
      operatorLabel:
        process.env.MOBILE_API_OPERATOR_LABEL?.trim() || 'mobile-app',
    }
  }

  const operator = await prisma.user.findFirst({
    where: {
      username: operatorUsername,
      role: 'TEACHER',
    },
    select: {
      id: true,
      name: true,
      username: true,
    },
  })

  return {
    ok: true as const,
    operatorId: operator?.id ?? null,
    operatorLabel:
      operator?.name ||
      operator?.username ||
      process.env.MOBILE_API_OPERATOR_LABEL?.trim() ||
      'mobile-app',
  }
}
