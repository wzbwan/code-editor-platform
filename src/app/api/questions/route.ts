import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { deleteQuestionBankItems } from '@/lib/practice'

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const ids = Array.isArray(body?.ids) ? body.ids : []

  if (!ids.every((id: unknown) => typeof id === 'string')) {
    return NextResponse.json({ error: '题目 ID 格式不正确' }, { status: 400 })
  }

  try {
    const deleted = await deleteQuestionBankItems(session.user.id, ids)
    return NextResponse.json({ success: true, deletedCount: deleted.count })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '批量删除题目失败' },
      { status: 400 }
    )
  }
}
