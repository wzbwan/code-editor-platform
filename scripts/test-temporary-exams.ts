import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { loadEnvConfig } from '@next/env'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import source from '../resources/temporary-exams/python-basics-60.json'
import { prisma } from '../src/lib/prisma'
import { publicTemporaryPaper, scoreTemporaryAttempt, validateTemporaryPaper } from '../src/lib/temporary-exam-paper'
import { createTemporaryExam, getPublicTemporaryExam, joinTemporaryExam, mutateTemporaryAttempt, teacherTemporaryExamAction, teacherTemporaryExamDetail } from '../src/lib/temporary-exams'
import { printableTemporaryPaper, temporaryPapersZip, temporaryScoresWorkbook } from '../src/lib/temporary-exam-export'

loadEnvConfig(process.cwd())
async function main() {
  const paper = validateTemporaryPaper(source)
  assert.equal(paper.questions.length, 15)
  const correct = Object.fromEntries(paper.questions.filter(q => q.grading === 'AUTO').map(q => [q.id, q.answers![0]]))
  assert.equal(scoreTemporaryAttempt(paper, correct, {}).objectiveScore, 45)
  assert.equal(scoreTemporaryAttempt(paper, correct, {}).pendingCount, 5)
  assert.equal(scoreTemporaryAttempt(paper, { q6: '7\r\n44\n' }, {}).objectiveScore, 5)
  assert.equal(scoreTemporaryAttempt(paper, { q6: '744' }, {}).objectiveScore, 0)
  const publicPaper = publicTemporaryPaper(paper)
  for (const q of publicPaper.questions) {
    assert.ok(!('answers' in q) && !('referenceAnswer' in q) && !('rubric' in q))
  }
  assert.ok(!('answerKeyNote' in publicPaper))
  assert.throws(() => validateTemporaryPaper({ ...paper, totalScore: 99 }))
  assert.throws(() => validateTemporaryPaper({ ...paper, questions: paper.questions.map(q => q.id === 'q14' ? { ...q, grading: 'AUTO', answers: ['x'] } : q) }))
  assert.throws(() => validateTemporaryPaper({ ...paper, questions: [{ ...paper.questions[0], id: '__proto__' }] }))
  const teacher = await prisma.user.create({ data: { username: `temporary-exam-test-${randomUUID()}`, password: 'unused-test-account', name: '临时考试自动测试', role: 'TEACHER' } })
  try {
    const exam = await createTemporaryExam(teacher.id, { paper, startsAt: new Date(Date.now() - 1000).toISOString(), endsAt: new Date(Date.now() + 7200000).toISOString() })
    const meta = await getPublicTemporaryExam(exam.id)
    assert.ok(!('paper' in meta))
    await assert.rejects(joinTemporaryExam(exam.id, { studentNumber: '001', studentName: '测试考生' }))
    await assert.rejects(teacherTemporaryExamAction('other-teacher', exam.id, { action: 'START' }))
    await teacherTemporaryExamAction(teacher.id, exam.id, { action: 'START' })
    const first = await joinTemporaryExam(exam.id, { studentNumber: '001', studentName: '测试考生' })
    assert.ok(first.token)
    assert.equal(first.deadline.getTime() - first.serverNow.getTime() <= 3600000, true)
    const save = await mutateTemporaryAttempt(exam.id, { action: 'SAVE', attemptId: first.id, token: first.token, revision: first.revision, answers: { ...correct, q14: '<script>alert(1)</script>' } })
    assert.ok(!('scores' in save))
    await assert.rejects(mutateTemporaryAttempt(exam.id, { action: 'SAVE', attemptId: first.id, token: first.token, revision: first.revision, answers: {} }))
    await assert.rejects(mutateTemporaryAttempt(exam.id, { action: 'SAVE', attemptId: first.id, token: 'invalid', revision: save.revision, answers: {} }))
    await assert.rejects(joinTemporaryExam(exam.id, { studentNumber: '001', studentName: '错误姓名' }))
    await mutateTemporaryAttempt(exam.id, { action: 'LOCK', attemptId: first.id, token: first.token, revision: save.revision, answers: correct, reason: 'BLUR' })
    await assert.rejects(mutateTemporaryAttempt(exam.id, { action: 'SAVE', attemptId: first.id, token: first.token, revision: save.revision + 1, answers: {} }))
    const resumed = await joinTemporaryExam(exam.id, { studentNumber: '001', studentName: '测试考生' })
    assert.deepEqual(resumed.answers, correct)
    assert.equal(resumed.deadline.getTime(), first.deadline.getTime())
    assert.notEqual(resumed.token, first.token)
    await assert.rejects(teacherTemporaryExamAction(teacher.id, exam.id, { action: 'GRADE', attemptId: first.id, questionId: 'q14', score: 5 }))
    const rejoined = await joinTemporaryExam(exam.id, { studentNumber: '001', studentName: '测试考生' })
    await assert.rejects(mutateTemporaryAttempt(exam.id, { action: 'SAVE', attemptId: first.id, token: resumed.token, revision: resumed.revision, answers: {} }))
    const concurrent = await Promise.allSettled([1, 2].map(() => mutateTemporaryAttempt(exam.id, { action: 'SAVE', attemptId: first.id, token: rejoined.token, revision: rejoined.revision, answers: correct })))
    assert.equal(concurrent.filter(r => r.status === 'fulfilled').length, 1)
    await mutateTemporaryAttempt(exam.id, { action: 'SUBMIT', attemptId: first.id, token: rejoined.token, revision: rejoined.revision + 1, answers: { ...correct, q14: '<script>alert(1)</script>' } })
    const submitted = await joinTemporaryExam(exam.id, { studentNumber: '001', studentName: '测试考生' })
    assert.ok(submitted.submittedAt)
    assert.equal(submitted.token, undefined)
    await assert.rejects(teacherTemporaryExamAction(teacher.id, exam.id, { action: 'GRADE', attemptId: first.id, questionId: 'q14', score: 21 }))
    await assert.rejects(teacherTemporaryExamAction(teacher.id, exam.id, { action: 'GRADE', attemptId: first.id, questionId: 'q14', score: -1 }))
    await assert.rejects(teacherTemporaryExamAction(teacher.id, exam.id, { action: 'GRADE', attemptId: first.id, questionId: 'q1', score: 4 }))
    await assert.rejects(teacherTemporaryExamAction(teacher.id, exam.id, { action: 'GRADE', attemptId: first.id, questionId: 'q14', score: 1.123 }))
    await teacherTemporaryExamAction(teacher.id, exam.id, { action: 'GRADE', attemptId: first.id, questionId: 'q14', score: 1.15 })
    assert.equal((await teacherTemporaryExamDetail(teacher.id, exam.id)).attempts[0].result.manualScore, 1.15)
    for (const q of paper.questions.filter(q => q.grading === 'MANUAL')) {
      await teacherTemporaryExamAction(teacher.id, exam.id, { action: 'GRADE', attemptId: first.id, questionId: q.id, score: q.score, feedback: '测试评分' })
    }
    let detail = await teacherTemporaryExamDetail(teacher.id, exam.id)
    assert.equal(detail.attempts[0].result.totalScore, 100)
    assert.equal(detail.attempts[0].result.pendingCount, 0)
    assert.equal(detail.attempts[0].focusLostCount, 1)
    assert.ok(!('tokenHash' in detail.attempts[0]))
    const wb = XLSX.read(temporaryScoresWorkbook(detail))
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['考试成绩'])
    assert.equal(rows[0]['学号'], '001')
    assert.equal(rows[0]['最终总分'], 100)
    const archive = await JSZip.loadAsync(await temporaryPapersZip(detail))
    assert.ok(archive.file('空白试卷.html'))
    assert.ok(archive.file('教师参考答案.html'))
    const studentFile = Object.keys(archive.files).find(f => f.startsWith('答卷/') && f.endsWith('.html'))!
    const studentHtml = await archive.file(studentFile)!.async('string')
    assert.ok(studentHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
    assert.ok(!studentHtml.includes('<script>'))
    assert.ok(!studentHtml.includes('参考答案'))
    assert.ok(!printableTemporaryPaper(paper, { title: 'blank' }).includes('price = float(input())'))
    const expiring = await joinTemporaryExam(exam.id, { studentNumber: '002', studentName: '到时测试' })
    await prisma.temporaryExamAttempt.update({ where: { id: expiring.id }, data: { deadline: new Date(Date.now() - 1000) } })
    const expiredResult = await mutateTemporaryAttempt(exam.id, { action: 'SAVE', attemptId: expiring.id, token: expiring.token, revision: expiring.revision, answers: { q1: 'C' } })
    assert.ok(expiredResult.submittedAt)
    assert.ok(!('answers' in expiredResult) || !('q1' in expiredResult.answers))
    const ending = await joinTemporaryExam(exam.id, { studentNumber: '003', studentName: '结束测试' })
    await mutateTemporaryAttempt(exam.id, { action: 'SAVE', attemptId: ending.id, token: ending.token, revision: ending.revision, answers: { q1: 'C' } })
    await teacherTemporaryExamAction(teacher.id, exam.id, { action: 'END' })
    detail = await teacherTemporaryExamDetail(teacher.id, exam.id)
    const ended = detail.attempts.find(a => a.id === ending.id)!
    assert.ok(ended.submittedAt && ended.autoSubmitted)
    assert.equal(ended.result.objectiveScore, 4)
    assert.equal(ended.result.pendingCount, 5)
    await assert.rejects(joinTemporaryExam(exam.id, { studentNumber: '004', studentName: '新考生' }))
    await assert.rejects(teacherTemporaryExamDetail('other-teacher', exam.id))
    console.log('PASS: paper validation, answer secrecy, identity/resume, concurrency, locks, deadlines, manual grading, teacher isolation, XLSX and ZIP exports')
  } finally {
    await prisma.user.delete({ where: { id: teacher.id } })
    await prisma.$disconnect()
  }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
