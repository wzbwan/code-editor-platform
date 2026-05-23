import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { getStudentTrainingAttemptView } from '@/lib/training'

interface Params {
  params: {
    attemptId: string
  }
}

export async function GET(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const data = await getStudentTrainingAttemptView(session.user.id, params.attemptId)
  if (!data) {
    return NextResponse.json({ error: '练习记录不存在' }, { status: 404 })
  }

  return NextResponse.json(data)
}
