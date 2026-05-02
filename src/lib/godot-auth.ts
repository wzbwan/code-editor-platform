import { randomBytes } from 'crypto'
import { encode } from 'next-auth/jwt'
import type { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SESSION_CLIENT_TYPES, type SessionClientType } from '@/lib/session-client'

const DEFAULT_GODOT_TARGET_PATH = '/student/challenges?embedded=godot'
const GODOT_BOOTSTRAP_MAX_AGE_SECONDS = 60 * 5
const NEXTAUTH_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
const NEXTAUTH_COOKIE_NAMES = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
]
const NEXTAUTH_CHUNK_SUFFIX_COUNT = 10

interface SessionCookieConfig {
  cookieName: string
  secureCookie: boolean
}

interface IssueSessionParams {
  id: string
  name: string
  username: string
  role: string
  clientType: SessionClientType
}

function getNextAuthSecret() {
  return process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'
}

export function getSessionCookieConfig(): SessionCookieConfig {
  const secureCookie = process.env.NEXTAUTH_URL?.startsWith('https://') ?? Boolean(process.env.VERCEL)

  return {
    cookieName: secureCookie ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
    secureCookie,
  }
}

export function getSessionCookieConfigForOrigin(origin: string): SessionCookieConfig {
  const secureCookie = origin.startsWith('https://')

  return {
    cookieName: secureCookie ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
    secureCookie,
  }
}

function getSessionCookieConfigForRequest(origin: string): SessionCookieConfig {
  if (process.env.NEXTAUTH_URL) {
    return getSessionCookieConfig()
  }

  return getSessionCookieConfigForOrigin(origin)
}

export function normalizeGodotTargetPath(input?: string | null) {
  if (!input) {
    return DEFAULT_GODOT_TARGET_PATH
  }

  if (!input.startsWith('/')) {
    return DEFAULT_GODOT_TARGET_PATH
  }

  const url = new URL(input, 'https://godot.local')
  if (!url.pathname.startsWith('/student/challenges')) {
    return DEFAULT_GODOT_TARGET_PATH
  }

  url.searchParams.set('embedded', 'godot')
  return `${url.pathname}${url.search}`
}

function buildBootstrapCode() {
  return randomBytes(24).toString('base64url')
}

export async function createGodotSessionBootstrap(input: {
  userId: string
  targetPath?: string | null
}) {
  const code = buildBootstrapCode()
  const targetPath = normalizeGodotTargetPath(input.targetPath)
  const expiresAt = new Date(Date.now() + GODOT_BOOTSTRAP_MAX_AGE_SECONDS * 1000)

  await prisma.$transaction(async (tx) => {
    await tx.godotSessionBootstrap.deleteMany({
      where: {
        OR: [
          { userId: input.userId },
          { expiresAt: { lt: new Date() } },
        ],
      },
    })

    await tx.godotSessionBootstrap.create({
      data: {
        code,
        userId: input.userId,
        clientType: SESSION_CLIENT_TYPES.GODOT,
        targetPath,
        expiresAt,
      },
    })
  })

  return {
    code,
    targetPath,
    expiresAt,
  }
}

export async function consumeGodotSessionBootstrap(code: string) {
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const bootstrap = await tx.godotSessionBootstrap.findUnique({
      where: { code },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
          },
        },
      },
    })

    if (!bootstrap) {
      return null
    }

    if (bootstrap.usedAt || bootstrap.expiresAt <= now || bootstrap.user.role !== 'STUDENT') {
      await tx.godotSessionBootstrap.delete({ where: { code } }).catch(() => undefined)
      return null
    }

    await tx.godotSessionBootstrap.update({
      where: { code },
      data: { usedAt: now },
    })

    return bootstrap
  })
}

export async function issueNextAuthSessionCookie(
  response: NextResponse,
  input: IssueSessionParams & { origin: string }
) {
  const { cookieName, secureCookie } = getSessionCookieConfigForRequest(input.origin)
  const sessionToken = await encode({
    secret: getNextAuthSecret(),
    maxAge: NEXTAUTH_SESSION_MAX_AGE_SECONDS,
    token: {
      sub: input.id,
      id: input.id,
      name: input.name,
      username: input.username,
      role: input.role,
      clientType: input.clientType,
    },
  })

  response.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookie,
    path: '/',
    maxAge: NEXTAUTH_SESSION_MAX_AGE_SECONDS,
  })
}

export function clearNextAuthSessionCookies(response: NextResponse) {
  for (const cookieName of NEXTAUTH_COOKIE_NAMES) {
    expireCookie(response, cookieName)

    for (let index = 0; index < NEXTAUTH_CHUNK_SUFFIX_COUNT; index += 1) {
      expireCookie(response, `${cookieName}.${index}`)
    }
  }
}

function expireCookie(response: NextResponse, cookieName: string) {
  response.cookies.set(cookieName, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieName.startsWith('__Secure-'),
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  })
}
