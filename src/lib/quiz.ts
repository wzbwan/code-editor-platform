import {
  PRACTICE_MODES,
  PRACTICE_STATUSES,
  QUESTION_TYPES,
  UNASSIGNED_CLASS_FILTER,
} from '@/lib/constants'

export type QuestionType = (typeof QUESTION_TYPES)[keyof typeof QUESTION_TYPES]
export type PracticeMode = (typeof PRACTICE_MODES)[keyof typeof PRACTICE_MODES]
export type PracticeStatus = (typeof PRACTICE_STATUSES)[keyof typeof PRACTICE_STATUSES]

export interface ParsedQuestionInput {
  content: string
  type: QuestionType
  score: number
  optionA: string | null
  optionB: string | null
  optionC: string | null
  optionD: string | null
  answer: string
  scope: string | null
}

export interface SkippedRow {
  rowNumber: number
  reason: string
  content?: string
}

const TYPE_ALIASES: Record<string, QuestionType> = {
  单选题: QUESTION_TYPES.SINGLE,
  单选: QUESTION_TYPES.SINGLE,
  single: QUESTION_TYPES.SINGLE,
  radio: QUESTION_TYPES.SINGLE,
  多选题: QUESTION_TYPES.MULTIPLE,
  多选: QUESTION_TYPES.MULTIPLE,
  multiple: QUESTION_TYPES.MULTIPLE,
  checkbox: QUESTION_TYPES.MULTIPLE,
  判断题: QUESTION_TYPES.JUDGE,
  判断: QUESTION_TYPES.JUDGE,
  judge: QUESTION_TYPES.JUDGE,
  truefalse: QUESTION_TYPES.JUDGE,
  填空题: QUESTION_TYPES.BLANK,
  填空: QUESTION_TYPES.BLANK,
  blank: QUESTION_TYPES.BLANK,
  简答题: QUESTION_TYPES.SHORT,
  简答: QUESTION_TYPES.SHORT,
  short: QUESTION_TYPES.SHORT,
}

const HEADER_ALIASES = {
  content: ['问题', '题目', 'question', 'content'],
  type: ['类型', '题型', 'type'],
  score: ['分值', '分数', 'score'],
  optionA: ['选项a', 'a', 'optiona', '选项a（可选）'],
  optionB: ['选项b', 'b', 'optionb', '选项b（可选）'],
  optionC: ['选项c', 'c', 'optionc', '选项c（可选）'],
  optionD: ['选项d', 'd', 'optiond', '选项d（可选）'],
  answer: ['答案', '正确答案', 'answer'],
  scope: ['范围', '分类', 'scope'],
} as const

function normalizeText(value: unknown) {
  return String(value ?? '').trim()
}

export function normalizeHeader(value: unknown) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, '')
}

export function findHeaderIndex(headers: string[], aliases: readonly string[]) {
  return headers.findIndex((header) =>
    aliases.some((alias) => normalizeHeader(alias) === header)
  )
}

export function normalizeQuestionType(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '')
  return TYPE_ALIASES[normalized] || TYPE_ALIASES[value.trim()] || null
}

export function normalizeClassNameFilter(value?: string | null) {
  const normalized = value?.trim() || ''
  return normalized
}

export function matchClassFilter(value: string | null, classFilter: string) {
  if (!classFilter) {
    return true
  }

  if (classFilter === UNASSIGNED_CLASS_FILTER) {
    return !value?.trim()
  }

  return (value?.trim() || '') === classFilter
}

