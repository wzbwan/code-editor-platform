import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { authOptions } from '@/lib/auth-options'
import { QUESTION_TYPES } from '@/lib/constants'

const QUESTION_TEMPLATE_HEADERS = [
  '问题',
  '类型',
  '分值',
  '选项A',
  '选项B',
  '选项C',
  '选项D',
  '答案',
  '范围',
] as const

const QUESTION_TEMPLATE_ROWS = [
  [
    'Python 中用于输出内容的函数是？',
    QUESTION_TYPES.SINGLE,
    2,
    'print()',
    'input()',
    'len()',
    'range()',
    'A',
    'Python 基础',
  ],
  [
    '阅读代码，运行结果是什么？\n```python\nx = 3\nprint(x + 2)\n```',
    QUESTION_TYPES.CODE_READING,
    2,
    '5',
    '32',
    '报错',
    '3',
    'A',
    'Python 基础',
  ],
  [
    '下面哪些是 Python 的内置数据类型？',
    QUESTION_TYPES.MULTIPLE,
    3,
    'list',
    'dict',
    'table',
    'set',
    'ABD',
    'Python 基础',
  ],
  [
    'Python 中缩进会影响代码块结构。',
    QUESTION_TYPES.JUDGE,
    1,
    '对',
    '错',
    '',
    '',
    'A',
    'Python 基础',
  ],
  [
    '表达式 len("abc") 的值是____。',
    QUESTION_TYPES.BLANK,
    2,
    '',
    '',
    '',
    '',
    '3',
    'Python 基础',
  ],
  [
    '简述变量命名时需要注意的两点。',
    QUESTION_TYPES.SHORT,
    5,
    '',
    '',
    '',
    '',
    '不能以数字开头|不能使用关键字',
    'Python 基础',
  ],
]

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const worksheet = XLSX.utils.aoa_to_sheet([
    [...QUESTION_TEMPLATE_HEADERS],
    ...QUESTION_TEMPLATE_ROWS,
  ])
  worksheet['!cols'] = [
    { wch: 48 },
    { wch: 12 },
    { wch: 8 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 24 },
    { wch: 16 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '题库模板')
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="question-bank-template.xlsx"',
    },
  })
}
