import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { ASSIGNMENT_STATUS } from '@/lib/constants'

function parseScore(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return { score: null as number | null }
  }

  const score =
    typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10)

  if (!Number.isInteger(score) || score < 0 || score > 100) {
    return { error: '分数必须是 0-100 的整数' }
  }

  return { score }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const assignmentId = searchParams.get('assignmentId')
  const studentId = searchParams.get('studentId')

  if (assignmentId && studentId) {
    if (session.user.role === 'STUDENT' && studentId !== session.user.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const submission = await prisma.submission.findUnique({
      where: {
        studentId_assignmentId: { studentId, assignmentId },
      },
      include: {
        student: { select: { id: true, name: true, username: true, className: true } },
        assignment: { select: { title: true, description: true } },
      },
    })
    return NextResponse.json(submission)
  }

  if (assignmentId) {
    if (session.user.role !== 'TEACHER') {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const submissions = await prisma.submission.findMany({
      where: {
        assignmentId,
        assignment: { teacherId: session.user.id },
      },
      include: {
        student: { select: { id: true, name: true, username: true, className: true } },
      },
      orderBy: { submittedAt: 'desc' },
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

  const parsedScore = parseScore(score)
  if (parsedScore.error) {
    return NextResponse.json({ error: parsedScore.error }, { status: 400 })
  }

  const existingSubmission = await prisma.submission.findFirst({
    where: {
      id,
      assignment: { teacherId: session.user.id },
    },
    select: { id: true },
  })

  if (!existingSubmission) {
    return NextResponse.json({ error: '提交不存在' }, { status: 404 })
  }

  const submission = await prisma.submission.update({
    where: { id: existingSubmission.id },
    data: {
      score: parsedScore.score,
      feedback: typeof feedback === 'string' && feedback.trim() ? feedback.trim() : null,
      reviewedAt: new Date(),
    },
  })

  return NextResponse.json(submission)
}
