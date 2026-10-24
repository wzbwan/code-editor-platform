import { createHash, randomBytes } from 'crypto'
import type { Prisma, TemporaryExam, TemporaryExamAttempt } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { publicTemporaryPaper, scoreTemporaryAttempt, validateExamAnswers, validateTemporaryPaper } from './temporary-exam-paper'
import type { ExamAnswers, ExamGrades, TemporaryPaper } from './temporary-exam-paper'

export class TemporaryExamError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
const hash = (token: string) => createHash('sha256').update(token).digest('hex')
const json = (value: object) => value as Prisma.InputJsonValue
export const paperOf = (value: Prisma.JsonValue) => validateTemporaryPaper(value)
export const answersOf = (attempt: Pick<TemporaryExamAttempt, 'answers'>) => attempt.answers as ExamAnswers
export const gradesOf = (attempt: Pick<TemporaryExamAttempt, 'grades'>) => attempt.grades as ExamGrades

// Lock the exam before attempts on every write: joins, saves, ending and grading
// have one ordering, including concurrent requests from multiple browser tabs.
async function lockedExam<T>(id: string, work: (tx: Prisma.TransactionClient, exam: TemporaryExam) => Promise<T>) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "TemporaryExam" WHERE id = ${id} FOR UPDATE`
    const exam = await tx.temporaryExam.findUnique({ where: { id } })
    if (!exam) throw new TemporaryExamError('考试不存在', 404)
    return work(tx, exam)
  })
}

async function settle(tx: Prisma.TransactionClient, exam: { id: string; status: string; endsAt: Date }) {
  const now = new Date()
  // Per-student duration and the teacher's common closing time both apply.
  const expired = await tx.temporaryExamAttempt.findMany({
    where: { examId: exam.id, submittedAt: null,
      ...(exam.status === 'ENDED' || exam.endsAt <= now ? {} : { deadline: { lte: now } }),
    },
  })
  for (const a of expired) {
    await tx.temporaryExamAttempt.update({ where: { id: a.id }, data: {
      submittedAt: new Date(Math.min(a.deadline.getTime(), exam.endsAt.getTime(), now.getTime())),
      autoSubmitted: true, tokenHash: null,
    } })
  }
}

function attemptView(attempt: TemporaryExamAttempt, paper: TemporaryPaper, token?: string) {
  return {
    id: attempt.id, studentNumber: attempt.studentNumber, studentName: attempt.studentName,
    answers: answersOf(attempt), revision: attempt.revision, deadline: attempt.deadline,
    submittedAt: attempt.submittedAt, autoSubmitted: attempt.autoSubmitted, token,
    paper: publicTemporaryPaper(paper), serverNow: new Date(),
  }
}

export async function joinTemporaryExam(id: string, input: Record<string, unknown>) {
  const studentNumber = typeof input.studentNumber === 'string' ? input.studentNumber.trim() : ''
  const studentName = typeof input.studentName === 'string' ? input.studentName.trim() : ''
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(studentNumber)) throw new TemporaryExamError('学号请使用1至40位字母、数字、横线或下划线')
  if (!studentName || studentName.length > 60 || /[\x00-\x1f]/.test(studentName)) throw new TemporaryExamError('请填写有效姓名（最多60字）')
  return lockedExam(id, async (tx, exam) => {
    await settle(tx, exam)
    const paper = paperOf(exam.paper)
    let attempt = await tx.temporaryExamAttempt.findUnique({ where: { examId_studentNumber: { examId: id, studentNumber } } })
    if (attempt && attempt.studentName !== studentName) throw new TemporaryExamError('该学号已登记，请输入首次登记的姓名')
    if (attempt?.submittedAt) return attemptView(attempt, paper)
    const now = new Date()
    if (exam.status !== 'ACTIVE' || now < exam.startsAt || now >= exam.endsAt) throw new TemporaryExamError('考试尚未开始或已经结束')
    const token = randomBytes(32).toString('base64url')
    if (attempt) {
      attempt = await tx.temporaryExamAttempt.update({ where: { id: attempt.id }, data: { tokenHash: hash(token), revision: { increment: 1 } } })
    } else {
      attempt = await tx.temporaryExamAttempt.create({ data: {
        examId: id, studentNumber, studentName, answers: {}, grades: {}, tokenHash: hash(token),
        deadline: new Date(Math.min(exam.endsAt.getTime(), now.getTime() + paper.durationMinutes * 60000)),
      } })
    }
    await tx.temporaryExamEvent.create({ data: { attemptId: attempt.id, type: attempt.revision ? 'RESUME' : 'START' } })
    return attemptView(attempt, paper, token)
  })
}

export async function mutateTemporaryAttempt(id: string, input: Record<string, unknown>) {
  return lockedExam(id, async (tx, exam) => {
    const attempt = await tx.temporaryExamAttempt.findFirst({ where: { id: String(input.attemptId || ''), examId: id } })
    if (!attempt || typeof input.token !== 'string' || !attempt.tokenHash || hash(input.token) !== attempt.tokenHash) {
      throw new TemporaryExamError('答卷已锁定或已在其他页面续答，请重新输入学号和姓名', 401)
    }
    await settle(tx, exam)
    const paper = paperOf(exam.paper)
    const current = await tx.temporaryExamAttempt.findUniqueOrThrow({ where: { id: attempt.id } })
    if (current.submittedAt) return { ...attemptView(current, paper), expired: true }
    if (!['SAVE', 'SUBMIT', 'LOCK'].includes(String(input.action))) throw new TemporaryExamError('不支持的操作')
    if (input.revision !== current.revision) throw new TemporaryExamError('保存版本冲突，请重新填写身份续答', 409)
    const answers = validateExamAnswers(input.answers, paper)
    const action = String(input.action)
    const updated = await tx.temporaryExamAttempt.update({ where: { id: attempt.id }, data: {
      answers: json(answers), revision: { increment: 1 },
      ...(action === 'SUBMIT' ? { submittedAt: new Date(), tokenHash: null } : {}),
      ...(action === 'LOCK' ? { tokenHash: null, focusLostCount: { increment: 1 } } : {}),
    } })
    if (action !== 'SAVE') {
      const reason = ['BLUR', 'HIDDEN', 'FULLSCREEN_EXIT', 'PAGE_EXIT', 'OFFLINE'].includes(String(input.reason)) ? String(input.reason) : 'PAGE_EXIT'
      await tx.temporaryExamEvent.create({ data: { attemptId: attempt.id, type: action === 'LOCK' ? reason : 'SUBMIT' } })
    }
    return { revision: updated.revision, submittedAt: updated.submittedAt, serverNow: new Date() }
  })
}

export async function getPublicTemporaryExam(id: string) {
  const exam = await prisma.temporaryExam.findUnique({ where: { id } })
  if (!exam) throw new TemporaryExamError('考试不存在', 404)
  const paper = paperOf(exam.paper)
  return { id: exam.id, title: exam.title, status: exam.status, startsAt: exam.startsAt, endsAt: exam.endsAt,
    durationMinutes: paper.durationMinutes, totalScore: paper.totalScore, instructions: paper.instructions, serverNow: new Date() }
}

export async function createTemporaryExam(teacherId: string, input: Record<string, unknown>) {
  const paper = validateTemporaryPaper(input.paper)
  const title = typeof input.title === 'string' ? input.title.trim() : paper.title
  if (!title || title.length > 200) throw new TemporaryExamError('考试名称为1至200字')
  const startsAt = new Date(String(input.startsAt || ''))
  const endsAt = new Date(String(input.endsAt || ''))
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt || endsAt <= new Date()) {
    throw new TemporaryExamError('请设置有效的开始和结束时间，结束时间须在未来')
  }
  return prisma.temporaryExam.create({ data: { teacherId, title, paper: json(paper), startsAt, endsAt } })
}

export async function teacherTemporaryExamDetail(teacherId: string, id: string) {
  return lockedExam(id, async (tx, exam) => {
    if (exam.teacherId !== teacherId) throw new TemporaryExamError('考试不存在', 404)
    await settle(tx, exam)
    const paper = paperOf(exam.paper)
    const attempts = await tx.temporaryExamAttempt.findMany({ where: { examId: id }, orderBy: { studentNumber: 'asc' }, include: { events: { orderBy: { occurredAt: 'asc' } } } })
    return { exam: { ...exam, paper }, attempts: attempts.map(({ tokenHash: _token, ...a }) => ({ ...a,
      result: scoreTemporaryAttempt(paper, answersOf(a), gradesOf(a)),
    })) }
  })
}

export async function teacherTemporaryExamAction(teacherId: string, id: string, input: Record<string, unknown>) {
  return lockedExam(id, async (tx, exam) => {
    if (exam.teacherId !== teacherId) throw new TemporaryExamError('考试不存在', 404)
    if (input.action === 'START') {
      if (exam.status !== 'DRAFT' || exam.endsAt <= new Date()) throw new TemporaryExamError('仅可开启未过期的草稿考试')
      return tx.temporaryExam.update({ where: { id }, data: { status: 'ACTIVE', startsAt: new Date() } })
    }
    if (input.action === 'END') {
      if (exam.status !== 'ACTIVE') throw new TemporaryExamError('仅可结束正在进行的考试')
      const ended = await tx.temporaryExam.update({ where: { id }, data: { status: 'ENDED', endsAt: new Date() } })
      await settle(tx, ended)
      return { success: true }
    }
    if (input.action === 'GRADE') {
      await settle(tx, exam)
      const attempt = await tx.temporaryExamAttempt.findFirst({ where: { id: String(input.attemptId || ''), examId: id } })
      if (!attempt?.submittedAt) throw new TemporaryExamError('仅可批阅已交卷的答卷')
      const question = paperOf(exam.paper).questions.find(q => q.id === input.questionId && q.grading === 'MANUAL')
      if (!question) throw new TemporaryExamError('请选择人工评分题目')
      if (typeof input.score !== 'number' || !Number.isFinite(input.score) || input.score < 0 || input.score > question.score || Math.abs(input.score * 100 - Math.round(input.score * 100)) > 0.000001) throw new TemporaryExamError(`分数须为0至${question.score}之间的数值，最多两位小数`)
      const feedback = typeof input.feedback === 'string' ? input.feedback.trim() : ''
      if (feedback.length > 2000) throw new TemporaryExamError('评语最多2000字')
      const grades = { ...gradesOf(attempt), [question.id]: { score: Math.round(input.score * 100) / 100, feedback } }
      await tx.temporaryExamAttempt.update({ where: { id: attempt.id }, data: { grades: json(grades) } })
      return { success: true }
    }
    throw new TemporaryExamError('不支持的操作')
  })
}
