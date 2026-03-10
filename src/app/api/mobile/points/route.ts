import { NextRequest, NextResponse } from 'next/server'
import { POINT_SOURCE } from '@/lib/constants'
import { authenticateMobileApiRequest } from '@/lib/mobile-api'
import { createStudentPointRecord } from '@/lib/student-points'

export async function POST(request: NextRequest) {
  const auth = await authenticateMobileApiRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const body = await request.json()
  const { username, delta, reason, occurredAt } = body

  try {
    const result = await createStudentPointRecord({
      username: String(username ?? ''),
      delta: Number(delta),
      reason: String(reason ?? ''),
      occurredAt: occurredAt ? new Date(occurredAt) : undefined,
      source: POINT_SOURCE.MOBILE_API,
      operatorId: auth.operatorId,
      operatorLabel: auth.operatorLabel,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : '加分/扣分记录创建失败',
      },
      { status: 400 }
    )
  }
}
