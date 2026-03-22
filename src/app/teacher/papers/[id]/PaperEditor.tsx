'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QUESTION_TYPES } from '@/lib/constants'
import { getQuestionOptionEntries } from '@/lib/quiz'

interface PaperQuestion {
  id: string
  orderIndex: number
  content: string
  type: string
  score: number
  optionA: string | null
  optionB: string | null
  optionC: string | null
  optionD: string | null
  answer: string
  scope: string | null
  questionBankId: string | null
}

interface PaperDetail {
  id: string
  title: string
  description: string | null
  questions: PaperQuestion[]
  _count: {
    questions: number
    sessions: number
  }
}

interface QuestionFormState {
  content: string
  type: string
  score: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  answer: string
  scope: string
}

interface Props {
  initialPaper: PaperDetail
}

function createQuestionForm(question: PaperQuestion): QuestionFormState {
  return {
    content: question.content,
    type: question.type,
    score: String(question.score),
    optionA: question.optionA || '',
    optionB: question.optionB || '',
    optionC: question.optionC || '',
    optionD: question.optionD || '',
    answer: question.answer,
    scope: question.scope || '',
  }
}

function shouldShowOptions(type: string) {
  return (
    type === QUESTION_TYPES.SINGLE ||
    type === QUESTION_TYPES.MULTIPLE ||
    type === QUESTION_TYPES.JUDGE
  )
}

