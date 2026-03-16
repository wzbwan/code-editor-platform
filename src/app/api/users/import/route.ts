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
  className: ['class', 'classname', 'class_name', '班级'],
} as const

type ParsedStudentRow = {
  rowNumber: number
  name: string
  username: string
  password: string
  className: string
}

type ImportedStudent = {
  id: string
  name: string
  username: string
  className: string | null
  pointBalance: number
  createdAt: Date
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
  const classNameIndex = findHeaderIndex(headers, HEADER_ALIASES.className)

  if (nameIndex === -1 || usernameIndex === -1) {
    return NextResponse.json(
      {
        error: 'Excel 表头缺少必填列，请包含：姓名(name)、用户名(username)',
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
    const password = passwordIndex === -1 ? '' : normalizeCell(row[passwordIndex])
    const className =
      classNameIndex === -1 ? '' : normalizeCell(row[classNameIndex])

    if (!name && !username && !password && !className) {
      continue
    }

    if (!name || !username) {
      skippedRows.push({
        rowNumber,
        username,
        reason: '姓名、用户名为必填',
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
    parsedRows.push({ rowNumber, name, username, password, className })
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
      id: true,
      username: true,
      role: true,
      className: true,
    },
  })

  const existingUsersByUsername = new Map(
    existingUsers.map((user) => [user.username, user] as const)
  )
  const rowsToCreate: ParsedStudentRow[] = []
  const rowsToUpdate: Array<{
    id: string
    className: string
  }> = []

  for (const row of parsedRows) {
    const existingUser = existingUsersByUsername.get(row.username)

    if (!existingUser) {
      if (!row.password) {
        skippedRows.push({
          rowNumber: row.rowNumber,
          username: row.username,
          reason: '新增学生必须提供密码',
        })
        continue
      }

      rowsToCreate.push(row)
      continue
    }

    if (existingUser.role !== 'STUDENT') {
      skippedRows.push({
        rowNumber: row.rowNumber,
        username: row.username,
        reason: '该用户名已被非学生账号占用',
      })
      continue
    }

    if (!row.className) {
      skippedRows.push({
        rowNumber: row.rowNumber,
        username: row.username,
        reason: '用户名已存在，如需回填班级请提供班级列',
      })
      continue
    }

    if (existingUser.className === row.className) {
      skippedRows.push({
        rowNumber: row.rowNumber,
        username: row.username,
        reason: '班级无变化',
      })
      continue
    }

    rowsToUpdate.push({
      id: existingUser.id,
      className: row.className,
    })
  }

  if (rowsToCreate.length === 0 && rowsToUpdate.length === 0) {
    return NextResponse.json({
      createdCount: 0,
      updatedCount: 0,
      skippedCount: skippedRows.length,
      createdStudents: [],
      updatedStudents: [],
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
    const { createdStudents, updatedStudents } = await prisma.$transaction(
      async (tx) => {
        const createdStudents: ImportedStudent[] = []
        const updatedStudents: ImportedStudent[] = []

        for (const { row, password } of hashedRows) {
          createdStudents.push(
            await tx.user.create({
              data: {
                name: row.name,
                username: row.username,
                password,
                className: row.className || null,
              },
              select: {
                id: true,
                name: true,
                username: true,
                className: true,
                pointBalance: true,
                createdAt: true,
              },
            })
          )
        }

        for (const row of rowsToUpdate) {
          updatedStudents.push(
            await tx.user.update({
              where: { id: row.id },
              data: {
                className: row.className,
              },
              select: {
                id: true,
                name: true,
                username: true,
                className: true,
                pointBalance: true,
                createdAt: true,
              },
            })
          )
        }

        return { createdStudents, updatedStudents }
      }
    )

    return NextResponse.json({
      createdCount: createdStudents.length,
      updatedCount: updatedStudents.length,
      skippedCount: skippedRows.length,
      createdStudents,
      updatedStudents,
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
