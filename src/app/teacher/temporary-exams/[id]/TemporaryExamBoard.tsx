'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { ExamAnswers, ExamGrades, TemporaryPaper } from '@/lib/temporary-exam-paper'
import { examDate, examRequest, examStatus } from '@/lib/temporary-exam-client'
import TemporaryExamQuestion from '@/components/TemporaryExamQuestion'

type Attempt = { id: string; studentNumber: string; studentName: string; answers: ExamAnswers; grades: ExamGrades; focusLostCount: number; startedAt: string; deadline: string; submittedAt: string | null; autoSubmitted: boolean; updatedAt: string;
  result: { objectiveScore: number; manualScore: number; totalScore: number; pendingCount: number; scores: Record<string, number | null> };
  events: { id: string; type: string; occurredAt: string }[] }
type Detail = { exam: { id: string; title: string; status: string; startsAt: string; endsAt: string; paper: TemporaryPaper }; attempts: Attempt[] }
const eventLabels: Record<string, string> = { START: '开始考试', RESUME: '身份续答', BLUR: '切换应用 / 窗口失焦', HIDDEN: '切换标签', FULLSCREEN_EXIT: '退出全屏', PAGE_EXIT: '离开页面', OFFLINE: '网络断开', SUBMIT: '主动交卷' }

