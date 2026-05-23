import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { getTeacherTrainingAnalytics } from '@/lib/training'

interface Params {
  params: {
    id: string
  }
}

export async function GET(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const data = await getTeacherTrainingAnalytics(session.user.id, params.id)
  if (!data) {
    return NextResponse.json({ error: '训练任务不存在' }, { status: 404 })
  }

  return NextResponse.json(data)
}
