export type TemporaryQuestionType = 'SINGLE' | 'MULTIPLE' | 'JUDGE' | 'OUTPUT' | 'FILL' | 'CODE' | 'TEXT'
export interface TemporaryQuestion {
  id: string
  number: number
  sectionId: string
  type: TemporaryQuestionType
  grading: 'AUTO' | 'MANUAL'
  score: number
  content: string
  code?: string
  options?: { key: string; text: string }[]
  answers?: string[]
  referenceAnswer?: string
  rubric?: string
}
export interface TemporaryPaper {
  version: 1
  title: string
  durationMinutes: number
  totalScore: number
  instructions: string
  answerKeyNote?: string
  sections: { id: string; title: string; description: string }[]
  questions: TemporaryQuestion[]
}
export type PublicTemporaryPaper = Omit<TemporaryPaper, 'questions' | 'answerKeyNote'> & {
  questions: Omit<TemporaryQuestion, 'answers' | 'referenceAnswer' | 'rubric'>[]
}
export type ExamAnswers = Record<string, string>
export type ExamGrades = Record<string, { score: number; feedback: string }>

const record = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
function text(v: unknown, label: string, max = 20000, allowEmpty = false): string {
  if (typeof v !== 'string' || (!allowEmpty && !v.trim()) || v.length > max) throw new Error(`${label}格式错误`)
  return v
}
function integer(v: unknown, label: string, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0 || v > max) throw new Error(`${label}必须为1至${max}的整数`)
  return v
}
function identifier(value: unknown, label: string) {
  const result = text(value, label, 80)
  if (!/^[A-Za-z0-9_-]+$/.test(result) || ['__proto__', 'constructor', 'prototype'].includes(result)) throw new Error(`${label}只能使用字母、数字、横线和下划线，且不能使用保留字`)
  return result
}

export function validateTemporaryPaper(input: unknown): TemporaryPaper {
  if (!record(input) || input.version !== 1) throw new Error('题库必须为 version: 1 的 JSON 文件')
  if (!Array.isArray(input.sections) || !input.sections.length || input.sections.length > 30) throw new Error('请设置1至30个大题分组')
  const sections = input.sections.map((s) => {
    if (!record(s)) throw new Error('大题分组格式错误')
    return { id: identifier(s.id, '分组ID'), title: text(s.title, '分组名称', 200), description: text(s.description ?? '', '分组说明', 2000, true) }
  })
  const sectionIds = new Set(sections.map(s => s.id))
  if (sectionIds.size !== sections.length) throw new Error('分组ID不能重复')
  if (!Array.isArray(input.questions) || !input.questions.length || input.questions.length > 200) throw new Error('题库需要1至200道题')
  const questions: TemporaryQuestion[] = input.questions.map((q) => {
    if (!record(q)) throw new Error('题目格式错误')
    const type = q.type as TemporaryQuestionType
    if (!['SINGLE', 'MULTIPLE', 'JUDGE', 'OUTPUT', 'FILL', 'CODE', 'TEXT'].includes(type)) throw new Error('不支持的题型')
    if (q.grading !== 'AUTO' && q.grading !== 'MANUAL') throw new Error('每题必须指定 AUTO 或 MANUAL 评分方式')
    if (['CODE', 'TEXT'].includes(type) && q.grading !== 'MANUAL') throw new Error('程序题和主观题必须人工评分')
    const result: TemporaryQuestion = {
      id: identifier(q.id, '题目ID'), number: integer(q.number, '题号', 1000),
      sectionId: text(q.sectionId, '题目分组', 80), type, grading: q.grading,
      score: integer(q.score, '分值', 1000), content: text(q.content, '题干'),
    }
    if (!sectionIds.has(result.sectionId)) throw new Error(`第${result.number}题所属分组不存在`)
    if (q.code !== undefined) result.code = text(q.code, '题干代码', 20000, true)
    if (['SINGLE', 'MULTIPLE', 'JUDGE'].includes(type)) {
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 10) throw new Error('选择/判断题需要2至10个选项')
      result.options = q.options.map(o => {
        if (!record(o)) throw new Error('选项格式错误')
        const key = text(o.key, '选项标识', 10)
        if (!/^[A-Z0-9]+$/.test(key)) throw new Error('选项标识只能含大写字母和数字')
        return { key, text: text(o.text, '选项内容', 2000) }
      })
      if (new Set(result.options.map(o => o.key)).size !== result.options.length) throw new Error('选项标识不能重复')
    }
    if (q.grading === 'AUTO') {
      if (!Array.isArray(q.answers) || !q.answers.length || q.answers.length > 30) throw new Error('自动判分题必须提供参考答案数组')
      result.answers = q.answers.map(a => text(a, '参考答案', 10000))
      if (result.options && result.answers.some(a => {
        const keys = type === 'MULTIPLE' ? a.split(',') : [a]
        return new Set(keys).size !== keys.length || keys.some(k => !result.options!.some(o => o.key === k))
      })) throw new Error(`第${result.number}题答案与选项不匹配（多选用逗号分隔）`)
    }
    if (q.referenceAnswer !== undefined) result.referenceAnswer = text(q.referenceAnswer, '人工参考答案', 20000, true)
    if (q.rubric !== undefined) result.rubric = text(q.rubric, '评分标准', 10000, true)
    return result
  })
  if (new Set(questions.map(q => q.id)).size !== questions.length || new Set(questions.map(q => q.number)).size !== questions.length) throw new Error('题目ID和题号不能重复')
  if (sections.some(s => !questions.some(q => q.sectionId === s.id))) throw new Error('大题分组不能为空')
  const totalScore = integer(input.totalScore, '总分', 10000)
  if (questions.reduce((sum, q) => sum + q.score, 0) !== totalScore) throw new Error('各题分值之和必须等于总分')
  return {
    version: 1, title: text(input.title, '试卷名称', 200),
    durationMinutes: integer(input.durationMinutes, '考试时长', 1440), totalScore,
    instructions: text(input.instructions ?? '', '考试说明', 10000, true),
    answerKeyNote: text(input.answerKeyNote ?? '', '答案说明', 2000, true), sections, questions,
  }
}

