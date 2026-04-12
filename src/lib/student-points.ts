import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { POINT_SOURCE } from '@/lib/constants'
import { roundToOneDecimal } from '@/lib/point-format'
import { awardPetExpWithTx, convertPointDeltaToPetExp } from '@/lib/pets/service'

type PointSource = (typeof POINT_SOURCE)[keyof typeof POINT_SOURCE]

interface CreateStudentPointRecordInput {
  studentId?: string
  username?: string
  delta: number
  reason: string
  occurredAt?: Date
  source?: PointSource
  operatorId?: string | null
  operatorLabel?: string | null
}

export async function createStudentPointRecord(
  input: CreateStudentPointRecordInput
) {
  return prisma.$transaction(async (tx) =>
    createStudentPointRecordWithTx(tx, input)
  )
}

export async function createStudentPointRecordWithTx(
  tx: Prisma.TransactionClient,
  input: CreateStudentPointRecordInput
) {
  const reason = input.reason.trim()
  const delta = roundToOneDecimal(Number(input.delta))
  if (!reason) {
    throw new Error('请填写理由')
  }

  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error('分值必须是非 0 数字')
  }

  if (!input.studentId && !input.username?.trim()) {
    throw new Error('缺少学生信息')
  }

  const student = input.studentId
    ? await tx.user.findFirst({
        where: {
          id: input.studentId,
          role: 'STUDENT',
        },
        select: {
          id: true,
          name: true,
          username: true,
          pointBalance: true,
        },
      })
    : await tx.user.findFirst({
        where: {
          username: input.username?.trim(),
          role: 'STUDENT',
        },
        select: {
          id: true,
          name: true,
          username: true,
          pointBalance: true,
        },
      })

  if (!student) {
    throw new Error('学生不存在')
  }

  const updatedStudent = await tx.user.update({
    where: { id: student.id },
    data: {
      pointBalance: {
        increment: delta,
      },
    },
    select: {
      id: true,
      name: true,
      username: true,
      pointBalance: true,
    },
  })

  const record = await tx.studentPointRecord.create({
    data: {
      studentId: student.id,
      studentUsername: student.username,
      operatorId: input.operatorId ?? null,
      operatorLabel: input.operatorLabel?.trim() || null,
      delta,
      reason,
      occurredAt: input.occurredAt ?? new Date(),
      source: input.source ?? POINT_SOURCE.WEB,
    },
    select: {
      id: true,
      studentId: true,
      studentUsername: true,
      operatorLabel: true,
      delta: true,
      reason: true,
      occurredAt: true,
      source: true,
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
    },
  })

  const pet =
    delta > 0
      ? await awardPetExpWithTx(tx, {
          studentId: student.id,
          expDelta: convertPointDeltaToPetExp(delta),
          pointDelta: delta,
          reason,
          source: input.source ?? POINT_SOURCE.WEB,
          occurredAt: input.occurredAt ?? new Date(),
        })
      : null

  return {
    student: updatedStudent,
    record,
    pet,
  }
}

export async function listStudentPointRecords(studentId?: string, take = 30) {
  return prisma.studentPointRecord.findMany({
    where: studentId
      ? {
          studentId,
        }
      : undefined,
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    take,
    select: {
      id: true,
      studentId: true,
      studentUsername: true,
      operatorLabel: true,
      delta: true,
      reason: true,
      occurredAt: true,
      source: true,
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
    },
  })
}
