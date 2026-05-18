import { NextRequest, NextResponse } from 'next/server'
import {
  ChallengeAttemptError,
  GodotChallengeExecutionInput,
  SubmittedVariableResult,
  parseGodotVariableProbeOutput,
  submitStudentChallengeExecution,
} from '@/lib/challenges/service'
import {
  getChallengeSubmitRetryAfterSeconds,
  recordChallengeSubmitCooldown,
} from '@/lib/challenges/cooldown'
import { ChallengeValue } from '@/lib/challenges/types'
import { verifyGodotChallengeBearerRequest } from '@/lib/godot-challenges/auth'

export const runtime = 'nodejs'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isChallengeValue(value: unknown): value is ChallengeValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return true
  }

  if (Array.isArray(value)) {
    return value.every(isChallengeValue)
  }

  if (isRecord(value)) {
    return Object.values(value).every(isChallengeValue)
  }

  return false
}

function parseSubmittedVariables(input: unknown) {
  if (input == null) {
    return null
  }

  if (!isRecord(input)) {
    throw new Error('variables 必须是对象')
  }

  const variables: Record<string, SubmittedVariableResult> = {}
  for (const [name, rawValue] of Object.entries(input)) {
    if (!name.trim()) {
      throw new Error('variables 包含空变量名')
    }

    if (!isRecord(rawValue)) {
      if (!isChallengeValue(rawValue)) {
        throw new Error(`变量 ${name} 的值不是可判定的 JSON 值`)
      }
      variables[name] = {
        missing: false,
        value: rawValue,
      }
      continue
    }

    const hasResultShape =
      'missing' in rawValue || 'value' in rawValue || 'nonJson' in rawValue
    if (!hasResultShape) {
      if (!isChallengeValue(rawValue)) {
        throw new Error(`变量 ${name} 的值不是可判定的 JSON 值`)
      }
      variables[name] = {
        missing: false,
        value: rawValue,
      }
      continue
    }

    const missing = Boolean(rawValue.missing)
    const nonJson = Boolean(rawValue.nonJson)
    const value = rawValue.value

    if (!missing && !nonJson && !isChallengeValue(value)) {
      throw new Error(`变量 ${name} 的 value 不是可判定的 JSON 值`)
    }

    variables[name] = {
      missing,
      nonJson,
      ...(missing ? {} : { value: isChallengeValue(value) ? value : String(value ?? '') }),
    }
  }

  return variables
}

function parseExecution(input: unknown): GodotChallengeExecutionInput {
  if (!isRecord(input)) {
    throw new Error('缺少 execution')
  }

  const rawStdout = typeof input.stdout === 'string' ? input.stdout : ''
  const stderr = typeof input.stderr === 'string' ? input.stderr : ''
  const exitCode =
    typeof input.exitCode === 'number' && Number.isInteger(input.exitCode)
      ? input.exitCode
      : input.exitCode === null
        ? null
        : undefined
  const timedOut = Boolean(input.timedOut)
  const submittedVariables = parseSubmittedVariables(input.variables)
  const parsedStdout = parseGodotVariableProbeOutput(rawStdout)
  const variables = submittedVariables || parsedStdout.variables

  return {
    stdout: parsedStdout.stdout,
    stderr,
    exitCode,
    timedOut,
    variables,
  }
}

export async function POST(request: NextRequest) {
  const student = await verifyGodotChallengeBearerRequest(request)
  if (!student) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const chapterKey = typeof body.chapterKey === 'string' ? body.chapterKey.trim() : ''
    const levelKey = typeof body.levelKey === 'string' ? body.levelKey.trim() : ''
    const attemptId = typeof body.attemptId === 'string' ? body.attemptId.trim() : ''
    const code = typeof body.code === 'string' ? body.code : ''
    const execution = parseExecution(body.execution)

    if (!chapterKey || !levelKey || !attemptId || !code.trim()) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
    }

    const retryAfterSeconds = await getChallengeSubmitRetryAfterSeconds(student.id)
    if (retryAfterSeconds > 0) {
      return NextResponse.json(
        {
          error: `提交过于频繁，请 ${retryAfterSeconds} 秒后再试`,
          retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds),
          },
        }
      )
    }

    const result = await submitStudentChallengeExecution(student.id, {
      chapterKey,
      levelKey,
      attemptId,
      code,
      execution,
    })

    await recordChallengeSubmitCooldown(student.id)

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : '提交失败'
    if (error instanceof ChallengeAttemptError) {
      return NextResponse.json(
        {
          error: message,
          ...(error.attemptStatus ? { attemptStatus: error.attemptStatus } : {}),
        },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { error: message },
      { status: message.includes('尚未解锁') ? 403 : 400 }
    )
  }
}
