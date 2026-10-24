import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import type { ExamAnswers, ExamGrades, TemporaryPaper } from './temporary-exam-paper'
import { scoreTemporaryAttempt } from './temporary-exam-paper'
import type { teacherTemporaryExamDetail } from './temporary-exams'

type Detail = Awaited<ReturnType<typeof teacherTemporaryExamDetail>>
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const date = (value: Date | null) => value ? value.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '—'
const pre = (text: unknown) => `<pre>${escape(text)}</pre>`

export function printableTemporaryPaper(paper: TemporaryPaper, input: {
  title: string; answers?: ExamAnswers; grades?: ExamGrades; studentNumber?: string; studentName?: string;
  submittedAt?: Date | null; autoSubmitted?: boolean; answerKey?: boolean;
}) {
  const result = input.answers ? scoreTemporaryAttempt(paper, input.answers, input.grades || {}) : null
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(input.title)}</title>
<style>body{font-family:Arial,"PingFang SC","Microsoft YaHei",sans-serif;max-width:900px;margin:36px auto;padding:0 24px;color:#172033;line-height:1.7}h1{font-size:26px}h2{font-size:20px;margin-top:32px}h3{font-size:16px;white-space:pre-wrap}article{border:1px solid #d8dee8;border-radius:8px;padding:20px;margin:16px 0;break-inside:avoid}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.7 ui-monospace,Consolas,monospace;background:#f4f6f8;padding:14px}.answer{min-height:80px}.meta{color:#475569}.score{font-weight:bold;color:#1e40af}@media print{body{margin:0;max-width:none}article{border-radius:0}h2{break-after:avoid}pre{background:white}}</style></head><body>
<h1>${escape(input.title)}</h1><p class="meta">${paper.durationMinutes}分钟 · 满分${paper.totalScore}分${input.answerKey ? ' · 教师参考答案' : ''}</p>
${input.studentNumber ? `<p>学号：${escape(input.studentNumber)}　姓名：${escape(input.studentName)}</p><p class="meta">${input.submittedAt ? `${input.autoSubmitted ? '自动交卷' : '交卷时间'}：${date(input.submittedAt)}` : '尚未交卷（当前保存快照）'}</p>` : '<p>学号：________________　姓名：________________</p>'}
${result ? `<p class="score">客观题 ${result.objectiveScore} 分，人工评分 ${result.manualScore} 分，当前合计 ${result.totalScore} 分${result.pendingCount ? `（${result.pendingCount}题待评，非最终成绩）` : ''}</p>` : ''}
${pre(paper.instructions)}
${paper.sections.map(section => `<section><h2>${escape(section.title)}</h2><p>${escape(section.description)}</p>${paper.questions.filter(q => q.sectionId === section.id).map(q => `<article><h3>${q.number}. ${escape(q.content)}（${q.score}分）</h3>${q.code ? pre(q.code) : ''}${q.options?.map(o => `<p>${escape(o.key)}. ${escape(o.text)}</p>`).join('') || ''}
${input.answers ? `<p><b>考生作答</b></p>${pre(input.answers[q.id] || '（未作答）')}<p class="score">得分：${result!.scores[q.id] ?? '待人工评分'} / ${q.score}</p>${input.grades?.[q.id]?.feedback ? `<p>教师评语：${escape(input.grades[q.id].feedback)}</p>` : ''}` : input.answerKey ? '' : '<div class="answer">作答：</div>'}
${input.answerKey ? `<p><b>参考答案</b></p>${pre(q.answers?.join('\n或\n') || q.referenceAnswer || '教师评定')}${q.rubric ? `<p>评分建议：${escape(q.rubric)}</p>` : ''}` : ''}</article>`).join('')}</section>`).join('')}</body></html>`
}

export function temporaryScoresWorkbook(detail: Detail) {
  const rows = detail.attempts.map(a => ({
    学号: a.studentNumber, 姓名: a.studentName, 状态: a.submittedAt ? a.autoSubmitted ? '自动交卷' : '已交卷' : '作答中',
    客观题得分: a.result.objectiveScore, 人工已评得分: a.result.manualScore, 当前合计: a.result.totalScore,
    待评题数: a.result.pendingCount, 最终总分: a.result.pendingCount || !a.submittedAt ? '待评阅或交卷' : a.result.totalScore,
    切屏次数: a.focusLostCount, 开始时间: date(a.startedAt), 截止时间: date(a.deadline), 交卷时间: date(a.submittedAt),
    ...Object.fromEntries(detail.exam.paper.questions.map(q => [`第${q.number}题（${q.score}分）`, a.result.scores[q.id] ?? '待评'])),
  }))
  const sheet = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([['学号', '姓名', '状态', '客观题得分', '人工已评得分', '当前合计', '待评题数', '最终总分', '切屏次数', '开始时间', '截止时间', '交卷时间']])
  sheet['!cols'] = Array.from({ length: 12 + detail.exam.paper.questions.length }, (_, i) => ({ wch: i >= 9 && i <= 11 ? 24 : 16 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, '考试成绩')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['考试名称', detail.exam.title], ['试卷名称', detail.exam.paper.title], ['满分', detail.exam.paper.totalScore],
    ['说明', '待评题目不作为零分，人工评分完成且已交卷后才生成最终总分。'], ['导出时间（北京时间）', date(new Date())],
  ]), '考试信息')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export async function temporaryPapersZip(detail: Detail, attemptId?: string | null) {
  const zip = new JSZip()
  const paper = detail.exam.paper
  zip.file('空白试卷.html', printableTemporaryPaper(paper, { title: detail.exam.title }))
  zip.file('教师参考答案.html', printableTemporaryPaper(paper, { title: detail.exam.title, answerKey: true }))
  zip.file('结构化题库.json', JSON.stringify(paper, null, 2))
  const attempts = attemptId ? detail.attempts.filter(a => a.id === attemptId) : detail.attempts
  for (const a of attempts) {
    const safeName = a.studentName.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    zip.file(`答卷/${a.studentNumber}_${safeName}_${a.id}.html`, printableTemporaryPaper(paper, {
      title: detail.exam.title, answers: a.answers as ExamAnswers, grades: a.grades as ExamGrades,
      studentNumber: a.studentNumber, studentName: a.studentName, submittedAt: a.submittedAt, autoSubmitted: a.autoSubmitted,
    }))
  }
  zip.file('答卷与评分记录.json', JSON.stringify({ exportedAt: new Date(), exam: detail.exam, attempts }, null, 2))
  zip.file('使用说明.txt', 'HTML 文件可用浏览器打开、打印或另存为 PDF。\n空白试卷与考生答卷不含参考答案，教师参考答案单独保存。\n未交卷答卷为服务器当前快照，未评题显示待人工评分；当前合计不是最终成绩。\n结构化题库及完整评分记录仅供教师保存，请勿发给考生。\n')
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
