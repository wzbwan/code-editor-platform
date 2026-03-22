'use client'

import { useEffect, useMemo, useState } from 'react'

interface QuestionItem {
  id: string
  content: string
  type: string
  score: number
  answer: string
  options?: Array<{ key: string; value: string }>
  submittedAnswer?: string
}

interface PracticePayload {
  active: boolean
  data: any
}

function normalizePaperAnswer(
  question: QuestionItem,
  value: string | string[] | undefined
) {
  if (Array.isArray(value)) {
    return value.join(',')
  }

  if (question.type === '多选题') {
    return String(value || '')
      .split(',')
      .filter(Boolean)
      .sort()
      .join(',')
  }

  return String(value || '')
}

export default function StudentPracticeClient() {
  const [payload, setPayload] = useState<PracticePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [questionAnswer, setQuestionAnswer] = useState('')
  const [paperAnswers, setPaperAnswers] = useState<Record<string, string | string[]>>({})

  const load = async () => {
    const res = await fetch('/api/student-practice/active')
    const data = await res.json()
    setPayload(data)
    setLoading(false)
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      void load()
    }, 3000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (payload?.data?.mode === 'QUESTION' && payload.data.question) {
      setQuestionAnswer(payload.data.question.submittedAnswer || '')
    }

    if (payload?.data?.mode === 'PAPER' && payload.data.questions) {
      const initialAnswers: Record<string, string> = {}
      for (const question of payload.data.questions) {
        initialAnswers[question.id] = question.submittedAnswer || ''
      }
      setPaperAnswers(initialAnswers)
    }
  }, [payload?.data?.mode, payload?.data?.question?.id, payload?.data?.session?.id])

  const deadlineText = useMemo(() => {
    const deadlineAt = payload?.data?.deadlineAt
    if (!deadlineAt) {
      return ''
    }

    const remainingMs = new Date(deadlineAt).getTime() - Date.now()
    if (remainingMs <= 0) {
      return '已到截止时间'
    }

    const minutes = Math.floor(remainingMs / 60000)
    const seconds = Math.floor((remainingMs % 60000) / 1000)
    return `剩余 ${minutes} 分 ${seconds} 秒`
  }, [payload])

  const renderAnswerInput = (
    question: QuestionItem,
    value: string | string[] | undefined,
    onChange: (next: string | string[]) => void,
    disabled?: boolean
  ) => {
    if (question.type === '单选题' || question.type === '判断题') {
      return (
        <div className="space-y-3">
          {question.options?.map((option) => (
            <label key={option.key} className="flex items-center gap-3 rounded-lg border px-4 py-3">
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option.key}
                checked={value === option.key}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
              />
              <span>{option.key}. {option.value}</span>
            </label>
          ))}
        </div>
      )
    }

    if (question.type === '多选题') {
      const checkedValues = Array.isArray(value)
        ? value
        : String(value || '')
            .split(',')
            .filter(Boolean)

      return (
        <div className="space-y-3">
          {question.options?.map((option) => (
            <label key={option.key} className="flex items-center gap-3 rounded-lg border px-4 py-3">
              <input
                type="checkbox"
                value={option.key}
                checked={checkedValues.includes(option.key)}
                disabled={disabled}
                onChange={(event) => {
                  const next = new Set(checkedValues)
                  if (event.target.checked) {
                    next.add(option.key)
                  } else {
                    next.delete(option.key)
                  }
                  onChange(Array.from(next).sort())
                }}
              />
              <span>{option.key}. {option.value}</span>
            </label>
          ))}
        </div>
      )
    }

    if (question.type === '简答题') {
      return (
        <textarea
          value={String(value || '')}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-32 w-full rounded-lg border px-3 py-2"
          placeholder="请输入答案"
        />
      )
    }

    return (
      <input
        type="text"
        value={String(value || '')}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border px-3 py-2"
        placeholder="请输入答案"
      />
    )
  }

  const submitQuestion = async () => {
    const practice = payload?.data
    if (!practice?.question) {
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/student-practice/question-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: practice.session.id,
          answer: questionAnswer,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '提交失败')
        return
      }

      await load()
    } finally {
      setSubmitting(false)
    }
  }

  const submitPaper = async () => {
    const practice = payload?.data
    if (!practice?.questions) {
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/student-practice/paper-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: practice.session.id,
          answers: practice.questions.map((question: QuestionItem) => ({
            paperQuestionId: question.id,
            answer: normalizePaperAnswer(question, paperAnswers[question.id]),
          })),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '交卷失败')
        return
      }

      await load()
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-center text-gray-500 py-12">加载练习中...</div>
  }

  if (!payload?.active || !payload.data) {
    return <div className="text-center text-gray-500 py-12">当前没有进行中的练习</div>
  }

  const practice = payload.data

  if (practice.mode === 'QUESTION') {
    return (
      <div className="space-y-6">
        <div className="rounded-xl bg-white p-6 shadow">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
              逐题练习
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
              第 {practice.currentQuestionIndex + 1} / {practice.totalQuestions} 题
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">{practice.session.paper.title}</h1>
        </div>

        {!practice.question ? (
          <div className="rounded-xl bg-white px-6 py-12 text-center text-gray-500 shadow">
            老师暂未开始本题或本题已结束，请等待下一题
          </div>
        ) : (
          <div className="rounded-xl bg-white p-6 shadow">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">
                {practice.question.score} 分
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                {practice.question.type}
              </span>
            </div>
            <div className="whitespace-pre-wrap text-lg text-slate-800">
              {practice.question.content}
            </div>
            <div className="mt-6">
              {renderAnswerInput(
                practice.question,
                questionAnswer,
                (next) => setQuestionAnswer(String(next)),
                practice.hasSubmitted
              )}
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void submitQuestion()}
                disabled={practice.hasSubmitted || submitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {practice.hasSubmitted ? '本题已提交' : submitting ? '提交中...' : '提交答案'}
              </button>
              {practice.hasSubmitted && (
                <span className="text-sm text-emerald-600">已提交，等待老师结束本题</span>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs text-purple-700">
              整卷练习
            </span>
            <h1 className="mt-4 text-2xl font-bold text-slate-900">
              {practice.session.paper.title}
            </h1>
          </div>
          {practice.deadlineAt && (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {deadlineText}
            </div>
          )}
        </div>
        {practice.hasSubmitted && (
          <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">
            已交卷。原始分：{practice.rawScore ?? 0}，最终分：{practice.finalScore ?? 0}
            {practice.bonusMultiplier ? `（加成 ${practice.bonusMultiplier}x）` : ''}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {practice.questions.map((question: QuestionItem, index: number) => (
          <div key={question.id} className="rounded-xl bg-white p-6 shadow">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                第 {index + 1} 题
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">
                {question.score} 分
              </span>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
                {question.type}
              </span>
            </div>
            <div className="whitespace-pre-wrap text-lg text-slate-800">
              {question.content}
            </div>
            <div className="mt-6">
              {renderAnswerInput(
                question,
                paperAnswers[question.id],
                (next) =>
                  setPaperAnswers((current) => ({
                    ...current,
                    [question.id]: next,
                  })),
                practice.hasSubmitted
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void submitPaper()}
        disabled={practice.hasSubmitted || submitting}
        className="rounded-lg bg-purple-600 px-6 py-3 text-white hover:bg-purple-700 disabled:opacity-50"
      >
        {practice.hasSubmitted ? '已交卷' : submitting ? '交卷中...' : '提交整张试卷'}
      </button>
    </div>
  )
}
