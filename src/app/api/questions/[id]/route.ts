import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { deleteQuestionBankItem } from '@/lib/practice'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const params = await context.params
  const id = params.id?.trim()

  if (!id) {
    return NextResponse.json({ error: '缺少题目 ID' }, { status: 400 })
  }

  try {
    await deleteQuestionBankItem(session.user.id, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除题目失败' },
      { status: 400 }
    )
  }
}
