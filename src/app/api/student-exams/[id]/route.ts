import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { getStudentExamView } from '@/lib/exams'

interface Params {
  params: {
    id: string
  }
}

export async function GET(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const view = await getStudentExamView(session.user.id, params.id)
  if (!view) {
    return NextResponse.json({ error: '考试不存在' }, { status: 404 })
  }

  return NextResponse.json(view)
}
