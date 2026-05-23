import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { completeTrainingAttempt } from '@/lib/training'

interface Params {
  params: {
    attemptId: string
  }
}

export async function POST(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  try {
    const result = await completeTrainingAttempt(session.user.id, params.attemptId)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '完成练习失败' },
      { status: 400 }
    )
  }
}
