'use client'

import { useEffect, useState } from 'react'
import { PRACTICE_MODES, PRACTICE_STATUSES, UNASSIGNED_CLASS_FILTER } from '@/lib/constants'
import { formatAppDateTime } from '@/lib/date-format'
import { getModeLabel, getStatusLabel } from '@/lib/quiz'

interface Props {
  sessionId: string
  initialData: any
}

export default function PracticeTeacherBoard({ sessionId, initialData }: Props) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    const res = await fetch(`/api/practice-sessions/${sessionId}`)
    const next = await res.json()

    if (!res.ok) {
      alert(next.error || '加载练习状态失败')
      return
    }

    setData(next)
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh()
    }, 3000)

    return () => window.clearInterval(timer)
  }, [sessionId])

  const handleAction = async (action: string) => {
    setLoading(true)

    try {
      const res = await fetch(`/api/practice-sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const result = await res.json()

      if (!res.ok) {
        alert(result.error || '操作失败')
        return
      }

      await refresh()
    } finally {
      setLoading(false)
    }
  }

  const session = data.session
  const currentQuestion = data.currentQuestion

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{session.paper.title}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {getModeLabel(session.mode)} / {getStatusLabel(session.status)} / 班级：
              {session.className === UNASSIGNED_CLASS_FILTER ? '未分班' : session.className}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
            >
              刷新
            </button>
            {session.mode === PRACTICE_MODES.QUESTION &&
              session.status === PRACTICE_STATUSES.PENDING && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleAction('START_QUESTION')}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  开始作答
                </button>
              )}
            {session.mode === PRACTICE_MODES.QUESTION &&
              session.status === PRACTICE_STATUSES.ACTIVE && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleAction('END_QUESTION')}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  结束本题
                </button>
              )}
            {session.mode === PRACTICE_MODES.QUESTION &&
              session.status === PRACTICE_STATUSES.REVIEW && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleAction('NEXT_QUESTION')}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  下一题 / 结束练习
                </button>
              )}
            {session.status !== PRACTICE_STATUSES.ENDED && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleAction('END_SESSION')}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                结束练习
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-xl bg-white p-6 shadow xl:col-span-2">
          {session.mode === PRACTICE_MODES.QUESTION ? (
            currentQuestion ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
                    第 {session.currentQuestionIndex + 1} / {session.paper.questions.length} 题
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">
                    {currentQuestion.score} 分
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    {currentQuestion.type}
                  </span>
                </div>
                <div className="whitespace-pre-wrap rounded-xl border border-slate-200 p-4 text-slate-800">
                  {currentQuestion.content}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    currentQuestion.optionA ? `A. ${currentQuestion.optionA}` : '',
                    currentQuestion.optionB ? `B. ${currentQuestion.optionB}` : '',
                    currentQuestion.optionC ? `C. ${currentQuestion.optionC}` : '',
                    currentQuestion.optionD ? `D. ${currentQuestion.optionD}` : '',
                  ]
                    .filter(Boolean)
                    .map((option) => (
                      <div
                        key={option}
                        className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700"
                      >
                        {option}
                      </div>
                    ))}
                </div>
                {session.status === PRACTICE_STATUSES.REVIEW && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-sm font-medium text-emerald-700">
                      正确答案：{currentQuestion.answer}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-500">本次练习已无剩余题目</div>
            )
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-sm text-slate-500">
                  整卷练习已下发给学生，题目顺序和选项顺序按学生维度随机打乱。
                </div>
                {session.durationMinutes && (
                  <div className="mt-2 text-sm text-slate-700">
                    答题时长：{session.durationMinutes} 分钟
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {session.paper.questions.map((question: any, index: number) => (
                  <div key={question.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        第 {index + 1} 题
                      </span>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                        {question.type}
                      </span>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                        {question.score} 分
                      </span>
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                      {question.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold">实时进度</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="text-sm text-blue-600">班级总人数</div>
                <div className="mt-2 text-3xl font-bold text-blue-700">{data.totalStudents}</div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-4">
                <div className="text-sm text-emerald-600">
                  {session.mode === PRACTICE_MODES.PAPER ? '已交卷' : '已提交'}
                </div>
                <div className="mt-2 text-3xl font-bold text-emerald-700">
                  {data.submittedCount}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold">
              {session.mode === PRACTICE_MODES.PAPER ? '学生提交情况' : '本题提交情况'}
            </h2>
            <div className="space-y-3">
              {(session.mode === PRACTICE_MODES.PAPER
                ? data.session.students
                : data.currentQuestionResponses
              ).map((item: any) => {
                const student = session.mode === PRACTICE_MODES.PAPER ? item.student : item.student
                const submittedAt =
                  session.mode === PRACTICE_MODES.PAPER ? item.submittedAt : item.submittedAt

                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-200 px-4 py-3"
                  >
                    <div className="font-medium text-slate-900">
                      {student?.name || '学生'}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {student?.username}
                      {student?.className ? ` · ${student.className}` : ''}
                    </div>
                    {submittedAt && (
                      <div className="mt-1 text-sm text-slate-500">
                        提交时间：{formatAppDateTime(submittedAt)}
                      </div>
                    )}
                  </div>
                )
              })}
              {(session.mode === PRACTICE_MODES.PAPER
                ? data.session.students.length
                : data.currentQuestionResponses.length) === 0 && (
                <div className="text-sm text-slate-500">暂时还没有提交记录</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
