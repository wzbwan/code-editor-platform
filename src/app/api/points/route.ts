import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { POINT_SOURCE } from '@/lib/constants'
import {
  createStudentPointRecord,
  listStudentPointRecords,
} from '@/lib/student-points'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get('studentId') || undefined
  const records = await listStudentPointRecords(studentId, 30)

  return NextResponse.json(records)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const { studentId, delta, reason, occurredAt } = body

  try {
    const result = await createStudentPointRecord({
      studentId,
      delta: Number(delta),
      reason: String(reason ?? ''),
      occurredAt: occurredAt ? new Date(occurredAt) : undefined,
      source: POINT_SOURCE.WEB,
      operatorId: session.user.id,
      operatorLabel: session.user.name,
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
