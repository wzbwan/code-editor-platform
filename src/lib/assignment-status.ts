import { prisma } from '@/lib/prisma'
import { listStudentPointRecords } from '@/lib/student-points'

export const UNASSIGNED_CLASS_FILTER = '__UNASSIGNED__'

interface AssignmentStatusQuery {
  teacherId: string
  assignmentId: string
  className?: string
}

function normalizeClassName(value?: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : ''
}

function sortStatusItems<
  T extends { submittedAt: Date | null; username: string; name: string }
>(items: T[]) {
  return [...items].sort((left, right) => {
    if (left.submittedAt && right.submittedAt) {
      return left.submittedAt.getTime() - right.submittedAt.getTime()
    }

    if (left.submittedAt && !right.submittedAt) {
      return -1
    }

    if (!left.submittedAt && right.submittedAt) {
      return 1
    }

    const usernameCompare = left.username.localeCompare(right.username)
    if (usernameCompare !== 0) {
      return usernameCompare
    }

    return left.name.localeCompare(right.name)
  })
}

export async function getAssignmentStatusSummary({
  teacherId,
  assignmentId,
  className,
}: AssignmentStatusQuery) {
  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      teacherId,
    },
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
    },
  })

  if (!assignment) {
    return null
  }

  const students = await prisma.user.findMany({
    where: {
      role: 'STUDENT',
      ...(className?.trim()
        ? className.trim() === UNASSIGNED_CLASS_FILTER
          ? {
              OR: [{ className: null }, { className: '' }],
            }
          : { className: className.trim() }
        : {}),
    },
    select: {
      id: true,
      username: true,
      name: true,
      className: true,
      pointBalance: true,
    },
  })

  const [allStudents, submissions] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: {
        className: true,
      },
    }),
    students.length === 0
      ? Promise.resolve([])
      : prisma.submission.findMany({
          where: {
            assignmentId,
            studentId: {
              in: students.map((student) => student.id),
            },
          },
          select: {
            id: true,
            studentId: true,
            submittedAt: true,
            score: true,
            feedback: true,
          },
        }),
  ])

  const submissionByStudentId = new Map(
    submissions.map((submission) => [submission.studentId, submission] as const)
  )
  const classOptions = Array.from(
    new Set(
      allStudents
        .map((student) => normalizeClassName(student.className))
        .map((item) => item || UNASSIGNED_CLASS_FILTER)
    )
  ).sort((left, right) => left.localeCompare(right))

  const items = sortStatusItems(
    students.map((student) => {
      const submission = submissionByStudentId.get(student.id)

      return {
        id: student.id,
        username: student.username,
        name: student.name,
        className: student.className,
        pointBalance: student.pointBalance,
        submissionId: submission?.id || null,
        submittedAt: submission?.submittedAt || null,
        score: submission?.score ?? null,
        feedback: submission?.feedback ?? null,
      }
    })
  )

  return {
    assignment,
    classOptions,
    selectedClassName: className?.trim() || '',
    summary: {
      totalStudents: items.length,
      submittedCount: items.filter((item) => item.submittedAt).length,
      pendingCount: items.filter((item) => !item.submittedAt).length,
    },
    items,
  }
}

export async function getAssignmentStatusDetail(
  teacherId: string,
  assignmentId: string,
  studentId: string
) {
  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      teacherId,
    },
    select: {
      id: true,
      title: true,
      description: true,
      dueDate: true,
      status: true,
    },
  })

  if (!assignment) {
    return null
  }

  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      role: 'STUDENT',
    },
    select: {
      id: true,
      username: true,
      name: true,
      className: true,
      pointBalance: true,
      createdAt: true,
      submissions: {
        where: {
          assignmentId,
        },
        select: {
          id: true,
          code: true,
          score: true,
          feedback: true,
          submittedAt: true,
          reviewedAt: true,
        },
        take: 1,
      },
    },
  })

  if (!student) {
    return null
  }

  const recentPointRecords = await listStudentPointRecords(student.id, 10)

  return {
    assignment,
    student: {
      id: student.id,
      username: student.username,
      name: student.name,
      className: student.className,
      pointBalance: student.pointBalance,
      createdAt: student.createdAt,
    },
    submission: student.submissions[0] || null,
    recentPointRecords,
  }
}
