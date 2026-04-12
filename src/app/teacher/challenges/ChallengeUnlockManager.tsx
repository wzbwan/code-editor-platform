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
  }[]
}

interface Props {
  classOptions: string[]
  selectedClassName: string
  chapters: ChapterUnlockState[]
}

export default function ChallengeUnlockManager({
  classOptions,
  selectedClassName,
  chapters,
}: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [state, setState] = useState(chapters)

  const enabledChapterKeys = useMemo(
    () => state.filter((chapter) => chapter.isUnlocked).map((chapter) => chapter.key),
    [state]
  )

  const enabledLevelKeys = useMemo(
    () =>
      state.flatMap((chapter) =>
        chapter.levels
          .filter((level) => chapter.isUnlocked && level.isUnlocked)
          .map((level) => ({
            chapterKey: chapter.key,
            levelKey: level.key,
          }))
      ),
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
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || '保存失败')
        return
      }

      setState(data.chapters)
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
            <h2 className="text-lg font-semibold text-slate-900">班级开放控制</h2>
            <p className="mt-2 text-sm text-slate-600">
              勾选章节表示整章开放；勾选具体关卡表示该关可提前开放。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedClassName}
              onChange={(event) => {
                const nextClassName = event.target.value
                router.push(`/teacher/challenges?className=${encodeURIComponent(nextClassName)}`)
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

      {state.map((chapter, chapterIndex) => (
        <div key={chapter.key} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                {chapter.theme}
              </div>
              <h3 className="mt-3 text-xl font-semibold text-slate-900">{chapter.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{chapter.description}</p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={chapter.isUnlocked}
                onChange={(event) => {
                  const checked = event.target.checked
                  setState((current) =>
                    current.map((item, index) =>
                      index === chapterIndex ? { ...item, isUnlocked: checked } : item
                    )
                  )
                }}
                className="h-4 w-4 rounded border-slate-300"
              />
              开放本章
            </label>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {chapter.levels.map((level, levelIndex) => (
              <label
                key={level.key}
                className={`flex items-start justify-between gap-3 rounded-xl border p-4 ${
                  chapter.isUnlocked ? 'border-slate-200 bg-slate-50' : 'border-slate-100 bg-slate-100'
                }`}
              >
                <div>
                  <div className="text-xs text-slate-500">第 {levelIndex + 1} 关</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{level.title}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{level.summary}</div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={level.isUnlocked}
                    disabled={!chapter.isUnlocked}
                    onChange={(event) => {
                      const checked = event.target.checked
                      setState((current) =>
                        current.map((item, index) =>
                          index === chapterIndex
                            ? {
                                ...item,
                                levels: item.levels.map((child, childIndex) =>
                                  childIndex === levelIndex
                                    ? { ...child, isUnlocked: checked }
                                    : child
                                ),
                              }
                            : item
                        )
                      )
                    }}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  提前开放
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
