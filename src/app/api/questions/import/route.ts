import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { authOptions } from '@/lib/auth-options'
import { createQuestionBankItems } from '@/lib/practice'
import { parseQuestionRows } from '@/lib/quiz'

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

  const { parsedRows, skippedRows } = parseQuestionRows(rows)

  if (parsedRows.length === 0) {
    return NextResponse.json(
      { error: skippedRows[0]?.reason || '没有可导入的题目', skippedRows },
      { status: 400 }
    )
  }

  const created = await createQuestionBankItems(session.user.id, parsedRows)

  return NextResponse.json({
    createdCount: created.length,
    skippedCount: skippedRows.length,
    skippedRows,
  })
}
