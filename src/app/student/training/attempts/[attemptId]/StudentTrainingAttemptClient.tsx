'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import CodeEditor from '@/components/CodeEditor'
import LocalRunnerTerminal from '@/components/LocalRunnerTerminal'
import QuestionContent from '@/components/QuestionContent'
import { getLocalRunnerSessionConfig, runCodeWithLocalRunner } from '@/lib/challenges/client-judge'
import type { ChallengeValue } from '@/lib/challenges/types'
import { QUESTION_TYPES, TRAINING_ATTEMPT_STATUSES } from '@/lib/constants'

const VARIABLE_START_MARKER = '__CODEX_TRAINING_VARIABLES_START__'
const VARIABLE_END_MARKER = '__CODEX_TRAINING_VARIABLES_END__'

interface ObjectiveQuestion {
  id: string
  content: string
  type: string
  score: number
  options: Array<{ key: string; value: string }>
  submittedAnswer: string
  isCorrect: boolean | null
  awardedScore: number | null
  correctAnswer: string | null
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
  attemptId: string
  initialData: any
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

function hasSubmittedObjective(question: ObjectiveQuestion) {
  return question.isCorrect !== null
}

function buildVariableJudgeScript(code: string, variableNames: string[]) {
  const variableNamesJson = JSON.stringify(variableNames, null, 0)

  return `${code}

import json

def __training_normalize(value):
    if isinstance(value, set):
        normalized_items = [__training_normalize(item) for item in value]
        return sorted(
            normalized_items,
            key=lambda item: json.dumps(item, ensure_ascii=False, sort_keys=True)
        )
    if isinstance(value, tuple):
        return [__training_normalize(item) for item in value]
    if isinstance(value, list):
        return [__training_normalize(item) for item in value]
    if isinstance(value, dict):
        return {
            str(key): __training_normalize(item)
            for key, item in value.items()
        }
    return value

__training_result = {}
for __training_name in ${variableNamesJson}:
    if __training_name in globals():
        try:
            __training_value = __training_normalize(globals()[__training_name])
            json.dumps(__training_value, ensure_ascii=False)
            __training_result[__training_name] = {
                "missing": False,
                "value": __training_value,
            }
        except TypeError:
            __training_result[__training_name] = {
                "missing": False,
                "value": repr(globals()[__training_name]),
                "nonJson": True,
            }
    else:
        __training_result[__training_name] = {
            "missing": True,
        }

print("${VARIABLE_START_MARKER}")
print(json.dumps(__training_result, ensure_ascii=False))
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

export default function StudentTrainingAttemptClient({ attemptId, initialData }: Props) {
  const [data, setData] = useState(initialData)
  const [activeObjectiveIndex, setActiveObjectiveIndex] = useState(0)
  const [activeProgramIndex, setActiveProgramIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (initialData.objectiveQuestions || []).map((question: ObjectiveQuestion) => [
        question.id,
        question.submittedAnswer || '',
      ])
    )
  )
  const [codeByQuestionId, setCodeByQuestionId] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (initialData.programQuestions || []).map((question: ProgramQuestion) => [
        question.id,
        question.initialCode,
      ])
    )
  )
  const [message, setMessage] = useState('')
  const [submittingObjectiveId, setSubmittingObjectiveId] = useState('')
  const [submittingProgramId, setSubmittingProgramId] = useState('')
  const [completing, setCompleting] = useState(false)

  const trainingSet = data.trainingSet
  const attempt = data.attempt
  const objectiveQuestions = (data.objectiveQuestions || []) as ObjectiveQuestion[]
  const programQuestions = (data.programQuestions || []) as ProgramQuestion[]
  const activeObjective = objectiveQuestions[activeObjectiveIndex] || null
  const activeProgram = programQuestions[activeProgramIndex] || null
  const canWrite = attempt.status === TRAINING_ATTEMPT_STATUSES.IN_PROGRESS
  const totalScore = useMemo(
    () =>
      objectiveQuestions.reduce((total, question) => total + question.score, 0) +
      programQuestions.reduce((total, question) => total + question.score, 0),
    [objectiveQuestions, programQuestions]
  )

  const refresh = async () => {
    const res = await fetch(`/api/student-training/attempts/${attemptId}`)
    const next = await res.json()
    if (!res.ok) {
      setMessage(next.error || '刷新训练失败')
      return
    }
    setData(next)
    setAnswers((current) => ({
      ...current,
      ...Object.fromEntries(
        (next.objectiveQuestions || []).map((question: ObjectiveQuestion) => [
          question.id,
          question.submittedAnswer || current[question.id] || '',
        ])
      ),
    }))
  }

  const submitObjective = async (question: ObjectiveQuestion) => {
    if (hasSubmittedObjective(question)) {
      setMessage('本题已提交，不能修改答案')
      return
    }

    const answer = normalizeAnswer(question, answers[question.id] || '')
    if (!answer) {
      setMessage('请选择答案')
      return
    }

    setSubmittingObjectiveId(question.id)
    try {
      const res = await fetch(`/api/student-training/attempts/${attemptId}/objective-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, answer }),
      })
      const result = await res.json()
      if (!res.ok) {
        setMessage(result.error || '提交答案失败')
        return
      }
      setMessage(result.isCorrect ? '回答正确' : `回答错误，正确答案：${result.correctAnswer}`)
      await refresh()
    } finally {
      setSubmittingObjectiveId('')
    }
  }

  const submitProgram = async (question: ProgramQuestion) => {
    const code = codeByQuestionId[question.id] || ''
    if (!code.trim()) {
      setMessage('代码不能为空')
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
              filenameBase: `${trainingSet.title}-${question.title}`,
            })
          : await runCodeWithLocalRunner({
              runner,
              code,
              filenameBase: `${trainingSet.title}-${question.title}`,
            })
      const parsed =
        question.publicJudge.mode === 'VARIABLES'
          ? extractVariablePayload(runResult.stdout)
          : { stdout: runResult.stdout, variables: null }

      const res = await fetch(`/api/student-training/attempts/${attemptId}/program-submit`, {
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

  const completeAttempt = async () => {
    setCompleting(true)
    try {
      const res = await fetch(`/api/student-training/attempts/${attemptId}/complete`, {
        method: 'POST',
      })
      const result = await res.json()
      if (!res.ok) {
        setMessage(result.error || '完成练习失败')
        return
      }
      setMessage('本次练习已完成')
      await refresh()
    } finally {
      setCompleting(false)
    }
  }

  const renderAnswerInput = (question: ObjectiveQuestion) => {
    const submitted = hasSubmittedObjective(question)
    const value = submitted ? question.submittedAnswer : answers[question.id] || ''
    if (
      question.type === QUESTION_TYPES.SINGLE ||
      question.type === QUESTION_TYPES.CODE_READING ||
      question.type === QUESTION_TYPES.JUDGE
    ) {
      return (
        <div className="space-y-3">
          {question.options.map((option) => (
            <label key={option.key} className="flex items-center gap-3 rounded-lg border px-4 py-3">
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option.key}
                checked={value === option.key}
                disabled={!canWrite || submitted}
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                }
              />
              <span>{option.key}. {option.value}</span>
            </label>
          ))}
        </div>
      )
    }

    if (question.type === QUESTION_TYPES.MULTIPLE) {
      const checkedValues = value.split(',').filter(Boolean)
      return (
        <div className="space-y-3">
          {question.options.map((option) => (
            <label key={option.key} className="flex items-center gap-3 rounded-lg border px-4 py-3">
              <input
                type="checkbox"
                value={option.key}
                checked={checkedValues.includes(option.key)}
                disabled={!canWrite || submitted}
                onChange={(event) => {
                  const next = new Set(checkedValues)
                  if (event.target.checked) {
                    next.add(option.key)
                  } else {
                    next.delete(option.key)
                  }
                  setAnswers((current) => ({
                    ...current,
                    [question.id]: Array.from(next).sort().join(','),
                  }))
                }}
              />
              <span>{option.key}. {option.value}</span>
            </label>
          ))}
        </div>
      )
    }

    return null
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/student/training" className="text-sm text-blue-600 hover:text-blue-700">
            返回训练场
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{trainingSet.title}</h1>
          <p className="mt-2 text-sm text-slate-500">
            当前得分 {attempt.totalScore}/{totalScore}
            {attempt.status === TRAINING_ATTEMPT_STATUSES.COMPLETED ? ' / 已完成' : ' / 练习中'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void completeAttempt()}
          disabled={!canWrite || completing}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {completing ? '完成中...' : '完成本次练习'}
        </button>
      </div>

      {message && (
        <div className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-xl bg-white p-4 shadow">
            <div className="font-semibold text-slate-900">客观题</div>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {objectiveQuestions.map((question, index) => (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setActiveObjectiveIndex(index)}
                  className={`h-10 rounded-lg text-sm ${
                    index === activeObjectiveIndex
                      ? 'bg-blue-600 text-white'
                      : question.isCorrect === true
                        ? 'bg-emerald-100 text-emerald-700'
                        : question.isCorrect === false
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>

          {programQuestions.length > 0 && (
            <div className="rounded-xl bg-white p-4 shadow">
              <div className="font-semibold text-slate-900">程序题</div>
              <div className="mt-3 space-y-2">
                {programQuestions.map((question, index) => (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => setActiveProgramIndex(index)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                      index === activeProgramIndex
                        ? 'bg-blue-600 text-white'
                        : question.isPassed
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {question.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="space-y-6">
          {activeObjective && (
            <section className="rounded-xl bg-white p-6 shadow">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-500">
                    客观题 {activeObjectiveIndex + 1} / {objectiveQuestions.length}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{activeObjective.score} 分</div>
                </div>
                <button
                  type="button"
                  onClick={() => void submitObjective(activeObjective)}
                  disabled={
                    !canWrite ||
                    hasSubmittedObjective(activeObjective) ||
                    submittingObjectiveId === activeObjective.id
                  }
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {hasSubmittedObjective(activeObjective)
                    ? '已提交'
                    : submittingObjectiveId === activeObjective.id
                      ? '提交中...'
                      : '提交本题'}
                </button>
              </div>
              <QuestionContent content={activeObjective.content} />
              <div className="mt-6">{renderAnswerInput(activeObjective)}</div>
              {activeObjective.correctAnswer && (
                <div
                  className={`mt-5 rounded-lg px-4 py-3 text-sm ${
                    activeObjective.isCorrect
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {activeObjective.isCorrect ? '回答正确' : '回答错误'} / 正确答案：
                  {activeObjective.correctAnswer}
                </div>
              )}
            </section>
          )}

          {activeProgram && (
            <section className="rounded-xl bg-white p-6 shadow">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-500">{activeProgram.chapterTitle}</div>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">{activeProgram.title}</h2>
                  <div className="mt-1 text-sm text-slate-500">{activeProgram.score} 分</div>
                </div>
                <button
                  type="button"
                  onClick={() => void submitProgram(activeProgram)}
                  disabled={!canWrite || submittingProgramId === activeProgram.id}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submittingProgramId === activeProgram.id ? '提交中...' : '提交判题'}
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {activeProgram.description}
              </p>
              {activeProgram.latestJudgeMessage && (
                <div
                  className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                    activeProgram.isPassed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  最近提交：{activeProgram.latestJudgeMessage}
                </div>
              )}
              <div className="mt-5 grid gap-4 2xl:grid-cols-[minmax(760px,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_360px]">
                <CodeEditor
                  code={codeByQuestionId[activeProgram.id] || ''}
                  readOnly={!canWrite}
                  onChange={(next) =>
                    setCodeByQuestionId((current) => ({
                      ...current,
                      [activeProgram.id]: next,
                    }))
                  }
                  minHeightClassName="min-h-[520px]"
                />
                <LocalRunnerTerminal
                  assignmentTitle={`${trainingSet.title}-${activeProgram.title}`}
                  code={codeByQuestionId[activeProgram.id] || ''}
                  className="min-h-[520px]"
                  terminalClassName="h-[360px]"
                />
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
