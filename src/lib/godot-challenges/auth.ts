import bcrypt from 'bcryptjs'
import { decode, encode } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { SESSION_CLIENT_TYPES } from '@/lib/session-client'

const GODOT_CHALLENGE_ACCESS_TOKEN_MAX_AGE_SECONDS = 8 * 60 * 60
const GODOT_CHALLENGE_TOKEN_USE = 'GODOT_CHALLENGE_ACCESS'

interface GodotChallengeTokenPayload {
  [key: string]: unknown
  sub: string
  id: string
  username: string
  name: string
  role: string
  className: string
  clientType: string
  tokenUse: string
}

export interface GodotChallengeStudent {
  id: string
  username: string
  name: string
  role: string
  className: string
}

function getNextAuthSecret() {
  return process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'
}

function getBearerToken(authorization: string | null) {
  return authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : ''
}

async function issueToken(payload: GodotChallengeTokenPayload) {
  return encode({
    secret: getNextAuthSecret(),
    maxAge: GODOT_CHALLENGE_ACCESS_TOKEN_MAX_AGE_SECONDS,
    token: payload,
  })
}

async function decodeToken(token: string) {
  const decoded = await decode({
    secret: getNextAuthSecret(),
    token,
  })

  if (!decoded || typeof decoded !== 'object') {
    return null
  }

  return decoded as unknown as Partial<GodotChallengeTokenPayload>
}

export async function loginGodotChallengeStudent(input: {
  username: string
  password: string
}) {
  const username = input.username.trim()
  const password = input.password

  if (!username || !password) {
    throw new Error('用户名和密码不能为空')
  }

  const student = await prisma.user.findFirst({
    where: {
      username,
      role: 'STUDENT',
    },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      className: true,
      password: true,
    },
  })

  if (!student) {
    throw new Error('学生账号不存在或无权限')
  }

  const passwordMatch = await bcrypt.compare(password, student.password)
  if (!passwordMatch) {
    throw new Error('用户名或密码错误')
  }

  const user = {
    id: student.id,
    username: student.username,
    name: student.name,
    role: student.role,
    className: student.className || '',
  }
  const accessToken = await issueToken({
    sub: user.id,
    ...user,
    clientType: SESSION_CLIENT_TYPES.GODOT,
    tokenUse: GODOT_CHALLENGE_TOKEN_USE,
  })

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: GODOT_CHALLENGE_ACCESS_TOKEN_MAX_AGE_SECONDS,
    user,
  }
}

export async function verifyGodotChallengeAccessToken(token: string) {
  const decoded = await decodeToken(token)
  if (
    !decoded ||
    decoded.tokenUse !== GODOT_CHALLENGE_TOKEN_USE ||
    decoded.clientType !== SESSION_CLIENT_TYPES.GODOT ||
    decoded.role !== 'STUDENT' ||
    !decoded.id
  ) {
    return null
  }

  return {
    id: decoded.id,
    username: String(decoded.username || ''),
    name: String(decoded.name || ''),
    role: String(decoded.role || ''),
    className: String(decoded.className || ''),
  } satisfies GodotChallengeStudent
}

export async function verifyGodotChallengeBearerRequest(request: Request) {
  const token = getBearerToken(request.headers.get('authorization'))
  if (!token) {
    return null
  }

  return verifyGodotChallengeAccessToken(token)
}