function ManualGrade({ questionId, max, current, disabled, onSave }: { questionId: string; max: number; current?: { score: number; feedback: string }; disabled: boolean; onSave: (id: string, score: number, feedback: string) => Promise<void> }) {
  const [score, setScore] = useState(current?.score.toString() ?? '')
  const [feedback, setFeedback] = useState(current?.feedback || '')
  return <form className="flex flex-wrap items-end gap-3 rounded-lg bg-blue-50 p-4" onSubmit={async e => { e.preventDefault(); await onSave(questionId, Number(score), feedback) }}>
    <label className="text-sm">人工得分 / {max}<input aria-label={`第${questionId.replace('q', '')}题人工得分`} type="number" min={0} max={max} step="0.01" required value={score} disabled={disabled} onChange={e => setScore(e.target.value)} className="mt-1 block w-28 rounded-lg border p-2" /></label>
    <label className="min-w-52 flex-1 text-sm">评语<input maxLength={2000} value={feedback} disabled={disabled} onChange={e => setFeedback(e.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
    <button disabled={disabled} className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-40">保存本题评分</button>
  </form>
}

export default function TemporaryExamBoard({ initialData }: { initialData: Detail }) {
  const [data, setData] = useState(initialData)
  const [selectedId, setSelectedId] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [showEnd, setShowEnd] = useState(false)
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])
  const exam = data.exam
  const api = `/api/temporary-exams/${exam.id}`
  const selected = data.attempts.find(a => a.id === selectedId)
  const refresh = async () => { setData(await examRequest<Detail>(api)) }
  async function action(body: object) {
    setBusy(true); setMessage('')
    try { await examRequest(api, body); await refresh(); setMessage('操作已保存。') }
    catch (e) { setMessage((e as Error).message) }
    finally { setBusy(false) }
  }
  const status = examStatus(exam.status, exam.endsAt)
  return <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-slate-900">
    <Link href="/teacher/temporary-exams" className="text-sm text-blue-700">← 临时考试列表</Link>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold">{exam.title}</h1><p className="mt-2 text-sm text-slate-600">{status} · {exam.paper.durationMinutes} 分钟 / 人 · {exam.paper.totalScore} 分 · {data.attempts.length} 人参加</p><p className="mt-1 text-sm text-slate-500">{examDate(exam.startsAt)} — {examDate(exam.endsAt)}</p></div>
      <div className="flex flex-wrap gap-2">
        {exam.status === 'DRAFT' && status !== '已结束' && <button disabled={busy} onClick={() => void action({ action: 'START' })} className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white">开启考试</button>}
        {exam.status === 'ACTIVE' && status !== '已结束' && <button disabled={busy} onClick={() => setShowEnd(true)} className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white">结束考试</button>}
        <button disabled={busy} onClick={() => { void refresh().catch(e => setMessage((e as Error).message)) }} className="rounded-lg border bg-white px-4 py-2 text-sm">刷新答卷</button>
        <a href={`${api}/export?format=scores`} className="rounded-lg border bg-white px-4 py-2 text-sm">导出成绩 XLSX</a>
        <a href={`${api}/export?format=papers`} className="rounded-lg border bg-white px-4 py-2 text-sm">导出试卷与答卷 ZIP</a>
      </div>
    </div>
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-5"><p className="mb-3 text-sm text-blue-900">考生专属链接：开启考试后，考生填写学号、姓名进入。请将链接发给本场考生。</p>
      <div className="flex flex-wrap items-center gap-3"><code className="break-all rounded bg-white px-3 py-2 text-sm">{origin}/exam/{exam.id}</code><button onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/exam/${exam.id}`); setMessage('考生链接已复制。') } catch { setMessage('请手动复制考生链接。') } }} className="rounded-lg bg-blue-700 px-3 py-2 text-sm text-white">复制链接</button><Link href={`/exam/${exam.id}`} target="_blank" className="text-sm text-blue-700 underline">打开考生入口</Link></div>
    </div>
    {message && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
    <section className="overflow-hidden rounded-xl bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 p-5"><h2 className="text-lg font-semibold">考生答卷</h2><input placeholder="查找学号或姓名" aria-label="查找学号或姓名" value={search} onChange={e => setSearch(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" /></div>
      <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="bg-slate-50"><tr>{['学号', '姓名', '状态', '客观题', '人工评分', '当前合计', '切屏次数', '交卷时间', '操作'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{data.attempts.filter(a => `${a.studentNumber} ${a.studentName}`.includes(search)).map(a => <tr key={a.id} className={`border-t ${selectedId === a.id ? 'bg-blue-50' : ''}`}>
          <td className="px-4 py-3">{a.studentNumber}</td><td className="px-4 py-3">{a.studentName}</td><td className="px-4 py-3">{a.submittedAt ? a.autoSubmitted ? '自动交卷' : '已交卷' : '作答中'}</td>
          <td className="px-4 py-3">{a.result.objectiveScore}</td><td className="px-4 py-3">{a.result.manualScore} {a.result.pendingCount > 0 && <span className="text-amber-800">（{a.result.pendingCount}题待评）</span>}</td><td className="px-4 py-3">{a.result.totalScore}{a.result.pendingCount ? '（未评完）' : ''}</td><td className="px-4 py-3">{a.focusLostCount}</td><td className="px-4 py-3">{a.submittedAt ? examDate(a.submittedAt) : '—'}</td>
          <td className="px-4 py-3"><button onClick={() => setSelectedId(a.id)} className="text-blue-700 underline">查看 / 批阅</button></td>
        </tr>)}</tbody></table>{!data.attempts.length && <p className="p-6 text-sm text-slate-500">尚无考生进入。点击“刷新答卷”获取最新情况。</p>}</div>
    </section>
    {selected && <section className="space-y-5 rounded-xl bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{selected.studentNumber} · {selected.studentName} 的答卷</h2><a href={`${api}/export?format=papers&attemptId=${selected.id}`} className="text-sm text-blue-700 underline">导出此考生答卷</a></div>
      <p className="text-sm text-slate-600">开始：{examDate(selected.startedAt)} · 截止：{examDate(selected.deadline)} · 最近保存：{examDate(selected.updatedAt)}</p>
      {!selected.submittedAt && <p className="rounded-lg bg-amber-50 p-3 text-sm">考生尚未交卷，可查看当前保存内容，交卷后可人工评分。</p>}
      {exam.paper.questions.map(q => <article key={`${selected.id}:${q.id}`} className="space-y-4 rounded-xl border p-5">
        <TemporaryExamQuestion question={q} />
        {q.options?.map(o => <p key={o.key} className="text-sm">{o.key}. {o.text}</p>)}
        <div><p className="mb-2 text-sm font-semibold">考生作答</p><pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 font-mono text-sm leading-6">{selected.answers[q.id] || '（未作答）'}</pre></div>
        <details className="rounded-lg border border-emerald-100 p-3 text-sm"><summary className="cursor-pointer text-emerald-800">查看参考答案 / 评分建议</summary><pre className="mt-3 whitespace-pre-wrap leading-6">{q.answers?.join('\n或\n') || q.referenceAnswer || '由教师评定'}</pre>{q.rubric && <p className="mt-3 leading-6">{q.rubric}</p>}</details>
        {q.grading === 'AUTO' ? <p className="text-sm text-blue-800">自动判分：{selected.result.scores[q.id]} / {q.score}</p> : <ManualGrade questionId={q.id} max={q.score} current={selected.grades[q.id]} disabled={busy || !selected.submittedAt} onSave={async (id, score, feedback) => action({ action: 'GRADE', attemptId: selected.id, questionId: id, score, feedback })} />}
      </article>)}
      <details className="rounded-lg border p-4 text-sm"><summary className="cursor-pointer font-medium">监考记录（{selected.events.length} 条）</summary><ul className="mt-4 space-y-2">{selected.events.map(e => <li key={e.id}>{examDate(e.occurredAt)} · {eventLabels[e.type] || e.type}</li>)}</ul></details>
    </section>}
    {showEnd && <div role="dialog" aria-modal="true" aria-labelledby="end-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"><div className="max-w-md space-y-4 rounded-xl bg-white p-6"><h2 id="end-title" className="text-xl font-bold">结束本场考试</h2><p className="text-sm leading-7">未交卷的考生将按服务器最后保存的答案自动交卷，结束后不能继续作答。</p><div className="flex justify-end gap-3"><button disabled={busy} onClick={() => setShowEnd(false)} className="rounded-lg border px-4 py-2">取消</button><button disabled={busy} onClick={async () => { await action({ action: 'END' }); setShowEnd(false) }} className="rounded-lg bg-red-700 px-4 py-2 text-white">确认结束</button></div></div></div>}
  </div>
}
