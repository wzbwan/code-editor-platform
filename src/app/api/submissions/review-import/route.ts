import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

const HEADER_ALIASES = {
  username: ['username', '用户名', '账号', '学号'],
  name: ['name', '姓名', '学生姓名'],
  score: ['score', '分数', '成绩'],
  feedback: ['feedback', '评语', '评价'],
} as const

type SkippedRow = {
  rowNumber: number
  username: string
  reason: string
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function normalizeCell(value: unknown) {
  return String(value ?? '').trim()
}

function findHeaderIndex(headers: string[], aliases: readonly string[]) {
  return headers.findIndex((header) =>
    aliases.some((alias) => normalizeHeader(alias) === header)
  )
}

function parseScore(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const score =
    typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10)

  if (!Number.isInteger(score) || score < 0 || score > 100) {
    return null
  }

  return score
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const assignmentId = normalizeCell(formData.get('assignmentId'))

  if (!assignmentId) {
    return NextResponse.json({ error: '缺少作业ID' }, { status: 400 })
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '请上传 Excel 文件' }, { status: 400 })
  }

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      teacherId: session.user.id,
    },
    select: { id: true },
  })

  if (!assignment) {
    return NextResponse.json({ error: '作业不存在' }, { status: 404 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    return NextResponse.json({ error: 'Excel 文件为空' }, { status: 400 })
  }

  const worksheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  })

  if (rows.length < 2) {
    return NextResponse.json(
      { error: 'Excel 至少需要表头和一行批阅数据' },
      { status: 400 }
    )
  }

  const headers = (rows[0] ?? []).map((cell) => normalizeHeader(cell))
  const usernameIndex = findHeaderIndex(headers, HEADER_ALIASES.username)
  const nameIndex = findHeaderIndex(headers, HEADER_ALIASES.name)
  const scoreIndex = findHeaderIndex(headers, HEADER_ALIASES.score)
  const feedbackIndex = findHeaderIndex(headers, HEADER_ALIASES.feedback)

  if (usernameIndex === -1 || nameIndex === -1 || scoreIndex === -1) {
    return NextResponse.json(
      {
        error: 'Excel 表头缺少必填列，请包含：用户名(username)、姓名(name)、分数(score)',
      },
      { status: 400 }
    )
  }

  const submissions = await prisma.submission.findMany({
    where: {
      assignmentId,
      assignment: { teacherId: session.user.id },
    },
    include: {
      student: {
        select: {
          id: true,
          username: true,
          name: true,
        },
      },
    },
  })

  const submissionByUsername = new Map(
    submissions.map((submission) => [submission.student.username, submission] as const)
  )
  const seenUsernames = new Map<string, number>()
  const skippedRows: SkippedRow[] = []
  const updates: Array<{
    id: string
    score: number
    feedback: string | null
  }> = []

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? []
    const rowNumber = index + 1
    const username = normalizeCell(row[usernameIndex])
    const name = normalizeCell(row[nameIndex])
    const scoreValue = row[scoreIndex]
    const feedback =
      feedbackIndex === -1 ? '' : normalizeCell(row[feedbackIndex])

    if (!username && !name && normalizeCell(scoreValue) === '' && !feedback) {
      continue
    }

    if (!username || !name || normalizeCell(scoreValue) === '') {
      skippedRows.push({
        rowNumber,
        username,
        reason: '用户名、姓名、分数均为必填',
      })
      continue
    }

    if (seenUsernames.has(username)) {
      skippedRows.push({
        rowNumber,
        username,
        reason: `与第 ${seenUsernames.get(username)} 行用户名重复`,
      })
      continue
    }

    seenUsernames.set(username, rowNumber)

    const submission = submissionByUsername.get(username)
    if (!submission) {
      skippedRows.push({
        rowNumber,
        username,
        reason: '未找到该学生对应的提交记录',
      })
      continue
    }

    if (submission.student.name !== name) {
      skippedRows.push({
        rowNumber,
        username,
        reason: '姓名与系统记录不一致',
      })
      continue
    }

    const score = parseScore(scoreValue)
    if (score === null) {
      skippedRows.push({
        rowNumber,
        username,
        reason: '分数必须是 0-100 的整数',
      })
      continue
    }

    updates.push({
      id: submission.id,
      score,
      feedback: feedback || null,
    })
  }

  if (updates.length === 0) {
    return NextResponse.json({
      updatedCount: 0,
      skippedCount: skippedRows.length,
      skippedRows,
    })
  }

  await prisma.$transaction(
    updates.map((update) =>
      prisma.submission.update({
        where: { id: update.id },
        data: {
          score: update.score,
          feedback: update.feedback,
          reviewedAt: new Date(),
        },
      })
    )
  )

  return NextResponse.json({
    updatedCount: updates.length,
    skippedCount: skippedRows.length,
    skippedRows,
  })
}
