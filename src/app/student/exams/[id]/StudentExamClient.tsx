'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import CodeEditor from '@/components/CodeEditor'
import LocalRunnerTerminal from '@/components/LocalRunnerTerminal'
import QuestionContent from '@/components/QuestionContent'
import { formatAppDateTime } from '@/lib/date-format'
import { getLocalRunnerSessionConfig, runCodeWithLocalRunner } from '@/lib/challenges/client-judge'
import type { ChallengeValue } from '@/lib/challenges/types'
import { QUESTION_TYPES } from '@/lib/constants'

const VARIABLE_START_MARKER = '__CODEX_EXAM_VARIABLES_START__'
const VARIABLE_END_MARKER = '__CODEX_EXAM_VARIABLES_END__'

interface ObjectiveQuestion {
  id: string
  content: string
  type: string
  score: number
  options: Array<{ key: string; value: string }>
  submittedAnswer: string
}

interface ProgramQuestion {
  id: string
  title: string
  chapterTitle: string
  summary: string
  description: string
  score: number
  initialCode: string
  publicJudge:
    | { mode: 'OUTPUT' }
    | { mode: 'VARIABLES'; variableNames: string[] }
  latestJudgeMessage: string | null
  latestStdout: string | null
  latestStderr: string | null
  latestSubmittedAt: string | null
  isPassed: boolean
}

interface Props {
  examId: string
  initialData: any
}

interface ExamDraft {
  answers?: Record<string, string>
  codeByQuestionId?: Record<string, string>
}

function getExamDraftKey(examId: string) {
  return `exam-draft:${examId}`
}

function getStudentExamDraftKey(examId: string, studentId?: string) {
  return studentId ? `exam-draft:${examId}:${studentId}` : getExamDraftKey(examId)
}

function readExamDraft(examId: string, studentId?: string): ExamDraft {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    return JSON.parse(window.localStorage.getItem(getStudentExamDraftKey(examId, studentId)) || '{}') as ExamDraft
  } catch {
    return {}
  }
}

function writeExamDraft(examId: string, studentId: string | undefined, draft: ExamDraft) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    getStudentExamDraftKey(examId, studentId),
    JSON.stringify({
      ...draft,
      updatedAt: Date.now(),
    })
  )
}

function clearExamDraft(examId: string, studentId?: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(getStudentExamDraftKey(examId, studentId))
  window.localStorage.removeItem(getExamDraftKey(examId))
}

function buildInitialAnswers(data: any, draft: ExamDraft) {
  return {
    ...Object.fromEntries(
      (data.objectiveQuestions || []).map((question: ObjectiveQuestion) => [
        question.id,
        question.submittedAnswer || '',
      ])
    ),
    ...(data.session?.submittedAt ? {} : draft.answers || {}),
  }
}

function buildInitialCodeByQuestionId(data: any, draft: ExamDraft) {
  return {
    ...Object.fromEntries(
      (data.programQuestions || []).map((question: ProgramQuestion) => [
        question.id,
        question.initialCode,
      ])
    ),
    ...(data.session?.submittedAt ? {} : draft.codeByQuestionId || {}),
  }
}

function formatCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function normalizeAnswer(question: ObjectiveQuestion, value: string | string[]) {
  if (Array.isArray(value)) {
    return value.sort().join(',')
  }
  if (question.type === QUESTION_TYPES.MULTIPLE) {
    return String(value || '')
      .split(',')
      .filter(Boolean)
      .sort()
      .join(',')
  }
  return String(value || '')
}

function buildVariableJudgeScript(code: string, variableNames: string[]) {
  const variableNamesJson = JSON.stringify(variableNames, null, 0)

  return `${code}

import json

def __exam_normalize(value):
    if isinstance(value, set):
        normalized_items = [__exam_normalize(item) for item in value]
        return sorted(
            normalized_items,
            key=lambda item: json.dumps(item, ensure_ascii=False, sort_keys=True)
        )
    if isinstance(value, tuple):
        return [__exam_normalize(item) for item in value]
    if isinstance(value, list):
        return [__exam_normalize(item) for item in value]
    if isinstance(value, dict):
        return {
            str(key): __exam_normalize(item)
            for key, item in value.items()
        }
    return value

__exam_result = {}
for __exam_name in ${variableNamesJson}:
    if __exam_name in globals():
        try:
            __exam_value = __exam_normalize(globals()[__exam_name])
            json.dumps(__exam_value, ensure_ascii=False)
            __exam_result[__exam_name] = {
                "missing": False,
                "value": __exam_value,
            }
        except TypeError:
            __exam_result[__exam_name] = {
                "missing": False,
                "value": repr(globals()[__exam_name]),
                "nonJson": True,
            }
    else:
        __exam_result[__exam_name] = {
            "missing": True,
        }

print("${VARIABLE_START_MARKER}")
print(json.dumps(__exam_result, ensure_ascii=False))
print("${VARIABLE_END_MARKER}")
`
}

