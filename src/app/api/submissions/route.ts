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
  const assignmentId = searchParams.get('assignmentId')
  const studentId = searchParams.get('studentId')

  if (assignmentId && studentId) {
    const submission = await prisma.submission.findUnique({
      where: {
        studentId_assignmentId: { studentId, assignmentId },
      },
      include: {
        student: { select: { id: true, name: true, username: true } },
        assignment: { select: { title: true, description: true } },
      },
    })
    return NextResponse.json(submission)
  }

  if (assignmentId) {
    const submissions = await prisma.submission.findMany({
      where: { assignmentId },
      include: {
        student: { select: { id: true, name: true, username: true } },
      },
    })
    return NextResponse.json(submissions)
  }

  const submissions = await prisma.submission.findMany({
    where: { studentId: session.user.id },
    include: {
      assignment: { select: { title: true } },
    },
    orderBy: { submittedAt: 'desc' },
  })

  return NextResponse.json(submissions)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const { assignmentId, code } = body

  if (!assignmentId || !code) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
  }

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      status: ASSIGNMENT_STATUS.ACTIVE,
    },
    select: { id: true },
  })

  if (!assignment) {
    return NextResponse.json({ error: '作业不可用或不存在' }, { status: 404 })
  }

  const submission = await prisma.submission.upsert({
    where: {
      studentId_assignmentId: {
        studentId: session.user.id,
        assignmentId,
      },
    },
    update: {
      code,
      submittedAt: new Date(),
      score: null,
      feedback: null,
      reviewedAt: null,
    },
    create: {
      studentId: session.user.id,
      assignmentId,
      code,
    },
  })

  return NextResponse.json(submission)
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const { id, score, feedback } = body

  if (!id) {
    return NextResponse.json({ error: '缺少提交ID' }, { status: 400 })
  }

  const submission = await prisma.submission.update({
    where: { id },
    data: {
      score: score !== undefined ? score : null,
      feedback: feedback || null,
      reviewedAt: new Date(),
    },
  })

  return NextResponse.json(submission)
}
