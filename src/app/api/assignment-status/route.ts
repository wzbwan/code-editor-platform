import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import {
  getAssignmentStatusSummary,
  UNASSIGNED_CLASS_FILTER,
} from '@/lib/assignment-status'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const assignmentId = searchParams.get('assignmentId')?.trim() || ''
  const rawClassName = searchParams.get('className')?.trim() || ''
  const className =
    rawClassName === UNASSIGNED_CLASS_FILTER ? UNASSIGNED_CLASS_FILTER : rawClassName

  if (!assignmentId) {
    return NextResponse.json({ error: '缺少作业ID' }, { status: 400 })
  }

  const data = await getAssignmentStatusSummary({
    teacherId: session.user.id,
    assignmentId,
    className,
  })

  if (!data) {
    return NextResponse.json({ error: '作业不存在' }, { status: 404 })
  }

  return NextResponse.json(data)
}
