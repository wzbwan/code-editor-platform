import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import {
  createPracticePaperFromQuestionBank,
  deletePracticePaper,
  updatePracticePaper,
} from '@/lib/practice'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const title = String(body.title ?? '').trim()
  const description = String(body.description ?? '').trim()
  const questionBankIds = Array.isArray(body.questionBankIds)
    ? body.questionBankIds.map((item: unknown) => String(item))
    : []

  if (!title) {
    return NextResponse.json({ error: '请填写试卷名称' }, { status: 400 })
  }

  try {
    const paper = await createPracticePaperFromQuestionBank(session.user.id, {
      title,
      description,
      questionBankIds,
    })

    return NextResponse.json(paper)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '组卷失败' },
      { status: 400 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const id = String(body.id ?? '').trim()
  const title = body.title === undefined ? undefined : String(body.title ?? '').trim()
  const description =
    body.description === undefined ? undefined : String(body.description ?? '').trim()
  const questionBankIds = Array.isArray(body.questionBankIds)
    ? body.questionBankIds.map((item: unknown) => String(item))
    : undefined

  if (!id) {
    return NextResponse.json({ error: '缺少试卷 ID' }, { status: 400 })
  }

  if (title !== undefined && !title) {
    return NextResponse.json({ error: '请填写试卷名称' }, { status: 400 })
  }

  try {
    const paper = await updatePracticePaper(session.user.id, {
      paperId: id,
      title,
      description,
      questionBankIds,
    })

    return NextResponse.json(paper)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新试卷失败' },
      { status: 400 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const id = request.nextUrl.searchParams.get('id')?.trim()
  if (!id) {
    return NextResponse.json({ error: '缺少试卷 ID' }, { status: 400 })
  }

  try {
    await deletePracticePaper(session.user.id, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除试卷失败' },
      { status: 400 }
    )
  }
}
