'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getModeLabel, getStatusLabel } from '@/lib/quiz'
import {
  PRACTICE_MODES,
  QUESTION_TYPES,
  UNASSIGNED_CLASS_FILTER,
} from '@/lib/constants'

interface Question {
  id: string
  content: string
  type: string
  score: number
  scope: string | null
  createdAt: string
}

interface Paper {
  id: string
  title: string
  description: string | null
  createdAt: string
  _count: {
    questions: number
    sessions: number
  }
}

interface PracticeSession {
  id: string
  mode: string
  status: string
  className: string
  durationMinutes: number | null
  createdAt: string
  startedAt: string | null
  paper: {
    title: string
  }
  _count: {
    students: number
    responses: number
  }
}

interface Props {
  questions: Question[]
  papers: Paper[]
  sessions: PracticeSession[]
  classOptions: string[]
}

export default function QuizManager({
  questions,
  papers,
  sessions,
  classOptions,
}: Props) {
  const router = useRouter()
  const [questionImporting, setQuestionImporting] = useState(false)
  const [questionDeletingId, setQuestionDeletingId] = useState('')
  const [paperCreating, setPaperCreating] = useState(false)
  const [paperDeletingId, setPaperDeletingId] = useState('')
  const [paperImporting, setPaperImporting] = useState(false)
  const [sessionCreating, setSessionCreating] = useState(false)
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])
  const [paperTitle, setPaperTitle] = useState('')
  const [paperDescription, setPaperDescription] = useState('')
  const [importPaperTitle, setImportPaperTitle] = useState('')
  const [importPaperDescription, setImportPaperDescription] = useState('')
  const [importToBank, setImportToBank] = useState(true)
  const [selectedPaperId, setSelectedPaperId] = useState(papers[0]?.id || '')
  const [selectedClassName, setSelectedClassName] = useState(classOptions[0] || '')
  const [practiceMode, setPracticeMode] = useState<string>(PRACTICE_MODES.QUESTION)
  const [durationMinutes, setDurationMinutes] = useState('20')
  const [scopeFilter, setScopeFilter] = useState('')

  useEffect(() => {
    if (selectedPaperId && papers.some((paper) => paper.id === selectedPaperId)) {
      return
    }

    setSelectedPaperId(papers[0]?.id || '')
  }, [papers, selectedPaperId])

  useEffect(() => {
    if (selectedClassName && classOptions.includes(selectedClassName)) {
      return
    }

    setSelectedClassName(classOptions[0] || '')
  }, [classOptions, selectedClassName])

  const scopeOptions = useMemo(
    () =>
      Array.from(
        new Set(questions.map((question) => question.scope || '').filter(Boolean))
      ).sort((left, right) => left.localeCompare(right)),
    [questions]
  )

  const filteredQuestions = questions.filter((question) =>
    scopeFilter ? (question.scope || '') === scopeFilter : true
  )

  const handleQuestionImport = async (file: File) => {
    setQuestionImporting(true)

    try {
      const body = new FormData()
      body.append('file', file)

      const res = await fetch('/api/questions/import', {
        method: 'POST',
        body,
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '导入题库失败')
        return
      }

      alert(`成功导入 ${data.createdCount} 道题目`)
      router.refresh()
    } finally {
      setQuestionImporting(false)
    }
  }

  const handleDeleteQuestion = async (question: Question) => {
    if (!window.confirm(`确认删除题目“${question.content.slice(0, 20)}”吗？`)) {
      return
    }

    setQuestionDeletingId(question.id)

    try {
      const res = await fetch(`/api/questions/${encodeURIComponent(question.id)}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '删除题目失败')
        return
      }

      setSelectedQuestionIds((current) => current.filter((id) => id !== question.id))
      router.refresh()
    } finally {
      setQuestionDeletingId('')
    }
  }

  const handleCreatePaper = async () => {
    if (!paperTitle.trim()) {
      alert('请填写试卷名称')
      return
    }

    if (selectedQuestionIds.length === 0) {
      alert('请选择至少一道题目')
      return
    }

    setPaperCreating(true)

    try {
      const res = await fetch('/api/papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: paperTitle,
          description: paperDescription,
          questionBankIds: selectedQuestionIds,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '组卷失败')
        return
      }

      setPaperTitle('')
      setPaperDescription('')
      setSelectedQuestionIds([])
      setSelectedPaperId(data.id || '')
      alert('试卷已创建')
      router.refresh()
    } finally {
      setPaperCreating(false)
    }
  }

  const handleImportPaper = async (file: File) => {
    if (!importPaperTitle.trim()) {
      alert('请先填写导入试卷名称')
      return
    }

    setPaperImporting(true)

    try {
      const body = new FormData()
      body.append('file', file)
      body.append('title', importPaperTitle)
      body.append('description', importPaperDescription)
      body.append('importToBank', String(importToBank))

      const res = await fetch('/api/papers/import', {
        method: 'POST',
        body,
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '导入试卷失败')
        return
      }

      alert('试卷导入成功')
      setImportPaperTitle('')
      setImportPaperDescription('')
      router.refresh()
    } finally {
      setPaperImporting(false)
    }
  }

  const handleToggleQuestion = (questionId: string) => {
    setSelectedQuestionIds((current) =>
      current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : [...current, questionId]
    )
  }

  const handleCreateSession = async () => {
    if (!selectedPaperId || !selectedClassName) {
      alert('请选择试卷和班级')
      return
    }

    setSessionCreating(true)

    try {
      const res = await fetch('/api/practice-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperId: selectedPaperId,
          className: selectedClassName,
          mode: practiceMode,
          durationMinutes:
            practiceMode === PRACTICE_MODES.PAPER
              ? Number.parseInt(durationMinutes, 10)
              : null,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '启动练习失败')
        return
      }

      router.push(`/teacher/practice/${data.id}`)
      router.refresh()
    } finally {
      setSessionCreating(false)
    }
  }

  const handleDeletePaper = async (paper: Paper) => {
    const message =
      paper._count.sessions > 0
        ? `确认删除试卷“${paper.title}”吗？这会同时删除相关练习记录。`
        : `确认删除试卷“${paper.title}”吗？`

    if (!window.confirm(message)) {
      return
    }

    setPaperDeletingId(paper.id)

    try {
      const res = await fetch(`/api/papers?id=${encodeURIComponent(paper.id)}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '删除试卷失败')
        return
      }

      if (selectedPaperId === paper.id) {
        setSelectedPaperId('')
      }
      router.refresh()
    } finally {
      setPaperDeletingId('')
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">题库管理</h2>
            <label className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              {questionImporting ? '导入中...' : 'Excel 导入题库'}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={questionImporting}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    void handleQuestionImport(file)
                  }
                  event.target.value = ''
                }}
              />
            </label>
          </div>
          <p className="mb-4 text-sm text-gray-500">
            Excel 列：问题、类型、分值、选项A、选项B、选项C、选项D、答案、范围
          </p>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">全部范围</option>
              {scopeOptions.map((scope) => (
                <option key={scope} value={scope}>
                  {scope}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-500">
              共 {filteredQuestions.length} / {questions.length} 道题
            </span>
          </div>
          <div className="max-h-[520px] space-y-3 overflow-y-auto">
            {filteredQuestions.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-gray-500">
                暂无题目
              </div>
            ) : (
              filteredQuestions.map((question) => (
                <div
                  key={question.id}
                  className="rounded-xl border border-slate-200 px-4 py-4"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedQuestionIds.includes(question.id)}
                      onChange={() => handleToggleQuestion(question.id)}
                      className="mt-1 h-4 w-4"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          {question.type}
                        </span>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                          {question.score} 分
                        </span>
                        {question.scope && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                            {question.scope}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                        {question.content}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteQuestion(question)}
                      disabled={questionDeletingId === question.id}
                      className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {questionDeletingId === question.id ? '删除中...' : '删除'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">选择题目组卷</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">试卷名称</label>
                <input
                  type="text"
                  value={paperTitle}
                  onChange={(event) => setPaperTitle(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="例如：第一章课堂练习"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">试卷说明</label>
                <textarea
                  value={paperDescription}
                  onChange={(event) => setPaperDescription(event.target.value)}
                  className="h-24 w-full rounded-lg border px-3 py-2"
                  placeholder="可选"
                />
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>已选题目 {selectedQuestionIds.length} 道</span>
                <button
                  type="button"
                  onClick={() => setSelectedQuestionIds(filteredQuestions.map((item) => item.id))}
                  className="text-blue-600 hover:underline"
                >
                  当前筛选全选
                </button>
              </div>
              <button
                type="button"
                onClick={handleCreatePaper}
                disabled={paperCreating}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {paperCreating ? '组卷中...' : '创建试卷'}
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">导入 Excel 组卷</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">试卷名称</label>
                <input
                  type="text"
                  value={importPaperTitle}
                  onChange={(event) => setImportPaperTitle(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">试卷说明</label>
                <textarea
                  value={importPaperDescription}
                  onChange={(event) => setImportPaperDescription(event.target.value)}
                  className="h-24 w-full rounded-lg border px-3 py-2"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={importToBank}
                  onChange={(event) => setImportToBank(event.target.checked)}
                />
                同时导入题库
              </label>
              <label className="inline-flex cursor-pointer rounded-lg bg-slate-700 px-4 py-2 text-white hover:bg-slate-800">
                {paperImporting ? '导入中...' : '上传试卷 Excel'}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  disabled={paperImporting}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      void handleImportPaper(file)
                    }
                    event.target.value = ''
                  }}
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">启动练习</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">选择试卷</label>
                <select
                  value={selectedPaperId}
                  onChange={(event) => setSelectedPaperId(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="">请选择试卷</option>
                  {papers.map((paper) => (
                    <option key={paper.id} value={paper.id}>
                      {paper.title}（{paper._count.questions} 题）
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">班级</label>
                <select
                  value={selectedClassName}
                  onChange={(event) => setSelectedClassName(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="">请选择班级</option>
                  {classOptions.map((className) => (
                    <option key={className} value={className}>
                      {className === UNASSIGNED_CLASS_FILTER ? '未分班' : className}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">练习模式</label>
                <select
                  value={practiceMode}
                  onChange={(event) => setPracticeMode(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value={PRACTICE_MODES.QUESTION}>逐题练习</option>
                  <option value={PRACTICE_MODES.PAPER}>整卷练习</option>
                </select>
              </div>
              {practiceMode === PRACTICE_MODES.PAPER && (
                <div>
                  <label className="mb-1 block text-sm font-medium">答题时间（分钟）</label>
                  <input
                    type="number"
                    min="1"
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(event.target.value)}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={handleCreateSession}
                disabled={sessionCreating}
                className="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {sessionCreating ? '创建中...' : '创建并进入练习控制台'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">试卷列表</h2>
            <span className="text-sm text-gray-500">{papers.length} 份</span>
          </div>
          <div className="space-y-3">
            {papers.length === 0 ? (
              <div className="text-sm text-gray-500">暂无试卷</div>
            ) : (
              papers.map((paper) => (
                <div key={paper.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-medium text-slate-900">{paper.title}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        题目 {paper._count.questions} 道 / 练习 {paper._count.sessions} 次
                      </div>
                      {paper.description && (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                          {paper.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      <Link
                        href={`/teacher/papers/${paper.id}`}
                        className="rounded-lg border border-blue-200 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
                      >
                        查看 / 编辑
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleDeletePaper(paper)}
                        disabled={paperDeletingId === paper.id}
                        className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {paperDeletingId === paper.id ? '删除中...' : '删除'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">最近练习</h2>
            <span className="text-sm text-gray-500">{sessions.length} 条</span>
          </div>
          <div className="space-y-3">
            {sessions.length === 0 ? (
              <div className="text-sm text-gray-500">暂无练习记录</div>
            ) : (
              sessions.map((practiceSession) => (
                <div
                  key={practiceSession.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-medium text-slate-900">
                          {practiceSession.paper.title}
                        </span>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                          {getModeLabel(practiceSession.mode)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          {getStatusLabel(practiceSession.status)}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-500">
                        班级：
                        {practiceSession.className === UNASSIGNED_CLASS_FILTER
                          ? '未分班'
                          : practiceSession.className}
                        {practiceSession.durationMinutes
                          ? ` / 时长：${practiceSession.durationMinutes} 分钟`
                          : ''}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        学生会话 {practiceSession._count.students} / 提交记录{' '}
                        {practiceSession._count.responses}
                      </div>
                    </div>
                    <Link
                      href={`/teacher/practice/${practiceSession.id}`}
                      className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-800"
                    >
                      进入控制台
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold">题型说明</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {Object.values(QUESTION_TYPES).map((type) => (
            <span key={type} className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              {type}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
