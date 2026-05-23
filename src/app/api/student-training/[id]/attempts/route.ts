import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { startStudentTrainingAttempt } from '@/lib/training'

interface Params {
  params: {
    id: string
  }
}

export async function POST(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  try {
    const attempt = await startStudentTrainingAttempt(session.user.id, params.id)
    return NextResponse.json(attempt)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '开始训练失败' },
      { status: 400 }
    )
  }
}
