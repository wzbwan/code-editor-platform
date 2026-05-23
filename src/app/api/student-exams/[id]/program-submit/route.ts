import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { submitExamProgramAnswer } from '@/lib/exams'
import type { GodotChallengeExecutionInput, SubmittedVariableResult } from '@/lib/challenges/service'
import type { ChallengeValue } from '@/lib/challenges/types'

interface Params {
  params: {
    id: string
  }
}

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
      variables[name] = { missing: false, value: rawValue }
      continue
    }

    const hasResultShape =
      'missing' in rawValue || 'value' in rawValue || 'nonJson' in rawValue
    if (!hasResultShape) {
      if (!isChallengeValue(rawValue)) {
        throw new Error(`变量 ${name} 的值不是可判定的 JSON 值`)
      }
      variables[name] = { missing: false, value: rawValue }
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

  return {
    stdout: typeof input.stdout === 'string' ? input.stdout : '',
    stderr: typeof input.stderr === 'string' ? input.stderr : '',
    exitCode:
      typeof input.exitCode === 'number' && Number.isInteger(input.exitCode)
        ? input.exitCode
        : input.exitCode === null
          ? null
          : undefined,
    timedOut: Boolean(input.timedOut),
    variables: parseSubmittedVariables(input.variables),
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const questionId = String(body.questionId ?? '').trim()
    const code = typeof body.code === 'string' ? body.code : ''
    const execution = parseExecution(body.execution)
    if (!questionId || !code.trim()) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
    }

    const result = await submitExamProgramAnswer(session.user.id, params.id, {
      questionId,
      code,
      execution,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '提交程序题失败' },
      { status: 400 }
    )
  }
}
