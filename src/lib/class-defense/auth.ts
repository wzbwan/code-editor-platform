import bcrypt from 'bcryptjs'
import { decode, encode } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { SESSION_CLIENT_TYPES } from '@/lib/session-client'
import { CLASS_DEFENSE_TOKEN_USE } from '@/lib/class-defense/constants'
import { getPetSpecies } from '@/lib/pets/registry'

const ACCESS_TOKEN_MAX_AGE_SECONDS = 8 * 60 * 60
const WS_TICKET_MAX_AGE_SECONDS = 60

interface ClassDefenseTokenPayload {
  [key: string]: unknown
  sub: string
  id: string
  username: string
  name: string
  role: string
  className: string
  clientType: string
  tokenUse: string
  sessionId?: string
}

function getNextAuthSecret() {
  return process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'
}

async function issueToken(
  payload: ClassDefenseTokenPayload,
  maxAge: number
) {
  return encode({
    secret: getNextAuthSecret(),
    maxAge,
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

  return decoded as unknown as Partial<ClassDefenseTokenPayload>
}

function getBearerToken(authorization: string | null) {
  return authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : ''
}

export async function loginClassDefenseStudent(input: {
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
      pet: {
        select: {
          speciesKey: true,
          nickname: true,
          level: true,
        },
      },
    },
  })

  if (!student) {
    throw new Error('学生账号不存在或无权限')
  }

  const passwordMatch = await bcrypt.compare(password, student.password)
  if (!passwordMatch) {
    throw new Error('用户名或密码错误')
  }

  const payload: ClassDefenseTokenPayload = {
    sub: student.id,
    id: student.id,
    username: student.username,
    name: student.name,
    role: student.role,
    className: student.className || '',
    clientType: SESSION_CLIENT_TYPES.GODOT,
    tokenUse: CLASS_DEFENSE_TOKEN_USE.ACCESS,
  }
  const accessToken = await issueToken(payload, ACCESS_TOKEN_MAX_AGE_SECONDS)
  const species = student.pet ? getPetSpecies(student.pet.speciesKey) : null

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_MAX_AGE_SECONDS,
    user: {
      id: student.id,
      username: student.username,
      name: student.name,
      role: student.role,
      className: student.className || '',
      hasPet: Boolean(student.pet && species),
      pet: student.pet && species
        ? {
            speciesKey: student.pet.speciesKey,
            name: species.name,
            title: species.title,
            imagePath: species.imagePath,
            nickname: student.pet.nickname,
            level: student.pet.level,
          }
        : null,
    },
  }
}

export async function verifyClassDefenseAccessToken(token: string) {
  const decoded = await decodeToken(token)
  if (
    !decoded ||
    decoded.tokenUse !== CLASS_DEFENSE_TOKEN_USE.ACCESS ||
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
  }
}

export async function verifyClassDefenseBearerRequest(request: Request) {
  const token = getBearerToken(request.headers.get('authorization'))
  if (!token) {
    return null
  }

  return verifyClassDefenseAccessToken(token)
}

export async function issueClassDefenseWsTicket(input: {
  accessToken: string
  sessionId?: string | null
}) {
  const student = await verifyClassDefenseAccessToken(input.accessToken)
  if (!student) {
    throw new Error('未授权')
  }

  const payload: ClassDefenseTokenPayload = {
    sub: student.id,
    id: student.id,
    username: student.username,
    name: student.name,
    role: student.role,
    className: student.className,
    clientType: SESSION_CLIENT_TYPES.GODOT,
    tokenUse: CLASS_DEFENSE_TOKEN_USE.WS_TICKET,
    sessionId: input.sessionId || undefined,
  }

  const ticket = await issueToken(payload, WS_TICKET_MAX_AGE_SECONDS)

  return {
    ticket,
    expiresIn: WS_TICKET_MAX_AGE_SECONDS,
    sessionId: input.sessionId || null,
    user: student,
  }
}

export async function verifyClassDefenseWsTicket(ticket: string) {
  const decoded = await decodeToken(ticket)
  if (
    !decoded ||
    decoded.tokenUse !== CLASS_DEFENSE_TOKEN_USE.WS_TICKET ||
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
    sessionId: decoded.sessionId ? String(decoded.sessionId) : null,
  }
}