export function publicTemporaryPaper(paper: TemporaryPaper): PublicTemporaryPaper {
  return {
    version: paper.version, title: paper.title, durationMinutes: paper.durationMinutes,
    totalScore: paper.totalScore, instructions: paper.instructions, sections: paper.sections,
    questions: paper.questions.map(q => ({ id: q.id, number: q.number, sectionId: q.sectionId,
      type: q.type, grading: q.grading, score: q.score, content: q.content, code: q.code, options: q.options })),
  }
}

export function validateExamAnswers(input: unknown, paper: TemporaryPaper): ExamAnswers {
  if (!record(input)) throw new Error('答案格式错误')
  const result: ExamAnswers = {}
  for (const [id, answer] of Object.entries(input)) {
    const question = paper.questions.find(q => q.id === id)
    if (!question) throw new Error('包含未知题目')
    result[id] = text(answer, '作答内容', 20000, true)
  }
  return result
}
export function normalizeObjective(value: string, type: TemporaryQuestionType) {
  const normalized = value.replace(/\r\n?/g, '\n').split('\n').map(line => line.trimEnd()).join('\n').trim()
  return type === 'MULTIPLE' ? Array.from(new Set(normalized.split(',').map(s => s.trim()))).sort().join(',') : normalized
}
export function scoreTemporaryAttempt(paper: TemporaryPaper, answers: ExamAnswers, grades: ExamGrades) {
  let objectiveScore = 0
  let manualScore = 0
  let pendingCount = 0
  const scores: Record<string, number | null> = {}
  for (const q of paper.questions) {
    if (q.grading === 'AUTO') {
      const answer = normalizeObjective(answers[q.id] || '', q.type)
      const score = answer && q.answers?.some(a => normalizeObjective(a, q.type) === answer) ? q.score : 0
      scores[q.id] = score
      objectiveScore += score
    } else {
      const grade = Object.hasOwn(grades, q.id) ? grades[q.id] : undefined
      scores[q.id] = grade?.score ?? null
      if (grade) manualScore += grade.score
      else pendingCount++
    }
  }
  manualScore = Math.round(manualScore * 100) / 100
  return { objectiveScore, manualScore, totalScore: Math.round((objectiveScore + manualScore) * 100) / 100, pendingCount, scores }
}
