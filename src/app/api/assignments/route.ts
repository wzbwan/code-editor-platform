import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (id) {
    const assignment = await prisma.assignment.findUnique({
      where: { id },
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
  const { title, description, dueDate } = body

  if (!title || !description) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
  }

  const assignment = await prisma.assignment.create({
    data: {
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : null,
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
  const { id, title, description, dueDate } = body

  if (!id) {
    return NextResponse.json({ error: '缺少作业ID' }, { status: 400 })
  }

  const assignment = await prisma.assignment.update({
    where: { id },
    data: {
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
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
