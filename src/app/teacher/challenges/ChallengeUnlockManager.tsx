'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ChapterUnlockState {
  key: string
  title: string
  description: string
  theme: string
  isUnlocked: boolean
  levels: {
    key: string
    title: string
    summary: string
    isUnlocked: boolean
    passedCount: number
    totalStudents: number
  }[]
}

interface StudentRanking {
  id: string
  name: string
  username: string
  passedCount: number
  notPassedCount: number
  levelStatuses: {
    key: string
    title: string
    isPassed: boolean
  }[]
}

interface Props {
  classOptions: string[]
  selectedClassName: string
  chapter: ChapterUnlockState
  totalStudents: number
  studentRankings: StudentRanking[]
}

export default function ChallengeUnlockManager({
  classOptions,
  selectedClassName,
  chapter,
  totalStudents,
  studentRankings,
}: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [state, setState] = useState(chapter)
  const [rankingState, setRankingState] = useState(studentRankings)
  const [showStudentRanking, setShowStudentRanking] = useState(false)

  const enabledChapterKeys = useMemo(() => (state.isUnlocked ? [state.key] : []), [state])
  const enabledLevelKeys = useMemo(
    () =>
      state.levels
        .filter((level) => state.isUnlocked && level.isUnlocked)
        .map((level) => ({
          chapterKey: state.key,
          levelKey: level.key,
        })),
    [state]
  )

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    try {
      const res = await fetch('/api/challenges/unlocks', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          className: selectedClassName,
          chapterKeys: enabledChapterKeys,
          levelKeys: enabledLevelKeys,
          scopeChapterKey: state.key,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || '保存失败')
        return
      }

      setState(data.chapter)
      setRankingState(data.studentRankings)
      setMessage('保存成功')
    } catch {
      setMessage('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">任务开放控制</h2>
            <p className="mt-2 text-sm text-slate-600">
              勾选任务表示整项开放；勾选具体关卡表示该关可提前开放。
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>班级人数：{totalStudents}</span>
              <span>当前任务关卡总数：{state.levels.length}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedClassName}
              onChange={(event) => {
                const nextClassName = event.target.value
                router.push(
                  `/teacher/challenges/${state.key}?className=${encodeURIComponent(nextClassName)}`
                )
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {classOptions.map((className) => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </select>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存开放设置'}
            </button>
          </div>
        </div>

        {message && (
          <div className={`mt-4 text-sm ${message.includes('成功') ? 'text-emerald-600' : 'text-rose-600'}`}>
            {message}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
              {state.theme}
            </div>
            <h3 className="mt-3 text-xl font-semibold text-slate-900">{state.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{state.description}</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={state.isUnlocked}
              onChange={(event) => {
                const checked = event.target.checked
                setState((current) => ({ ...current, isUnlocked: checked }))
              }}
              className="h-4 w-4 rounded border-slate-300"
            />
            开放本任务
          </label>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {state.levels.map((level, levelIndex) => (
            <div
              key={level.key}
              className={`flex items-start justify-between gap-3 rounded-xl border p-4 ${
                state.isUnlocked ? 'border-slate-200 bg-slate-50' : 'border-slate-100 bg-slate-100'
              }`}
            >
              <div className="flex-1">
                <div className="text-xs text-slate-500">第 {levelIndex + 1} 关</div>
                <div className="mt-1 text-sm font-medium text-slate-900">{level.title}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{level.summary}</div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>通关进度</span>
                    <span>
                      {level.passedCount}/{level.totalStudents || 0}
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 transition-all"
                      style={{
                        width: `${
                          level.totalStudents > 0
                            ? Math.min((level.passedCount / level.totalStudents) * 100, 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    通关人数/总人数：{level.passedCount}/{level.totalStudents || 0}
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={level.isUnlocked}
                  disabled={!state.isUnlocked}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setState((current) => ({
                      ...current,
                      levels: current.levels.map((child, childIndex) =>
                        childIndex === levelIndex ? { ...child, isUnlocked: checked } : child
                      ),
                    }))
                  }}
                  className="h-4 w-4 rounded border-slate-300"
                />
                提前开放
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">学生通关榜</h2>
            <p className="mt-2 text-sm text-slate-600">
              默认折叠。展开后按通过数逆序查看本班学生在当前闯关任务中的完成情况。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowStudentRanking((current) => !current)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {showStudentRanking ? '收起学生榜' : '展开学生榜'}
          </button>
        </div>

        {showStudentRanking && (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rankingState.map((student, index) => (
              <div
                key={student.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500">第 {index + 1} 名</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">
                      {student.name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">@{student.username}</div>
                  </div>
                  <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                    通过 {student.passedCount}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                  <span>通过数：{student.passedCount}</span>
                  <span>未通过数：{student.notPassedCount}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {student.levelStatuses.map((levelStatus) => (
                    <div
                      key={levelStatus.key}
                      title={levelStatus.title}
                      className={`h-3.5 w-3.5 rounded-sm ring-1 ring-inset ${
                        levelStatus.isPassed
                          ? 'bg-emerald-500 ring-emerald-600/30'
                          : 'bg-pink-300 ring-pink-400/40'
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
