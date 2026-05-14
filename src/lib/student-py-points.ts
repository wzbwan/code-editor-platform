import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PY_POINT_SOURCE } from '@/lib/constants'

type PyPointSource = (typeof PY_POINT_SOURCE)[keyof typeof PY_POINT_SOURCE]

interface CreateStudentPyPointRecordInput {
  studentId: string
  delta: number
  reason: string
  occurredAt?: Date
  source?: PyPointSource
  operatorId?: string | null
  operatorLabel?: string | null
  clientRequestId?: string | null
}

interface GrantStudentPyPointsInput {
  studentId?: string
  className?: string
  delta: number
  reason: string
  occurredAt?: Date
  source?: PyPointSource
  operatorId?: string | null
  operatorLabel?: string | null
}

function normalizeDelta(value: number) {
  const delta = Number(value)
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error('Py点数量必须是非 0 整数')
  }
  return delta
}

function normalizePositiveAmount(value: number) {
  const amount = Number(value)
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Py点数量必须是正整数')
  }
  return amount
}

function normalizeReason(value: string) {
  const reason = value.trim()
  if (!reason) {
    throw new Error('请填写理由')
  }
  return reason
}

function normalizeClientRequestId(value?: string | null) {
  const requestId = value?.trim()
  if (!requestId) {
    return null
  }
  if (requestId.length > 128) {
    throw new Error('requestId 不能超过 128 个字符')
  }
  return requestId
}

function buildRecordSelect() {
  return {
    id: true,
    studentId: true,
    studentUsername: true,
    operatorLabel: true,
    delta: true,
    balanceBefore: true,
    balanceAfter: true,
    reason: true,
    occurredAt: true,
    source: true,
    clientRequestId: true,
    createdAt: true,
    student: {
      select: {
        name: true,
        username: true,
      },
    },
    operator: {
      select: {
        name: true,
        username: true,
      },
    },
  } satisfies Prisma.StudentPyPointRecordSelect
}

export async function createStudentPyPointRecord(
  input: CreateStudentPyPointRecordInput
) {
  return prisma.$transaction((tx) => createStudentPyPointRecordWithTx(tx, input))
}

export async function createStudentPyPointRecordWithTx(
  tx: Prisma.TransactionClient,
  input: CreateStudentPyPointRecordInput
) {
  const delta = normalizeDelta(input.delta)
  const reason = normalizeReason(input.reason)
  const clientRequestId = normalizeClientRequestId(input.clientRequestId)

  if (clientRequestId) {
    const existingRecord = await tx.studentPyPointRecord.findUnique({
      where: {
        studentId_clientRequestId: {
          studentId: input.studentId,
          clientRequestId,
        },
      },
      select: buildRecordSelect(),
    })

    if (existingRecord) {
      return {
        student: {
          id: existingRecord.studentId,
          name: existingRecord.student.name,
          username: existingRecord.student.username,
          pyPointBalance: existingRecord.balanceAfter,
        },
        record: existingRecord,
        alreadyProcessed: true,
      }
    }
  }

  if (delta < 0) {
    const decrement = Math.abs(delta)
    const updateResult = await tx.user.updateMany({
      where: {
        id: input.studentId,
        role: 'STUDENT',
        pyPointBalance: {
          gte: decrement,
        },
      },
      data: {
        pyPointBalance: {
          decrement,
        },
      },
    })

    if (updateResult.count === 0) {
      const existingStudent = await tx.user.findFirst({
        where: {
          id: input.studentId,
          role: 'STUDENT',
        },
        select: {
          id: true,
        },
      })

      if (!existingStudent) {
        throw new Error('学生不存在')
      }

      throw new Error('Py点余额不足')
    }

    const updatedStudent = await tx.user.findFirstOrThrow({
      where: {
        id: input.studentId,
        role: 'STUDENT',
      },
      select: {
        id: true,
        name: true,
        username: true,
        pyPointBalance: true,
      },
    })

    const record = await tx.studentPyPointRecord.create({
      data: {
        studentId: updatedStudent.id,
        studentUsername: updatedStudent.username,
        operatorId: input.operatorId ?? null,
        operatorLabel: input.operatorLabel?.trim() || null,
        delta,
        balanceBefore: updatedStudent.pyPointBalance + decrement,
        balanceAfter: updatedStudent.pyPointBalance,
        reason,
        occurredAt: input.occurredAt ?? new Date(),
        source: input.source ?? PY_POINT_SOURCE.WEB,
        clientRequestId,
      },
      select: buildRecordSelect(),
    })

    return {
      student: updatedStudent,
      record,
      alreadyProcessed: false,
    }
  }

  const student = await tx.user.findFirst({
    where: {
      id: input.studentId,
      role: 'STUDENT',
    },
    select: {
      id: true,
      name: true,
      username: true,
      pyPointBalance: true,
    },
  })

  if (!student) {
    throw new Error('学生不存在')
  }

  const updatedStudent = await tx.user.update({
    where: { id: student.id },
    data: {
      pyPointBalance: {
        increment: delta,
      },
    },
    select: {
      id: true,
      name: true,
      username: true,
      pyPointBalance: true,
    },
  })

  const record = await tx.studentPyPointRecord.create({
    data: {
      studentId: student.id,
      studentUsername: student.username,
      operatorId: input.operatorId ?? null,
      operatorLabel: input.operatorLabel?.trim() || null,
      delta,
      balanceBefore: student.pyPointBalance,
      balanceAfter: updatedStudent.pyPointBalance,
      reason,
      occurredAt: input.occurredAt ?? new Date(),
      source: input.source ?? PY_POINT_SOURCE.WEB,
      clientRequestId,
    },
    select: buildRecordSelect(),
  })

  return {
    student: updatedStudent,
    record,
    alreadyProcessed: false,
  }
}

