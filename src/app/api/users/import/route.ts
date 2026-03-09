import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

const HEADER_ALIASES = {
  name: ['name', '姓名', '学生姓名'],
  username: ['username', '用户名', '账号', '学号'],
  password: ['password', '密码', '初始密码'],
} as const

type ParsedStudentRow = {
  rowNumber: number
  name: string
  username: string
  password: string
}

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

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '请上传 Excel 文件' }, { status: 400 })
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
      { error: 'Excel 至少需要表头和一行学生数据' },
      { status: 400 }
    )
  }

  const headers = (rows[0] ?? []).map((cell) => normalizeHeader(cell))
  const nameIndex = findHeaderIndex(headers, HEADER_ALIASES.name)
  const usernameIndex = findHeaderIndex(headers, HEADER_ALIASES.username)
  const passwordIndex = findHeaderIndex(headers, HEADER_ALIASES.password)

  if (nameIndex === -1 || usernameIndex === -1 || passwordIndex === -1) {
    return NextResponse.json(
      {
        error:
          'Excel 表头缺少必填列，请包含：姓名(name)、用户名(username)、密码(password)',
      },
      { status: 400 }
    )
  }

  const parsedRows: ParsedStudentRow[] = []
  const skippedRows: SkippedRow[] = []
  const seenUsernames = new Map<string, number>()

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? []
    const rowNumber = index + 1
    const name = normalizeCell(row[nameIndex])
    const username = normalizeCell(row[usernameIndex])
    const password = normalizeCell(row[passwordIndex])

    if (!name && !username && !password) {
      continue
    }

    if (!name || !username || !password) {
      skippedRows.push({
        rowNumber,
        username,
        reason: '姓名、用户名、密码均为必填',
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
    parsedRows.push({ rowNumber, name, username, password })
  }

  if (parsedRows.length === 0) {
    return NextResponse.json(
      { error: '没有可导入的数据', skippedRows },
      { status: 400 }
    )
  }

  const existingUsers = await prisma.user.findMany({
    where: {
      username: {
        in: parsedRows.map((row) => row.username),
      },
    },
    select: {
      username: true,
    },
  })

  const existingUsernames = new Set(existingUsers.map((user) => user.username))
  const rowsToCreate = parsedRows.filter((row) => {
    if (existingUsernames.has(row.username)) {
      skippedRows.push({
        rowNumber: row.rowNumber,
        username: row.username,
        reason: '用户名已存在',
      })
      return false
    }

    return true
  })

  if (rowsToCreate.length === 0) {
    return NextResponse.json({
      createdCount: 0,
      skippedCount: skippedRows.length,
      createdStudents: [],
      skippedRows,
    })
  }

  const hashedRows = await Promise.all(
    rowsToCreate.map(async (row) => ({
      row,
      password: await bcrypt.hash(row.password, 10),
    }))
  )

  try {
    const createdStudents = await prisma.$transaction(
      hashedRows.map(({ row, password }) =>
        prisma.user.create({
          data: {
            name: row.name,
            username: row.username,
            password,
          },
          select: {
            id: true,
            name: true,
            username: true,
            createdAt: true,
          },
        })
      )
    )

    return NextResponse.json({
      createdCount: createdStudents.length,
      skippedCount: skippedRows.length,
      createdStudents,
      skippedRows,
    })
  } catch (error) {
    console.error('Failed to import students:', error)
    return NextResponse.json(
      { error: '导入失败，请检查是否存在重复用户名后重试' },
      { status: 500 }
    )
  }
}
