import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import {
  grantStudentPyPoints,
  listStudentPyPointRecords,
} from '@/lib/student-py-points'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get('studentId') || undefined
  const records = await listStudentPyPointRecords(studentId, 30)

  return NextResponse.json(records)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : ''
  const className = typeof body.className === 'string' ? body.className.trim() : ''
  const delta = Number(body.delta)
  const reason = String(body.reason ?? '')

  try {
    const result = await grantStudentPyPoints({
      studentId: studentId || undefined,
      className: className || undefined,
      delta,
      reason,
      operatorId: session.user.id,
      operatorLabel: session.user.name,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Py点发放失败',
      },
      { status: 400 }
    )
  }
}
