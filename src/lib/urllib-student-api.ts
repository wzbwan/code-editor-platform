import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import {
  clearLoginFailures,
  getLoginRetryAfterSeconds,
  recordLoginFailure,
} from '@/lib/auth-throttle'
import { formatLoginRetryMessage } from '@/lib/auth-throttle-messages'

const GENERIC_AUTH_ERROR = '学号或密码错误'
const MAX_STUDENT_NO_LENGTH = 64
const MAX_PASSWORD_LENGTH = 128

export interface StudentCredentials {
  studentNo: string
  password: string
}

function normalizeStudentNo(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePassword(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function validateCredentials(credentials: StudentCredentials) {
  if (!credentials.studentNo || !credentials.password) {
    return '请提供学号和密码'
  }

  if (
    credentials.studentNo.length > MAX_STUDENT_NO_LENGTH ||
    credentials.password.length > MAX_PASSWORD_LENGTH
  ) {
    return GENERIC_AUTH_ERROR
  }

  return null
}

export function readCredentialsFromSearchParams(
  searchParams: URLSearchParams
): StudentCredentials {
  return {
    studentNo: normalizeStudentNo(
      searchParams.get('studentNo') || searchParams.get('username')
    ),
    password: normalizePassword(searchParams.get('password')),
  }
}

export async function readCredentialsFromRequest(request: Request) {
  const contentType = request.headers.get('content-type')?.toLowerCase() || ''

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return {
      studentNo: normalizeStudentNo(body.studentNo ?? body.username),
      password: normalizePassword(body.password),
      take: body.take,
    }
  }

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const formData = await request.formData()
    return {
      studentNo: normalizeStudentNo(
        formData.get('studentNo') || formData.get('username')
      ),
      password: normalizePassword(formData.get('password')),
      take: formData.get('take'),
    }
  }

  const bodyText = await request.text().catch(() => '')
  const searchParams = new URLSearchParams(bodyText)

  return {
    studentNo: normalizeStudentNo(
      searchParams.get('studentNo') || searchParams.get('username')
    ),
    password: normalizePassword(searchParams.get('password')),
    take: searchParams.get('take'),
  }
}

export async function authenticateStudentCredentials(
  credentials: StudentCredentials
) {
  const validationError = validateCredentials(credentials)
  if (validationError) {
    return {
      ok: false as const,
      status: 400,
      error: validationError,
    }
  }

  const retryAfterSeconds = await getLoginRetryAfterSeconds(credentials.studentNo)
  if (retryAfterSeconds > 0) {
    return {
      ok: false as const,
      status: 429,
      error: formatLoginRetryMessage(retryAfterSeconds),
    }
  }

  const student = await prisma.user.findUnique({
    where: { username: credentials.studentNo },
    select: {
      id: true,
      username: true,
      password: true,
      name: true,
      className: true,
      role: true,
      pointBalance: true,
    },
  })

  if (!student || student.role !== 'STUDENT') {
    return {
      ok: false as const,
      status: 401,
      error: GENERIC_AUTH_ERROR,
    }
  }

  const passwordMatch = await bcrypt.compare(
    credentials.password,
    student.password
  )

  if (!passwordMatch) {
    const nextRetryAfterSeconds = await recordLoginFailure(credentials.studentNo)
    return {
      ok: false as const,
      status: 429,
      error: formatLoginRetryMessage(nextRetryAfterSeconds),
    }
  }

  await clearLoginFailures(credentials.studentNo)

  return {
    ok: true as const,
    student: {
      id: student.id,
      studentNo: student.username,
      name: student.name,
      className: student.className,
      pointBalance: student.pointBalance,
    },
  }
}

export function parseRecordTake(value: unknown) {
  const parsed = Number(value ?? 30)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return {
      ok: false as const,
      error: '记录数量参数无效',
    }
  }

  return {
    ok: true as const,
    take: Math.min(parsed, 100),
  }
}
