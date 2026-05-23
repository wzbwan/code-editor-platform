import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { submitStudentExam } from '@/lib/exams'

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
    const result = await submitStudentExam(session.user.id, params.id)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '交卷失败' },
      { status: 400 }
    )
  }
}