export default function PaperEditor({ initialPaper }: Props) {
  const router = useRouter()
  const [paper, setPaper] = useState(initialPaper)
  const [title, setTitle] = useState(initialPaper.title)
  const [description, setDescription] = useState(initialPaper.description || '')
  const [savingPaper, setSavingPaper] = useState(false)
  const [deletingPaper, setDeletingPaper] = useState(false)
  const [editingQuestionId, setEditingQuestionId] = useState('')
  const [questionForm, setQuestionForm] = useState<QuestionFormState | null>(null)
  const [savingQuestionId, setSavingQuestionId] = useState('')
  const [deletingQuestionId, setDeletingQuestionId] = useState('')

  const questionEditingLocked = paper._count.sessions > 0

  const handleSavePaper = async () => {
    if (!title.trim()) {
      alert('请填写试卷名称')
      return
    }

    setSavingPaper(true)

    try {
      const res = await fetch('/api/papers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: paper.id,
          title,
          description,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '保存试卷失败')
        return
      }

      setPaper((current) => ({
        ...current,
        title: data.title,
        description: data.description,
      }))
      alert('试卷信息已保存')
      router.refresh()
    } finally {
      setSavingPaper(false)
    }
  }

  const handleDeletePaper = async () => {
    const message =
      paper._count.sessions > 0
        ? `确认删除试卷“${paper.title}”吗？这会同时删除相关练习记录。`
        : `确认删除试卷“${paper.title}”吗？`

    if (!window.confirm(message)) {
      return
    }

    setDeletingPaper(true)

    try {
      const res = await fetch(`/api/papers?id=${encodeURIComponent(paper.id)}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '删除试卷失败')
        return
      }

      router.push('/teacher/questions')
      router.refresh()
    } finally {
      setDeletingPaper(false)
    }
  }

  const handleStartEditQuestion = (question: PaperQuestion) => {
    setEditingQuestionId(question.id)
    setQuestionForm(createQuestionForm(question))
  }

  const handleCancelEditQuestion = () => {
    setEditingQuestionId('')
    setQuestionForm(null)
  }

  const handleSaveQuestion = async (questionId: string) => {
    if (!questionForm) {
      return
    }

    setSavingQuestionId(questionId)

    try {
      const res = await fetch(
        `/api/papers/${encodeURIComponent(paper.id)}/questions/${encodeURIComponent(questionId)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(questionForm),
        }
      )
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '保存题目失败')
        return
      }

      setPaper((current) => ({
        ...current,
        questions: current.questions.map((question) =>
          question.id === questionId ? data : question
        ),
      }))
      handleCancelEditQuestion()
      router.refresh()
    } finally {
      setSavingQuestionId('')
    }
  }

  const handleDeleteQuestion = async (question: PaperQuestion) => {
    if (!window.confirm(`确认删除第 ${question.orderIndex + 1} 题吗？`)) {
      return
    }

    setDeletingQuestionId(question.id)

    try {
      const res = await fetch(
        `/api/papers/${encodeURIComponent(paper.id)}/questions/${encodeURIComponent(question.id)}`,
        {
          method: 'DELETE',
        }
      )
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '删除题目失败')
        return
      }

      setPaper((current) => {
        const nextQuestions = current.questions
          .filter((item) => item.id !== question.id)
          .map((item, index) => ({
            ...item,
            orderIndex: index,
          }))

        return {
          ...current,
          questions: nextQuestions,
          _count: {
            ...current._count,
            questions: nextQuestions.length,
          },
        }
      })
      if (editingQuestionId === question.id) {
        handleCancelEditQuestion()
      }
      router.refresh()
    } finally {
      setDeletingQuestionId('')
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
                试卷编辑
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                共 {paper._count.questions} 题
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                练习 {paper._count.sessions} 次
              </span>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-slate-900">{paper.title}</h1>
            <p className="mt-2 text-sm text-slate-500">
              可以修改试卷名称、说明，并逐题编辑题干、分值、选项和答案。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/teacher/questions"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              返回试题管理
            </Link>
            <button
              type="button"
              onClick={() => void handleDeletePaper()}
              disabled={deletingPaper}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {deletingPaper ? '删除中...' : '删除试卷'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold">试卷信息</h2>
        <div className="grid gap-4 md:grid-cols-[2fr_3fr_auto] md:items-end">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">试卷名称</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">试卷说明</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="h-24 w-full rounded-lg border px-3 py-2"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleSavePaper()}
            disabled={savingPaper}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {savingPaper ? '保存中...' : '保存试卷'}
          </button>
        </div>
      </div>

      {questionEditingLocked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          该试卷已经用于练习。为避免影响历史答题记录，当前仅允许修改试卷名称和说明，不能改单题内容或删除题目。
        </div>
      )}

      <div className="space-y-4">
        {paper.questions.map((question, index) => {
          const isEditing = editingQuestionId === question.id && questionForm
          const optionEntries = getQuestionOptionEntries(question)

          return (
            <div key={question.id} className="rounded-xl bg-white p-6 shadow">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    第 {index + 1} 题
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">
                    {question.score} 分
                  </span>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
                    {question.type}
                  </span>
                  {question.scope && (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                      {question.scope}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!questionEditingLocked && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStartEditQuestion(question)}
                        className="rounded-lg border border-blue-200 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
                      >
                        编辑题目
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteQuestion(question)}
                        disabled={deletingQuestionId === question.id}
                        className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        {deletingQuestionId === question.id ? '删除中...' : '删除题目'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      题目内容
                    </label>
                    <textarea
                      value={questionForm.content}
                      onChange={(event) =>
                        setQuestionForm((current) =>
                          current
                            ? {
                                ...current,
                                content: event.target.value,
                              }
                            : current
                        )
                      }
                      className="h-28 w-full rounded-lg border px-3 py-2"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        题型
                      </label>
                      <select
                        value={questionForm.type}
                        onChange={(event) =>
                          setQuestionForm((current) =>
                            current
                              ? {
                                  ...current,
                                  type: event.target.value,
                                }
                              : current
                          )
                        }
                        className="w-full rounded-lg border px-3 py-2"
                      >
                        {Object.values(QUESTION_TYPES).map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        分值
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={questionForm.score}
                        onChange={(event) =>
                          setQuestionForm((current) =>
                            current
                              ? {
                                  ...current,
                                  score: event.target.value,
                                }
                              : current
                          )
                        }
                        className="w-full rounded-lg border px-3 py-2"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        范围
                      </label>
                      <input
                        type="text"
                        value={questionForm.scope}
                        onChange={(event) =>
                          setQuestionForm((current) =>
                            current
                              ? {
                                  ...current,
                                  scope: event.target.value,
                                }
                              : current
                          )
                        }
                        className="w-full rounded-lg border px-3 py-2"
                        placeholder="可选"
                      />
                    </div>
                  </div>

                  {shouldShowOptions(questionForm.type) && (
                    <div className="grid gap-4 md:grid-cols-2">
                      {(['optionA', 'optionB', 'optionC', 'optionD'] as const).map((field, index) => (
                        <div key={field}>
                          <label className="mb-1 block text-sm font-medium text-slate-700">
                            选项 {String.fromCharCode(65 + index)}
                          </label>
                          <input
                            type="text"
                            value={questionForm[field]}
                            onChange={(event) =>
                              setQuestionForm((current) =>
                                current
                                  ? {
                                      ...current,
                                      [field]: event.target.value,
                                    }
                                  : current
                              )
                            }
                            className="w-full rounded-lg border px-3 py-2"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      答案
                    </label>
                    <input
                      type="text"
                      value={questionForm.answer}
                      onChange={(event) =>
                        setQuestionForm((current) =>
                          current
                            ? {
                                ...current,
                                answer: event.target.value,
                              }
                            : current
                        )
                      }
                      className="w-full rounded-lg border px-3 py-2"
                      placeholder="多选题用逗号分隔，如 A,C"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSaveQuestion(question.id)}
                      disabled={savingQuestionId === question.id}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingQuestionId === question.id ? '保存中...' : '保存题目'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEditQuestion}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="whitespace-pre-wrap text-lg text-slate-800">
                    {question.content}
                  </div>
                  {optionEntries.length > 0 && (
                    <div className="grid gap-3 md:grid-cols-2">
                      {optionEntries.map((option) => (
                        <div
                          key={option.key}
                          className="rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700"
                        >
                          {option.key}. {option.value}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    正确答案：{question.answer}
                  </div>
                  <div className="text-xs text-slate-500">
                    {question.questionBankId ? '来自题库，当前编辑仅影响此试卷。' : '仅存在于当前试卷。'}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
