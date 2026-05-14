import { NextRequest, NextResponse } from 'next/server'
import { verifyGodotChallengeBearerRequest } from '@/lib/godot-challenges/auth'
import { consumeStudentPyPoints } from '@/lib/student-py-points'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const student = await verifyGodotChallengeBearerRequest(request)
  if (!student) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const amount = body.amount == null ? 1 : Number(body.amount)
  const reason = typeof body.reason === 'string' ? body.reason : undefined
  const requestId = typeof body.requestId === 'string' ? body.requestId : undefined

  try {
    const result = await consumeStudentPyPoints({
      studentId: student.id,
      amount,
      reason,
      clientRequestId: requestId,
    })

    return NextResponse.json({
      success: true,
      alreadyProcessed: result.alreadyProcessed,
      pyPointBalance: result.student.pyPointBalance,
      record: result.record,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '扣除Py点失败'
    return NextResponse.json(
      { error: message },
      { status: message.includes('余额不足') ? 402 : 400 }
    )
  }
}
