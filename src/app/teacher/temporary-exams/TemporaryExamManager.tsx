'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { validateTemporaryPaper } from '@/lib/temporary-exam-paper'
import type { TemporaryPaper } from '@/lib/temporary-exam-paper'
import { examDate, examRequest, examStatus } from '@/lib/temporary-exam-client'
import TemporaryExamQuestion from '@/components/TemporaryExamQuestion'

type Row = { id: string; title: string; startsAt: string; endsAt: string; status: string; _count: { attempts: number } }
const localTime = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
export default function TemporaryExamManager({ initialExams }: { initialExams: Row[] }) {
  const router = useRouter()
  const [paper, setPaper] = useState<TemporaryPaper | null>(null)
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState(() => localTime(new Date()))
  const [endsAt, setEndsAt] = useState(() => localTime(new Date(Date.now() + 7200000)))
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  function accept(input: unknown) {
    const valid = validateTemporaryPaper(input)
    setPaper(valid); setTitle(valid.title); setMessage('题库校验通过，请预览题目和参考答案后创建考试。')
  }
  async function loadBuiltin() {
    try { accept(await examRequest('/api/temporary-exams/template')) }
    catch (e) { setMessage((e as Error).message) }
  }
  async function create(event: React.FormEvent) {
    event.preventDefault()
    if (!paper || busy) return
    setBusy(true); setMessage('')
    try {
      const exam = await examRequest<{ id: string }>('/api/temporary-exams', { paper, title, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() })
      router.push(`/teacher/temporary-exams/${exam.id}`); router.refresh()
    } catch (e) { setMessage((e as Error).message); setBusy(false) }
  }
  const autoScore = paper?.questions.filter(q => q.grading === 'AUTO').reduce((s, q) => s + q.score, 0) || 0
  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-slate-900">
    <div><h1 className="text-2xl font-bold">临时考试</h1><p className="mt-2 text-sm text-slate-600">从题库文件创建考试，分享专属链接。考生无需平台账号，填写学号和姓名即可作答。</p></div>
    <form onSubmit={create} className="space-y-5 rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">选择题库并创建考试</h2>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={loadBuiltin} className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-800">使用本次 Python 入门试卷</button>
        <label className="cursor-pointer rounded-lg border px-4 py-2 text-sm">导入 JSON 题库文件
          <input aria-label="导入 JSON 题库文件" className="sr-only" type="file" accept=".json,application/json" onChange={async e => {
            const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
            setPaper(null); setPreview(false)
            try { if (file.size > 1024 * 1024) throw new Error('题库文件不能超过1MB'); accept(JSON.parse(await file.text())) }
            catch (error) { setMessage((error as Error).message) }
          }} />
        </label>
        <a href="/api/temporary-exams/template?download=1" className="text-sm text-blue-700 underline">下载本次结构化题库 / 格式示例</a>
      </div>
      {paper && <div className="rounded-lg bg-slate-50 p-4 text-sm">
        <p className="font-medium">{paper.title} · {paper.questions.length} 题 · {paper.totalScore} 分 · {paper.durationMinutes} 分钟</p>
        <p className="mt-2">自动判分 {autoScore} 分，人工评分 {paper.totalScore - autoScore} 分。每位考生从首次进入起计时，且不超过统一结束时间。</p>
        {paper.answerKeyNote && <p className="mt-2 text-amber-800">{paper.answerKeyNote}</p>}
        <button type="button" className="mt-3 text-blue-700 underline" onClick={() => setPreview(!preview)}>{preview ? '收起预览' : '预览全部题目、答案和评分建议'}</button>
      </div>}
      {preview && paper && <div className="max-h-[60vh] space-y-5 overflow-y-auto rounded-lg border p-4">
        <p className="whitespace-pre-wrap text-sm">{paper.instructions}</p>
        {paper.sections.map(s => <section key={s.id} className="space-y-4"><h3 className="font-bold">{s.title}</h3><p className="text-sm text-slate-600">{s.description}</p>
          {paper.questions.filter(q => q.sectionId === s.id).map(q => <article key={q.id} className="space-y-3 rounded-lg border p-4">
            <TemporaryExamQuestion question={q} />
            {q.options?.map(o => <p key={o.key} className="whitespace-pre-wrap text-sm">{o.key}. {o.text}</p>)}
            <p className="text-sm text-blue-800">{q.grading === 'AUTO' ? '自动判分' : '人工评分'}</p>
            <pre className="whitespace-pre-wrap rounded bg-emerald-50 p-3 text-sm">参考答案：{q.answers?.join(' 或 ') || q.referenceAnswer || '教师自行评定'}</pre>
            {q.rubric && <p className="text-sm">评分建议：{q.rubric}</p>}
          </article>)}
        </section>)}
      </div>}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm">考试名称<input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="text-sm">计划开始时间<input required type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="text-sm">统一结束时间<input required type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
      </div>
      <p className="text-sm text-slate-500">创建后进入管理页，点击“开启考试”才允许考生进入。提前开考会以点击时间作为开始时间。</p>
      {message && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
      <button disabled={!paper || busy} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm text-white disabled:opacity-40">{busy ? '创建中…' : '创建考试'}</button>
    </form>
    <section className="rounded-xl bg-white p-6 shadow-sm"><h2 className="mb-4 text-lg font-semibold">考试场次</h2>
      <div className="space-y-3">{initialExams.length === 0 && <p className="text-sm text-slate-500">尚未创建临时考试。</p>}
        {initialExams.map(exam => <Link href={`/teacher/temporary-exams/${exam.id}`} key={exam.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 hover:border-blue-400">
          <div><p className="font-medium">{exam.title}</p><p className="mt-1 text-sm text-slate-500">{examDate(exam.startsAt)} — {examDate(exam.endsAt)}</p></div>
          <span className="text-sm text-blue-800">{examStatus(exam.status, exam.endsAt)} · {exam._count.attempts} 人 · 管理 / 阅卷 →</span>
        </Link>)}
      </div>
    </section>
  </div>
}