export function parseQuestionRows(rows: (string | number | null)[][]) {
  if (rows.length < 2) {
    return {
      parsedRows: [] as ParsedQuestionInput[],
      skippedRows: [
        {
          rowNumber: 0,
          reason: 'Excel 至少需要表头和一行题目数据',
        },
      ] satisfies SkippedRow[],
    }
  }

  const headers = (rows[0] ?? []).map((cell) => normalizeHeader(cell))
  const contentIndex = findHeaderIndex(headers, HEADER_ALIASES.content)
  const typeIndex = findHeaderIndex(headers, HEADER_ALIASES.type)
  const scoreIndex = findHeaderIndex(headers, HEADER_ALIASES.score)
  const optionAIndex = findHeaderIndex(headers, HEADER_ALIASES.optionA)
  const optionBIndex = findHeaderIndex(headers, HEADER_ALIASES.optionB)
  const optionCIndex = findHeaderIndex(headers, HEADER_ALIASES.optionC)
  const optionDIndex = findHeaderIndex(headers, HEADER_ALIASES.optionD)
  const answerIndex = findHeaderIndex(headers, HEADER_ALIASES.answer)
  const scopeIndex = findHeaderIndex(headers, HEADER_ALIASES.scope)

  if (contentIndex === -1 || typeIndex === -1 || scoreIndex === -1 || answerIndex === -1) {
    return {
      parsedRows: [] as ParsedQuestionInput[],
      skippedRows: [
        {
          rowNumber: 0,
          reason: '表头缺少必填列：问题、类型、分值、答案',
        },
      ] satisfies SkippedRow[],
    }
  }

  const parsedRows: ParsedQuestionInput[] = []
  const skippedRows: SkippedRow[] = []

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? []
    const rowNumber = index + 1
    const content = normalizeText(row[contentIndex])
    const type = normalizeQuestionType(normalizeText(row[typeIndex]))
    const rawScore = normalizeText(row[scoreIndex])
    const answer = normalizeText(row[answerIndex])
    const optionA = optionAIndex === -1 ? '' : normalizeText(row[optionAIndex])
    const optionB = optionBIndex === -1 ? '' : normalizeText(row[optionBIndex])
    const optionC = optionCIndex === -1 ? '' : normalizeText(row[optionCIndex])
    const optionD = optionDIndex === -1 ? '' : normalizeText(row[optionDIndex])
    const scope = scopeIndex === -1 ? '' : normalizeText(row[scopeIndex])

    if (!content && !rawScore && !answer && !optionA && !optionB && !optionC && !optionD) {
      continue
    }

    const score = Number.parseInt(rawScore, 10)
    if (!content || !type || !Number.isInteger(score) || score <= 0 || !answer) {
      skippedRows.push({
        rowNumber,
        reason: '问题、类型、分值、答案为必填，且分值必须为正整数',
        content,
      })
      continue
    }

    if (
      (type === QUESTION_TYPES.SINGLE || type === QUESTION_TYPES.MULTIPLE) &&
      (!optionA || !optionB)
    ) {
      skippedRows.push({
        rowNumber,
        reason: '单选题/多选题至少需要选项A和选项B',
        content,
      })
      continue
    }

    parsedRows.push({
      content,
      type,
      score,
      optionA: optionA || null,
      optionB: optionB || null,
      optionC: optionC || null,
      optionD: optionD || null,
      answer,
      scope: scope || null,
    })
  }

  return { parsedRows, skippedRows }
}