function extractVariablePayload(stdout: string) {
  const startIndex = stdout.lastIndexOf(VARIABLE_START_MARKER)
  const endIndex = stdout.lastIndexOf(VARIABLE_END_MARKER)

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return {
      stdout,
      variables: null as Record<string, { missing: boolean; value?: ChallengeValue; nonJson?: boolean }> | null,
    }
  }

  const rawPayload = stdout
    .slice(startIndex + VARIABLE_START_MARKER.length, endIndex)
    .trim()
  const visibleStdout = `${stdout.slice(0, startIndex)}${stdout.slice(
    endIndex + VARIABLE_END_MARKER.length
  )}`.trim()

  try {
    return {
      stdout: visibleStdout,
      variables: JSON.parse(rawPayload) as Record<string, { missing: boolean; value?: ChallengeValue; nonJson?: boolean }>,
    }
  } catch {
    return { stdout: visibleStdout, variables: null }
  }
}

export default function StudentExamClient({ examId, initialData }: Props) {
  const router = useRouter()
  const fullscreenExitAllowedRef = useRef(false)
  const enteredFullscreenRef = useRef(false)
  const studentId = initialData.student?.id as string | undefined
  const initialDraftRef = useRef<ExamDraft>(readExamDraft(examId, studentId))
  const [data, setData] = useState(initialData)
  const [now, setNow] = useState(() => Date.now())
  const [savingQuestionId, setSavingQuestionId] = useState('')
  const [submittingProgramId, setSubmittingProgramId] = useState('')
  const [submittingPaper, setSubmittingPaper] = useState(false)
  const [message, setMessage] = useState('')
  const [fullscreenPrompt, setFullscreenPrompt] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [submittedSuccess, setSubmittedSuccess] = useState(
    Boolean(initialData.session?.submittedAt && !initialData.exam?.scoresPublished)
  )
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    buildInitialAnswers(initialData, initialDraftRef.current)
  )
  const [codeByQuestionId, setCodeByQuestionId] = useState<Record<string, string>>(() =>
    buildInitialCodeByQuestionId(initialData, initialDraftRef.current)
  )
  const [activeProgramId, setActiveProgramId] = useState(
    initialData.programQuestions?.[0]?.id || ''
  )

  const exam = data.exam
  const session = data.session
  const isSubmitted = Boolean(session?.submittedAt)
  const canWrite = Boolean(data.isOpen && !isSubmitted)
  const remainingMs = Math.max(0, new Date(exam.endsAt).getTime() - now)
  const activeProgram = (data.programQuestions || []).find(
    (question: ProgramQuestion) => question.id === activeProgramId
  ) || data.programQuestions?.[0]
  const currentCode = activeProgram ? codeByQuestionId[activeProgram.id] || activeProgram.initialCode : ''

  const publishedScoreText = useMemo(() => {
    if (!exam.scoresPublished || !session) {
      return ''
    }
    return `总分 ${session.totalScore}（客观题 ${session.objectiveScore}，程序题 ${session.programScore}）`
  }, [exam.scoresPublished, session])

  const requestExamFullscreen = async () => {
    if (!document.fullscreenEnabled || document.fullscreenElement || !canWrite) {
      return
    }

    try {
      await document.documentElement.requestFullscreen()
      enteredFullscreenRef.current = true
      setFullscreenPrompt(false)
    } catch {
      setFullscreenPrompt(true)
    }
  }

  const refresh = async () => {
    const res = await fetch(`/api/student-exams/${examId}`)
    const next = await res.json()
    if (!res.ok) {
      setMessage(next.error || '刷新考试失败')
      return
    }
    setData(next)
    const draft = readExamDraft(examId, studentId)
    setAnswers(buildInitialAnswers(next, draft))
    setCodeByQuestionId((current) => ({
      ...buildInitialCodeByQuestionId(next, draft),
      ...current,
    }))
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 500)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (canWrite) {
      void requestExamFullscreen()
    }
  }, [canWrite])

  useEffect(() => {
    if (!canWrite) {
      return
    }

    writeExamDraft(examId, studentId, { answers, codeByQuestionId })
  }, [answers, codeByQuestionId, canWrite, examId, studentId])

  useEffect(() => {
    if (!submittedSuccess) {
      return
    }

    fullscreenExitAllowedRef.current = true
    const timer = window.setTimeout(() => {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {})
      }
    }, 1500)

    return () => window.clearTimeout(timer)
  }, [submittedSuccess])

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        enteredFullscreenRef.current = true
        setFullscreenPrompt(false)
        return
      }

      if (
        enteredFullscreenRef.current &&
        canWrite &&
        !fullscreenExitAllowedRef.current
      ) {
        window.alert('考试期间不能退出全屏，将返回考试列表。')
        router.push('/student/exams')
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [canWrite, router])

  useEffect(() => {
    if (!data.isOpen || isSubmitted) {
      return
    }

    if (remainingMs <= 0) {
      void refresh()
    }
  }, [remainingMs, data.isOpen, isSubmitted])

  useEffect(() => {
    if (!data.canEnter) {
      return
    }

    const recordEvent = (type: string) => {
      void fetch(`/api/student-exams/${examId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          payload: { visibilityState: document.visibilityState },
        }),
      }).catch(() => {})
    }

    const handleVisibility = () => {
      recordEvent(document.hidden ? 'focus_lost' : 'focus_returned')
    }
    const handleBlur = () => recordEvent('focus_lost')
    const handleFocus = () => recordEvent('focus_returned')

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    const heartbeat = window.setInterval(() => recordEvent('heartbeat'), 30000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      window.clearInterval(heartbeat)
    }
  }, [data.canEnter, examId])

  const saveObjectiveAnswer = async (question: ObjectiveQuestion, value: string | string[]) => {
    const answer = normalizeAnswer(question, value)
    setAnswers((current) => {
      const next = { ...current, [question.id]: answer }
      writeExamDraft(examId, studentId, { answers: next, codeByQuestionId })
      return next
    })
    if (!canWrite) {
      return
    }

    setSavingQuestionId(question.id)
    try {
      const res = await fetch(`/api/student-exams/${examId}/objective-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, answer }),
      })
      const result = await res.json()
      if (!res.ok) {
        setMessage(result.error || '保存答案失败')
        return
      }
      setMessage('答案已保存')
    } finally {
      setSavingQuestionId('')
    }
  }

  const flushObjectiveAnswers = async () => {
    const questions = (data.objectiveQuestions || []) as ObjectiveQuestion[]
    const results = await Promise.all(
      questions.map(async (question) => {
        const res = await fetch(`/api/student-exams/${examId}/objective-save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: question.id,
            answer: answers[question.id] || '',
          }),
        })
        const result = await res.json()
        if (!res.ok) {
          throw new Error(result.error || '保存答案失败')
        }
        return result
      })
    )

    return results
  }

  const submitProgram = async (question: ProgramQuestion) => {
    const code = codeByQuestionId[question.id] || ''
    if (!code.trim()) {
      setMessage('代码不能为空')
      return
    }
    if (!canWrite) {
      setMessage('考试已提交或已结束')
      return
    }

    setSubmittingProgramId(question.id)
    setMessage('正在运行程序并提交判题...')
    try {
      const runner = await getLocalRunnerSessionConfig()
      const runResult =
        question.publicJudge.mode === 'VARIABLES'
          ? await runCodeWithLocalRunner({
              runner,
              code: buildVariableJudgeScript(code, question.publicJudge.variableNames),
              filenameBase: `${exam.title}-${question.title}`,
            })
          : await runCodeWithLocalRunner({
              runner,
              code,
              filenameBase: `${exam.title}-${question.title}`,
            })
      const parsed =
        question.publicJudge.mode === 'VARIABLES'
          ? extractVariablePayload(runResult.stdout)
          : { stdout: runResult.stdout, variables: null }

      const res = await fetch(`/api/student-exams/${examId}/program-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          code,
          execution: {
            stdout: parsed.stdout,
            stderr: runResult.stderr,
            exitCode: runResult.exitCode,
            timedOut: runResult.timedOut,
            variables: parsed.variables,
          },
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        setMessage(result.error || '程序题提交失败')
        return
      }

      setMessage(result.message || '程序题已提交')
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '程序题提交失败')
    } finally {
      setSubmittingProgramId('')
    }
  }

  const submitPaper = async () => {
    setSubmittingPaper(true)
    try {
      setMessage('正在保存答案...')
      await flushObjectiveAnswers()

      const res = await fetch(`/api/student-exams/${examId}/submit`, {
        method: 'POST',
      })
      const result = await res.json()
      if (!res.ok) {
        setMessage(result.error || '交卷失败')
        return
      }
      fullscreenExitAllowedRef.current = true
      setSubmittedSuccess(true)
      clearExamDraft(examId, studentId)
    } finally {
      setSubmittingPaper(false)
    }
  }

  const renderAnswerInput = (question: ObjectiveQuestion) => {
    const value = answers[question.id] || ''
    if (
      question.type === QUESTION_TYPES.SINGLE ||
      question.type === QUESTION_TYPES.CODE_READING ||
      question.type === QUESTION_TYPES.JUDGE
    ) {
      return (
        <div className="space-y-2">
          {question.options.map((option) => (
            <label
              key={option.key}
              onCopy={(event) => event.preventDefault()}
              onCut={(event) => event.preventDefault()}
              onContextMenu={(event) => event.preventDefault()}
              className="flex select-none items-center gap-3 rounded-lg border px-4 py-3"
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option.key}
                checked={value === option.key}
                disabled={!canWrite}
                onChange={() => void saveObjectiveAnswer(question, option.key)}
              />
              <span>{option.key}. {option.value}</span>
            </label>
          ))}
        </div>
      )
    }

    const checkedValues = value.split(',').filter(Boolean)
    return (
      <div className="space-y-2">
        {question.options.map((option) => (
          <label
            key={option.key}
            onCopy={(event) => event.preventDefault()}
            onCut={(event) => event.preventDefault()}
            onContextMenu={(event) => event.preventDefault()}
            className="flex select-none items-center gap-3 rounded-lg border px-4 py-3"
          >
            <input
              type="checkbox"
              value={option.key}
              checked={checkedValues.includes(option.key)}
              disabled={!canWrite}
              onChange={(event) => {
                const next = new Set(checkedValues)
                if (event.target.checked) {
                  next.add(option.key)
                } else {
                  next.delete(option.key)
                }
                void saveObjectiveAnswer(question, Array.from(next))
              }}
            />
            <span>{option.key}. {option.value}</span>
          </label>
        ))}
      </div>
    )
  }

  if (submittedSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
        <div className="w-full max-w-md rounded-xl bg-white px-6 py-10 text-center shadow">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">
            ✓
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">提交成功</h1>
          <p className="mt-3 text-sm text-slate-500">
            试卷已提交，考试成绩将在老师发布后查看。
          </p>
          <button
            type="button"
            onClick={() => router.push('/student/exams')}
            className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-white hover:bg-blue-700"
          >
            返回考试列表
          </button>
        </div>
      </div>
    )
  }

  if (!data.canEnter) {
    return (
      <div className="mx-auto mt-8 max-w-4xl rounded-xl bg-white px-6 py-12 text-center shadow">
        <h1 className="text-xl font-semibold text-slate-900">{exam.title}</h1>
        <p className="mt-3 text-sm text-slate-500">
          当前不能进入考试。考试时间：{formatAppDateTime(exam.startsAt)} 至 {formatAppDateTime(exam.endsAt)}
        </p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 px-4 py-4">
      <div className="sticky top-0 z-40 rounded-xl bg-white p-4 shadow">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{exam.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>截止：{formatAppDateTime(exam.endsAt)}</span>
              {isSubmitted && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">已交卷</span>}
              {publishedScoreText && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">{publishedScoreText}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg bg-slate-950 px-4 py-2 font-mono text-lg font-bold text-white">
              {formatCountdown(remainingMs)}
            </div>
            <button
              type="button"
              onClick={() => setShowSubmitConfirm(true)}
              disabled={!canWrite || submittingPaper}
              className="rounded-lg bg-purple-600 px-5 py-2.5 text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {isSubmitted ? '已交卷' : submittingPaper ? '交卷中...' : '交卷'}
            </button>
          </div>
        </div>
        {fullscreenPrompt && canWrite && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span>浏览器未允许自动全屏，请点击按钮进入全屏考试。</span>
            <button
              type="button"
              onClick={() => void requestExamFullscreen()}
              className="rounded bg-amber-600 px-3 py-1.5 text-white hover:bg-amber-700"
            >
              进入全屏
            </button>
          </div>
        )}
        {message && <div className="mt-3 text-sm text-slate-600">{message}</div>}
      </div>

      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900">确认交卷</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              确定交卷吗？交卷后不能继续修改答案。
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                disabled={submittingPaper}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                继续检查
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSubmitConfirm(false)
                  void submitPaper()
                }}
                disabled={submittingPaper}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
              >
                确认交卷
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-900">客观题</h2>
        <div className="mt-5 space-y-5">
          {(data.objectiveQuestions || []).map((question: ObjectiveQuestion, index: number) => (
            <div key={question.id} className="rounded-xl border border-slate-200 p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">第 {index + 1} 题</span>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">{question.type}</span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">{question.score} 分</span>
                {savingQuestionId === question.id && <span className="text-xs text-slate-400">保存中...</span>}
              </div>
              <div
                onCopy={(event) => event.preventDefault()}
                onCut={(event) => event.preventDefault()}
                onContextMenu={(event) => event.preventDefault()}
                className="select-none text-base"
              >
                <QuestionContent content={question.content} />
              </div>
              <div className="mt-4">{renderAnswerInput(question)}</div>
            </div>
          ))}
        </div>
      </section>

      {(data.programQuestions || []).length > 0 && (
        <section className="rounded-xl bg-white p-4 shadow">
          <h2 className="px-1 text-xl font-semibold text-slate-900">程序题</h2>
          <div className="mt-5 grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
            <div className="space-y-2">
              {(data.programQuestions || []).map((question: ProgramQuestion, index: number) => (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setActiveProgramId(question.id)}
                  className={`w-full rounded-lg border px-4 py-3 text-left text-sm ${
                    activeProgram?.id === question.id
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-medium">第 {index + 1} 题：{question.title}</div>
                  <div className="mt-1 text-xs opacity-75">{question.score} 分 {question.isPassed ? '/ 已通过' : ''}</div>
                </button>
              ))}
            </div>

            {activeProgram && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                      {activeProgram.chapterTitle}
                    </span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">
                      {activeProgram.score} 分
                    </span>
                    {activeProgram.isPassed && (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                        已通过
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">{activeProgram.title}</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {activeProgram.description}
                  </p>
                  {activeProgram.latestJudgeMessage && (
                    <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                      最近提交：{activeProgram.latestJudgeMessage}
                      {activeProgram.latestSubmittedAt ? ` / ${formatAppDateTime(activeProgram.latestSubmittedAt)}` : ''}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 2xl:grid-cols-[minmax(760px,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between bg-slate-800 px-4 py-3 text-white">
                      <span className="text-sm">代码编辑</span>
                      <button
                        type="button"
                        onClick={() => void submitProgram(activeProgram)}
                        disabled={!canWrite || submittingProgramId === activeProgram.id}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        {submittingProgramId === activeProgram.id ? '提交中...' : '提交判题'}
                      </button>
                    </div>
                    <CodeEditor
                      code={currentCode}
                      readOnly={!canWrite}
                      onChange={(next) =>
                        setCodeByQuestionId((current) => {
                          const nextCodeByQuestionId = {
                            ...current,
                            [activeProgram.id]: next,
                          }
                          writeExamDraft(examId, studentId, {
                            answers,
                            codeByQuestionId: nextCodeByQuestionId,
                          })
                          return nextCodeByQuestionId
                        })
                      }
                      className="min-h-[70vh]"
                      minHeightClassName="min-h-[70vh]"
                    />
                  </div>
                  <LocalRunnerTerminal
                    assignmentTitle={`${exam.title}-${activeProgram.title}`}
                    code={currentCode}
                    className="min-h-[70vh]"
                    terminalClassName="h-[calc(70vh-10rem)] min-h-[360px]"
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
