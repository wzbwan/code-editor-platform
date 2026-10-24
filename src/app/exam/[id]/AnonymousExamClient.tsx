'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExamAnswers, PublicTemporaryPaper } from '@/lib/temporary-exam-paper'
import { examDate, examRequest, examStatus } from '@/lib/temporary-exam-client'
import TemporaryExamQuestion from '@/components/TemporaryExamQuestion'
import CodeEditor from '@/components/CodeEditor'

type Meta = { title: string; status: string; startsAt: string; endsAt: string; durationMinutes: number; totalScore: number; instructions: string }
type Attempt = { id: string; studentNumber: string; studentName: string; token?: string; revision: number; deadline: string; submittedAt: string | null; paper: PublicTemporaryPaper; answers: ExamAnswers; serverNow: string }
type SaveResult = { revision: number; submittedAt?: string | null; expired?: boolean; serverNow: string }
type Draft = { answers: ExamAnswers; baseRevision: number; dirty: boolean }
const draftKey = (exam: string, attempt: string) => `temporary-exam:${exam}:${attempt}`
const errorText = (e: unknown) => e instanceof Error ? e.message : '操作失败'

export default function AnonymousExamClient({ examId }: { examId: string }) {
  const url = `/api/public-exams/${examId}`
  const [meta, setMeta] = useState<Meta | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [answers, setAnswers] = useState<ExamAnswers>({})
  const [studentNumber, setStudentNumber] = useState('')
  const [studentName, setStudentName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [saveStatus, setSaveStatus] = useState('已保存')
  const [now, setNow] = useState(Date.now())
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const live = useRef<Attempt | null>(null)
  const answersRef = useRef<ExamAnswers>({})
  const active = useRef(false)
  const pending = useRef<Promise<void>>(Promise.resolve())
  const clockOffset = useRef(0)
  const dirty = useRef(false)

  const cache = useCallback((a: Attempt) => {
    try { sessionStorage.setItem(draftKey(examId, a.id), JSON.stringify({ answers: answersRef.current, baseRevision: a.revision, dirty: dirty.current })) }
    catch { /* Server autosave continues when browser storage is unavailable. */ }
  }, [examId])
  const hidePaper = useCallback((reason: string) => {
    active.current = false; setAttempt(null); setConfirmSubmit(false)
    setStudentNumber(''); setStudentName(''); setMessage(reason)
  }, [])

  const enqueue = useCallback((action: 'SAVE' | 'LOCK' | 'SUBMIT', a: Attempt, reason?: string) => {
    const snapshot = { ...answersRef.current }
    const task = pending.current.then(async () => {
      if (!a.token || a.submittedAt) return
      if (action === 'SAVE') setSaveStatus('保存中…')
      const result = await examRequest<SaveResult>(url, { action, attemptId: a.id, token: a.token, revision: a.revision, answers: snapshot, reason }, action === 'LOCK')
      a.revision = result.revision
      clockOffset.current = new Date(result.serverNow).getTime() - Date.now()
      if (JSON.stringify(snapshot) === JSON.stringify(answersRef.current)) dirty.current = false
      cache(a)
      if (result.submittedAt) {
        a.submittedAt = result.submittedAt; a.token = undefined; active.current = false
        if (live.current === a) {
          setAttempt({ ...a }); setConfirmSubmit(false)
          setMessage(result.expired ? '考试已截止，系统已按最后保存的答案交卷。' : '交卷成功，程序题和代码改错题等待教师批阅。')
          try { sessionStorage.removeItem(draftKey(examId, a.id)) } catch {}
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
        }
      } else if (action === 'SAVE' && active.current && live.current === a) setSaveStatus('已保存到服务器')
    })
    pending.current = task.catch(e => {
      if (live.current !== a || a.submittedAt) return
      if (action !== 'LOCK') hidePaper(`保存未完成：${errorText(e)}。本机草稿已保留，请核对网络并重新填写身份续答。`)
    })
    return task
  }, [url, cache, hidePaper, examId])

  const lock = useCallback((reason: string) => {
    const a = live.current
    if (!active.current || !a || a.submittedAt) return
    cache(a)
    hidePaper('检测到切换应用、切换标签或退出全屏，答卷已锁定。请重新输入原学号和姓名续答，考试计时继续。')
    void enqueue('LOCK', a, reason).catch(() => {})
  }, [cache, hidePaper, enqueue])

  useEffect(() => {
    const refresh = () => { void examRequest<Meta>(url).then(setMeta).catch(e => setMessage(errorText(e))) }
    refresh()
    const timer = window.setInterval(refresh, 15000)
    return () => window.clearInterval(timer)
  }, [url])
  useEffect(() => {
    const visibility = () => { if (document.hidden) lock('HIDDEN') }
    const blur = () => lock('BLUR')
    const full = () => { if (!document.fullscreenElement) lock('FULLSCREEN_EXIT') }
    const offline = () => lock('OFFLINE')
    const exit = () => lock('PAGE_EXIT')
    const unload = (e: BeforeUnloadEvent) => { if (active.current) { e.preventDefault(); e.returnValue = '' } }
    document.addEventListener('visibilitychange', visibility)
    document.addEventListener('fullscreenchange', full)
    window.addEventListener('blur', blur)
    window.addEventListener('offline', offline)
    window.addEventListener('pagehide', exit)
    window.addEventListener('beforeunload', unload)
    return () => {
      document.removeEventListener('visibilitychange', visibility); document.removeEventListener('fullscreenchange', full)
      window.removeEventListener('blur', blur); window.removeEventListener('offline', offline)
      window.removeEventListener('pagehide', exit); window.removeEventListener('beforeunload', unload)
    }
  }, [lock])
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now() + clockOffset.current)
      const a = live.current
      if (active.current && a && new Date(a.deadline).getTime() <= Date.now() + clockOffset.current) {
        active.current = false; setBusy(true)
        void enqueue('SUBMIT', a).catch(() => {}).finally(() => setBusy(false))
      }
    }, 500)
    const autosave = window.setInterval(() => {
      const a = live.current
      if (a && active.current) void enqueue('SAVE', a).catch(() => {})
    }, 5000)
    return () => { window.clearInterval(timer); window.clearInterval(autosave) }
  }, [enqueue])
  useEffect(() => {
    if (!attempt || !active.current || !dirty.current) return
    const timer = window.setTimeout(() => { if (active.current) void enqueue('SAVE', live.current!).catch(() => {}) }, 700)
    return () => window.clearTimeout(timer)
  }, [answers, attempt, enqueue])

  async function join(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setMessage('')
    try {
      // Browsers require a direct user gesture for fullscreen. No attempt is
      // created until fullscreen succeeds.
      if (!document.fullscreenEnabled) throw new Error('当前浏览器不支持全屏考试，请使用电脑端 Chrome 或 Edge')
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
      await pending.current
      const a = await examRequest<Attempt>(url, { action: 'JOIN', studentNumber, studentName })
      clockOffset.current = new Date(a.serverNow).getTime() - Date.now()
      let initial = a.answers
      dirty.current = false
      try {
        const saved: Draft = JSON.parse(sessionStorage.getItem(draftKey(examId, a.id)) || 'null')
        // Only recover an unsent draft if no intervening server write or other
        // device resume occurred. Never overwrite another tab's newer answers.
        if (saved?.dirty && saved.baseRevision === a.revision - 1 && !a.submittedAt) {
          initial = saved.answers; dirty.current = true
          setMessage('已恢复本机尚未上传的草稿，正在重新保存。')
        }
      } catch {}
      live.current = a; answersRef.current = initial; active.current = !a.submittedAt
      setAttempt(a); setAnswers(initial); setConfirmSubmit(false)
      if (a.submittedAt) {
        setMessage('本场考试已交卷，无需重复提交。')
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
      } else if (document.hidden || !document.hasFocus() || !document.fullscreenElement) lock('BLUR')
      else { cache(a); setSaveStatus('已恢复服务器答卷') }
    } catch (e) { setMessage(errorText(e) || '无法进入全屏，请允许浏览器进入全屏后重试') }
    finally { setBusy(false) }
  }
  function change(id: string, value: string) {
    if (!active.current || busy || value.length > 20000) return
    const next = { ...answersRef.current, [id]: value }
    answersRef.current = next; dirty.current = true; setAnswers(next); setSaveStatus('有修改，等待保存…')
    if (live.current) cache(live.current)
  }
  async function submit() {
    const a = live.current
    if (!a || busy) return
    setBusy(true)
    try { await enqueue('SUBMIT', a) } catch {} finally { setBusy(false) }
  }
  const complete = Boolean(attempt?.submittedAt)
  const remaining = attempt ? Math.max(0, Math.ceil((new Date(attempt.deadline).getTime() - now) / 1000)) : 0
  const answered = attempt?.paper.questions.filter(q => answers[q.id]?.trim()).length || 0
  const open = meta && meta.status === 'ACTIVE' && new Date(meta.startsAt).getTime() <= Date.now() && new Date(meta.endsAt).getTime() > Date.now()

  if (!attempt) return <div className="mx-auto max-w-2xl px-4 py-12 text-slate-900">
    <form onSubmit={join} className="space-y-5 rounded-2xl bg-white p-8 shadow-sm">
      <p className="text-sm font-medium text-blue-700">临时考试 · 无需登录</p>
      <h1 className="text-2xl font-bold">{meta?.title || '正在加载考试…'}</h1>
      {meta && <><p className="text-sm text-slate-600">{meta.durationMinutes} 分钟 · 满分 {meta.totalScore} 分 · {examStatus(meta.status, meta.endsAt)}</p>
        <p className="text-sm text-slate-600">考试时间：{examDate(meta.startsAt)} 至 {examDate(meta.endsAt)}</p>
        <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-7">{meta.instructions}</p></>}
      <div className="rounded-lg bg-amber-50 p-4 text-sm leading-7 text-amber-900">点击下方按钮将进入全屏。切换应用、标签页或退出全屏会锁定答卷，需要重新输入原学号和姓名。答案自动保存，续答不延长时间。同一学号只能提交一份答卷，请认真核对身份。</div>
      <label className="block text-sm font-medium">学号<input autoComplete="off" required pattern={'[A-Za-z0-9_\\-]{1,40}'} maxLength={40} value={studentNumber} onChange={e => setStudentNumber(e.target.value)} className="mt-2 w-full rounded-lg border p-3" /></label>
      <label className="block text-sm font-medium">姓名<input autoComplete="off" required maxLength={60} value={studentName} onChange={e => setStudentName(e.target.value)} className="mt-2 w-full rounded-lg border p-3" /></label>
      {message && <p role="alert" className="text-sm leading-6 text-amber-900">{message}</p>}
      <button disabled={busy || !meta || (!open && meta.status === 'DRAFT')} className="w-full rounded-lg bg-blue-700 p-3 font-medium text-white disabled:opacity-40">{busy ? '正在进入…' : open ? '进入全屏并开始 / 续答' : '核对交卷状态'}</button>
    </form>
  </div>
  if (complete) return <div className="mx-auto max-w-xl px-4 py-20"><div className="space-y-4 rounded-2xl bg-white p-8 shadow-sm">
    <h1 className="text-2xl font-bold">答卷已提交</h1><p>{attempt.studentNumber} · {attempt.studentName}</p><p role="status" className="text-sm leading-7 text-slate-600">{message}</p>
    <p className="text-sm text-slate-500">提交时间：{examDate(attempt.submittedAt!)}</p>
  </div></div>
  return <div className="mx-auto max-w-6xl px-4 pb-12 text-slate-900" onCopy={e => e.preventDefault()} onCut={e => e.preventDefault()} onPaste={e => e.preventDefault()} onContextMenu={e => e.preventDefault()}>
    <header className="sticky top-0 z-20 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-3 border-b bg-white px-6 py-4 shadow-sm">
      <div><h1 className="font-bold">{meta?.title}</h1><p className="mt-1 text-sm text-slate-600">{attempt.studentNumber} · {attempt.studentName} · 已作答 {answered}/{attempt.paper.questions.length}</p></div>
      <div className="flex items-center gap-5"><span className="text-sm text-slate-500" role="status">{saveStatus}</span><strong className={remaining < 300 ? 'text-red-700' : 'text-blue-800'}>剩余 {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</strong>
        <button disabled={busy || remaining === 0} onClick={() => setConfirmSubmit(true)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-40">{busy ? '交卷中…' : '交卷'}</button></div>
    </header>
    {message && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm">{message}</p>}
    <div className="mb-6 flex flex-wrap gap-2">{attempt.paper.questions.map(q => <a key={q.id} href={`#question-${q.id}`} className={`rounded border px-3 py-1 text-sm ${answers[q.id]?.trim() ? 'border-blue-600 bg-blue-50 text-blue-900' : 'bg-white'}`}>{q.number}</a>)}</div>
    <div className="space-y-8">{attempt.paper.sections.map(section => <section key={section.id} className="space-y-4">
      <h2 className="text-xl font-bold">{section.title}</h2><p className="text-sm text-slate-600">{section.description}</p>
      {attempt.paper.questions.filter(q => q.sectionId === section.id).map(q => <article id={`question-${q.id}`} key={q.id} className="scroll-mt-32 space-y-4 rounded-xl bg-white p-6 shadow-sm">
        <div className="select-none"><TemporaryExamQuestion question={q} /></div>
        {q.options ? <fieldset disabled={busy} aria-label={`第${q.number}题答案`} className="space-y-2">{q.options.map(option => {
          const selected = (answers[q.id] || '').split(',')
          return <label key={option.key} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-blue-50">
            <input type={q.type === 'MULTIPLE' ? 'checkbox' : 'radio'} name={q.id} value={option.key} checked={q.type === 'MULTIPLE' ? selected.includes(option.key) : answers[q.id] === option.key} className="mt-1" onChange={e => change(q.id, q.type === 'MULTIPLE' ? (e.target.checked ? selected.filter(Boolean).concat(option.key) : selected.filter(v => v !== option.key)).sort().join(',') : option.key)} />
            <span className="whitespace-pre-wrap text-sm">{option.key}. {option.text}</span>
          </label>
        })}</fieldset> : q.type === 'CODE' ? <div>
          <p className="mb-2 text-xs text-slate-500">填写代码 / 错误说明（Tab 键输入四个空格）；教师人工评分。</p>
          <CodeEditor code={answers[q.id] || ''} onChange={v => change(q.id, v)} readOnly={busy} minHeightClassName="min-h-[260px]" />
        </div> : <label className="block text-sm text-slate-600">{q.type === 'OUTPUT' ? '完整输出（保留换行）' : '你的答案'}
          <textarea aria-label={`第${q.number}题答案`} maxLength={20000} rows={q.type === 'FILL' ? 2 : 4} disabled={busy} value={answers[q.id] || ''} onChange={e => change(q.id, e.target.value)} spellCheck={false} className="mt-2 w-full rounded-lg border p-3 font-mono text-base text-slate-900" />
        </label>}
      </article>)}
    </section>)}</div>
    {confirmSubmit && <div role="dialog" aria-modal="true" aria-labelledby="submit-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"><div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6">
      <h2 id="submit-title" className="text-xl font-bold">确认交卷</h2><p className="text-sm leading-7">已作答 {answered} / {attempt.paper.questions.length} 题，未作答 {attempt.paper.questions.length - answered} 题。交卷后不能修改。</p>
      <div className="flex justify-end gap-3"><button disabled={busy} onClick={() => setConfirmSubmit(false)} className="rounded-lg border px-4 py-2">继续检查</button><button disabled={busy} onClick={() => void submit()} className="rounded-lg bg-blue-700 px-4 py-2 text-white">{busy ? '提交中…' : '确认交卷'}</button></div>
    </div></div>}
  </div>
}