export async function consumeStudentPyPoints(input: {
  studentId: string
  amount: number
  reason?: string
  clientRequestId?: string | null
}) {
  const amount = normalizePositiveAmount(input.amount)
  return prisma.$transaction(
    async (tx) =>
      createStudentPyPointRecordWithTx(tx, {
        studentId: input.studentId,
        delta: -amount,
        reason: input.reason?.trim() || 'Godot 求助AI消耗',
        source: PY_POINT_SOURCE.GODOT_AI_HELP,
        clientRequestId: input.clientRequestId,
      }),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  )
}

export async function grantStudentPyPoints(input: GrantStudentPyPointsInput) {
  const delta = normalizePositiveAmount(input.delta)
  const reason = normalizeReason(input.reason)
  const className = input.className?.trim()

  if (!input.studentId && !className) {
    throw new Error('缺少学生或班级信息')
  }

  return prisma.$transaction(async (tx) => {
    const students = await tx.user.findMany({
      where: {
        role: 'STUDENT',
        ...(input.studentId ? { id: input.studentId } : { className }),
      },
      select: {
        id: true,
        name: true,
        username: true,
        pyPointBalance: true,
      },
      orderBy: [{ name: 'asc' }, { username: 'asc' }],
    })

    if (students.length === 0) {
      throw new Error(input.studentId ? '学生不存在' : '当前班级没有学生')
    }

    const occurredAt = input.occurredAt ?? new Date()
    const source = input.source ?? PY_POINT_SOURCE.WEB

    for (const student of students) {
      await tx.user.update({
        where: { id: student.id },
        data: {
          pyPointBalance: {
            increment: delta,
          },
        },
      })
    }

    await tx.studentPyPointRecord.createMany({
      data: students.map((student) => ({
        studentId: student.id,
        studentUsername: student.username,
        operatorId: input.operatorId ?? null,
        operatorLabel: input.operatorLabel?.trim() || null,
        delta,
        balanceBefore: student.pyPointBalance,
        balanceAfter: student.pyPointBalance + delta,
        reason,
        occurredAt,
        source,
      })),
    })

    return {
      count: students.length,
      delta,
      students: students.map((student) => ({
        id: student.id,
        name: student.name,
        username: student.username,
        pyPointBalance: student.pyPointBalance + delta,
      })),
    }
  })
}

export async function getStudentPyPointBalance(studentId: string) {
  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      role: 'STUDENT',
    },
    select: {
      id: true,
      username: true,
      name: true,
      pyPointBalance: true,
    },
  })

  if (!student) {
    throw new Error('学生不存在')
  }

  return student
}

export async function listStudentPyPointRecords(studentId?: string, take = 30) {
  return prisma.studentPyPointRecord.findMany({
    where: studentId ? { studentId } : undefined,
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    take,
    select: buildRecordSelect(),
  })
}