function tokenizeOptionAnswer(value: string) {
  const normalized = value.toUpperCase().trim()
  if (!normalized) {
    return []
  }

  const compact = normalized.replace(/[\s,，;；|、]+/g, '')
  if (/^[A-Z]+$/.test(compact)) {
    return Array.from(new Set(compact.split('')))
  }

  return Array.from(
    new Set(
      normalized
        .split(/[\s,，;；|、]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

function normalizeJudgeAnswer(value: string) {
  const normalized = value.trim().toUpperCase()
  if (['A', '对', '正确', 'TRUE', 'T', 'Y', 'YES', '1'].includes(normalized)) {
    return 'A'
  }
  if (['B', '错', '错误', 'FALSE', 'F', 'N', 'NO', '0'].includes(normalized)) {
    return 'B'
  }
  return normalized
}

export function evaluateQuestionAnswer(
  question: {
    type: string
    answer: string
  },
  answer: string
) {
  const rawAnswer = answer.trim()
  if (!rawAnswer) {
    return false
  }

  if (question.type === QUESTION_TYPES.SINGLE) {
    return tokenizeOptionAnswer(rawAnswer)[0] === tokenizeOptionAnswer(question.answer)[0]
  }

  if (question.type === QUESTION_TYPES.MULTIPLE) {
    const left = tokenizeOptionAnswer(rawAnswer).sort().join('|')
    const right = tokenizeOptionAnswer(question.answer).sort().join('|')
    return Boolean(left) && left === right
  }

  if (question.type === QUESTION_TYPES.JUDGE) {
    return normalizeJudgeAnswer(rawAnswer) === normalizeJudgeAnswer(question.answer)
  }

  const expectedAnswers = question.answer
    .split(/[\n|]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  return expectedAnswers.includes(rawAnswer.trim().toLowerCase())
}

export function shuffleArray<T>(items: T[]) {
  const next = [...items]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const current = next[index]
    next[index] = next[randomIndex]
    next[randomIndex] = current
  }

  return next
}

export function getQuestionOptionEntries(question: {
  type?: string
  optionA?: string | null
  optionB?: string | null
  optionC?: string | null
  optionD?: string | null
}) {
  if (
    question.type === QUESTION_TYPES.JUDGE &&
    !question.optionA &&
    !question.optionB &&
    !question.optionC &&
    !question.optionD
  ) {
    return [
      { key: 'A', value: '对' },
      { key: 'B', value: '错' },
    ]
  }

  return [
    { key: 'A', value: question.optionA || '' },
    { key: 'B', value: question.optionB || '' },
    { key: 'C', value: question.optionC || '' },
    { key: 'D', value: question.optionD || '' },
  ].filter((item) => item.value)
}

export function calculateQuestionBonusMultiplier(rank: number, totalStudents: number) {
  if (rank <= 0 || totalStudents <= 0) {
    return 0
  }

  // Use cumulative headcount cutoffs so small classes still produce a first-tier winner.
  const top10Cutoff = Math.max(1, Math.ceil(totalStudents * 0.1))
  const top20Cutoff = Math.max(top10Cutoff, Math.ceil(totalStudents * 0.2))
  const top30Cutoff = Math.max(top20Cutoff, Math.ceil(totalStudents * 0.3))
  const top40Cutoff = Math.max(top30Cutoff, Math.ceil(totalStudents * 0.4))
  const top50Cutoff = Math.max(top40Cutoff, Math.ceil(totalStudents * 0.5))
  const top60Cutoff = Math.max(top50Cutoff, Math.ceil(totalStudents * 0.6))
  const top70Cutoff = Math.max(top60Cutoff, Math.ceil(totalStudents * 0.7))
  const top80Cutoff = Math.max(top70Cutoff, Math.ceil(totalStudents * 0.8))
  const top90Cutoff = Math.max(top80Cutoff, Math.ceil(totalStudents * 0.9))

  if (rank <= top10Cutoff) {
    return 1.5
  }
  if (rank <= top20Cutoff) {
    return 1.4
  }
  if (rank <= top30Cutoff) {
    return 1.3
  }
  if (rank <= top40Cutoff) {
    return 1.2
  }
  if (rank <= top50Cutoff) {
    return 1.1
  }
  if (rank <= top60Cutoff) {
    return 1
  }
  if (rank <= top70Cutoff) {
    return 0.7
  }
  if (rank <= top80Cutoff) {
    return 0.5
  }
  if (rank <= top90Cutoff) {
    return 0.4
  }
  return 0.3
}

export function serializeJson(value: unknown) {
  return JSON.stringify(value)
}

export function parseJson<T>(value?: string | null, fallback?: T) {
  if (!value) {
    return fallback ?? null
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback ?? null
  }
}

export function getModeLabel(mode: string) {
  return mode === PRACTICE_MODES.QUESTION ? '逐题练习' : '整卷练习'
}

export function getStatusLabel(status: string) {
  if (status === PRACTICE_STATUSES.PENDING) {
    return '待开始'
  }
  if (status === PRACTICE_STATUSES.ACTIVE) {
    return '进行中'
  }
  if (status === PRACTICE_STATUSES.REVIEW) {
    return '答题结束'
  }
  return '已结束'
}
