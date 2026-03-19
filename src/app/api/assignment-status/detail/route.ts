import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { getAssignmentStatusDetail } from '@/lib/assignment-status'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const assignmentId = searchParams.get('assignmentId')?.trim() || ''
  const studentId = searchParams.get('studentId')?.trim() || ''

  if (!assignmentId || !studentId) {
    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
  }

  const data = await getAssignmentStatusDetail(
    session.user.id,
    assignmentId,
    studentId
  )

  if (!data) {
    return NextResponse.json({ error: '未找到详情数据' }, { status: 404 })
  }

  return NextResponse.json(data)
}
