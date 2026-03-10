import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { ASSIGNMENT_STATUS } from '@/lib/constants'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (id) {
    const assignment = await prisma.assignment.findFirst({
      where: {
        id,
        ...(session.user.role === 'STUDENT'
          ? { status: ASSIGNMENT_STATUS.ACTIVE }
          : {}),
      },
      include: {
        teacher: { select: { name: true } },
        submissions: session.user.role === 'STUDENT'
          ? { where: { studentId: session.user.id } }
          : { include: { student: { select: { id: true, name: true } } } },
      },
    })
    return NextResponse.json(assignment)
  }

  const assignments = await prisma.assignment.findMany({
    where:
      session.user.role === 'STUDENT'
        ? { status: ASSIGNMENT_STATUS.ACTIVE }
        : undefined,
    include: {
      teacher: { select: { name: true } },
      _count: { select: { submissions: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(assignments)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, dueDate, status } = body

  if (!title || !description) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
  }

  if (
    status !== undefined &&
    status !== ASSIGNMENT_STATUS.ACTIVE &&
    status !== ASSIGNMENT_STATUS.DISABLED
  ) {
    return NextResponse.json({ error: '作业状态无效' }, { status: 400 })
  }

  const assignment = await prisma.assignment.create({
    data: {
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: status || ASSIGNMENT_STATUS.ACTIVE,
      teacherId: session.user.id,
    },
  })

  return NextResponse.json(assignment)
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const { id, title, description, dueDate, status } = body

  if (!id) {
    return NextResponse.json({ error: '缺少作业ID' }, { status: 400 })
  }

  if (
    status !== undefined &&
    status !== ASSIGNMENT_STATUS.ACTIVE &&
    status !== ASSIGNMENT_STATUS.DISABLED
  ) {
    return NextResponse.json({ error: '作业状态无效' }, { status: 400 })
  }

  const data: {
    title?: string
    description?: string
    dueDate?: Date | null
    status?: string
  } = {}

  if (title !== undefined) {
    data.title = title
  }
  if (description !== undefined) {
    data.description = description
  }
  if (dueDate !== undefined) {
    data.dueDate = dueDate ? new Date(dueDate) : null
  }
  if (status !== undefined) {
    data.status = status
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 })
  }

  const assignment = await prisma.assignment.update({
    where: { id },
    data,
  })

  return NextResponse.json(assignment)
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: '缺少作业ID' }, { status: 400 })
  }

  await prisma.submission.deleteMany({ where: { assignmentId: id } })
  await prisma.assignment.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
