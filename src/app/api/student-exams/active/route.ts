import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { getStudentActiveExam } from '@/lib/exams'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const exam = await getStudentActiveExam(session.user.id)
  return NextResponse.json({
    active: Boolean(exam),
    exam,
  })
}
