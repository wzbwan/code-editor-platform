'use client'

import { useEffect, useState } from 'react'
import { PRACTICE_MODES, PRACTICE_STATUSES, UNASSIGNED_CLASS_FILTER } from '@/lib/constants'
import { formatAppDateTime } from '@/lib/date-format'
import { getModeLabel, getStatusLabel } from '@/lib/quiz'

interface Props {
  sessionId: string
  initialData: any
}

function formatCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function PracticeTeacherBoard({ sessionId, initialData }: Props) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [customSeconds, setCustomSeconds] = useState(5)
  const [customTimerEndsAt, setCustomTimerEndsAt] = useState<number | null>(null)

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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 250)

    return () => window.clearInterval(timer)
  }, [])

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
  const submissionRoster = data.submissionRoster || []
  const paperDeadlineAt =
    session.mode === PRACTICE_MODES.PAPER && session.startedAt && session.durationMinutes
      ? new Date(session.startedAt).getTime() + session.durationMinutes * 60 * 1000
      : null
  const paperRemainingMs = paperDeadlineAt ? Math.max(0, paperDeadlineAt - now) : 0
  const customRemainingMs =
    customTimerEndsAt === null ? null : Math.max(0, customTimerEndsAt - now)
  const isCustomTimerRunning = customRemainingMs !== null && customRemainingMs > 0
  const isCustomTimerFinished = customTimerEndsAt !== null && customRemainingMs === 0

  const startCustomTimer = () => {
    const safeSeconds = Number.isFinite(customSeconds) && customSeconds > 0 ? customSeconds : 5
    setCustomSeconds(safeSeconds)
    setCustomTimerEndsAt(Date.now() + safeSeconds * 1000)
  }

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

      {session.mode === PRACTICE_MODES.QUESTION && (
        <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 p-6 shadow">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.2em] text-amber-700">
                倒计时
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="number"
                min={1}
                value={customSeconds}
                onChange={(event) => setCustomSeconds(Number(event.target.value) || 0)}
                className="w-28 rounded-lg border border-amber-300 px-3 py-2 text-sm"
              />
              <span className="text-sm text-slate-600">秒</span>
              <button
                type="button"
                onClick={startCustomTimer}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
              >
                开始倒计时
              </button>
              <button
                type="button"
                onClick={() => setCustomTimerEndsAt(null)}
                className="rounded-lg bg-white px-4 py-2 text-sm text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                清空
              </button>
            </div>
          </div>
          <div className="mt-6 rounded-2xl bg-slate-950 px-6 py-8 text-center">
            <div className="text-sm uppercase tracking-[0.35em] text-amber-300">Timer</div>
            <div className="mt-3 text-6xl font-black tracking-[0.12em] text-white md:text-7xl">
              {customRemainingMs === null ? '00:05' : formatCountdown(customRemainingMs)}
            </div>
            <div className="mt-3 text-base text-slate-300">
              {isCustomTimerRunning
                ? '倒计时进行中'
                : isCustomTimerFinished
                  ? '时间到'
                  : '点击“开始倒计时”后显示'}
            </div>
          </div>
        </div>
      )}

      {session.mode === PRACTICE_MODES.PAPER && paperDeadlineAt && (
        <div className="rounded-2xl border-2 border-purple-300 bg-gradient-to-r from-purple-50 via-fuchsia-50 to-rose-50 p-6 shadow">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.2em] text-purple-700">
                整卷同步倒计时
              </div>
              <div className="mt-2 text-sm text-slate-600">
                和学生端剩余时间保持同一口径，基于练习开始时间与答题时长计算。
              </div>
            </div>
            <div className="text-sm text-slate-600">
              截止时间：{formatAppDateTime(new Date(paperDeadlineAt))}
            </div>
          </div>
          <div className="mt-6 rounded-2xl bg-slate-950 px-6 py-8 text-center">
            <div className="text-sm uppercase tracking-[0.35em] text-fuchsia-300">Remaining</div>
            <div className="mt-3 text-6xl font-black tracking-[0.12em] text-white md:text-7xl">
              {formatCountdown(paperRemainingMs)}
            </div>
            <div className="mt-3 text-base text-slate-300">
              {paperRemainingMs > 0 ? '学生端仍可交卷' : '已到截止时间'}
            </div>
          </div>
        </div>
      )}

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
              {submissionRoster.map((item: any) => {
                const student = item.student
                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border px-4 py-3 ${
                      item.hasSubmitted
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className={`font-medium ${item.hasSubmitted ? 'text-emerald-800' : 'text-slate-900'}`}>
                      {student?.name || '学生'}
                    </div>
                    <div className={`mt-1 text-sm ${item.hasSubmitted ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {student?.username}
                      {student?.className ? ` · ${student.className}` : ''}
                    </div>
                    <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      item.hasSubmitted
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.hasSubmitted
                        ? session.mode === PRACTICE_MODES.PAPER
                          ? '已交卷'
                          : '已提交'
                        : session.mode === PRACTICE_MODES.PAPER
                          ? '未交卷'
                          : '未提交'}
                    </div>
                    <div className={`mt-2 text-sm ${item.hasSubmitted ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {item.submittedAt
                        ? `提交时间：${formatAppDateTime(item.submittedAt)}`
                        : '暂未提交'}
                    </div>
                  </div>
                )
              })}
              {submissionRoster.length === 0 && (
                <div className="text-sm text-slate-500">暂时还没有提交记录</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
