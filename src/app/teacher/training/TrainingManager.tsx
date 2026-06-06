'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TRAINING_SET_STATUSES, UNASSIGNED_CLASS_FILTER } from '@/lib/constants'
import { formatAppDateTime } from '@/lib/date-format'

interface Paper {
  id: string
  title: string
  _count: {
    questions: number
  }
}

interface TrainingSet {
  id: string
  title: string
  description: string | null
  className: string
  status: string
  publishedAt: string | null
  archivedAt: string | null
  createdAt: string
  _count: {
    objectiveQuestions: number
    programQuestions: number
    attempts: number
  }
}

interface ChallengeOption {
  key: string
  title: string
  levels: Array<{
    key: string
    title: string
    points: number
  }>
}

interface Props {
  initialData: {
    papers: Paper[]
    trainingSets: TrainingSet[]
    classOptions: string[]
    challengeOptions: ChallengeOption[]
  }
}

function getStatusLabel(status: string) {
  if (status === TRAINING_SET_STATUSES.PUBLISHED) {
    return '已发布'
  }
  if (status === TRAINING_SET_STATUSES.ARCHIVED) {
    return '已下架'
  }
  return '草稿'
}

function getStatusClassName(status: string) {
  if (status === TRAINING_SET_STATUSES.PUBLISHED) {
    return 'bg-emerald-100 text-emerald-700'
  }
  if (status === TRAINING_SET_STATUSES.ARCHIVED) {
    return 'bg-slate-100 text-slate-600'
  }
  return 'bg-amber-100 text-amber-700'
}

export default function TrainingManager({ initialData }: Props) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [actionId, setActionId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [classNames, setClassNames] = useState<string[]>(
    initialData.classOptions[0] ? [initialData.classOptions[0]] : []
  )
  const [paperId, setPaperId] = useState(initialData.papers[0]?.id || '')
  const [selectedPrograms, setSelectedPrograms] = useState<Record<string, boolean>>({})
  const allClassesSelected =
    initialData.classOptions.length > 0 && classNames.length === initialData.classOptions.length

  const selectedProgramRows = useMemo(() => {
    return initialData.challengeOptions.flatMap((chapter) =>
      chapter.levels
        .filter((level) => selectedPrograms[`${chapter.key}:${level.key}`])
        .map((level) => ({
          chapterKey: chapter.key,
          levelKey: level.key,
          label: `${chapter.title} / ${level.title}`,
          score: level.points,
        }))
    )
  }, [initialData.challengeOptions, selectedPrograms])

  const handleCreate = async () => {
    if (!title.trim()) {
      alert('请填写训练名称')
      return
    }
    if (classNames.length === 0 || !paperId) {
      alert('请选择班级和客观题试卷')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/training-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          classNames,
          paperId,
          programQuestions: selectedProgramRows.map((item) => ({
            chapterKey: item.chapterKey,
            levelKey: item.levelKey,
            score: item.score,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || '创建训练任务失败')
        return
      }

      if (data.count === 1 && data.id) {
        router.push(`/teacher/training/${data.id}`)
      } else {
        setTitle('')
        setDescription('')
        router.refresh()
      }
    } finally {
      setCreating(false)
    }
  }

  const handleClassToggle = (item: string, checked: boolean) => {
    setClassNames((current) => {
      if (checked) {
        return current.includes(item) ? current : [...current, item]
      }
      return current.filter((className) => className !== item)
    })
  }

  const handleToggleAllClasses = () => {
    setClassNames(allClassesSelected ? [] : [...initialData.classOptions])
  }

  const handleAction = async (trainingSet: TrainingSet, action: string) => {
    setActionId(trainingSet.id)
    try {
      const res = await fetch(`/api/training-sets/${trainingSet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || '操作训练任务失败')
        return
      }

      router.refresh()
    } finally {
      setActionId('')
    }
  }

  const handleDelete = async (trainingSet: TrainingSet) => {
    if (!window.confirm(`确认删除训练任务“${trainingSet.title}”吗？仅未产生练习记录的任务可删除。`)) {
      return
    }

    setDeletingId(trainingSet.id)
    try {
      const res = await fetch(`/api/training-sets?id=${encodeURIComponent(trainingSet.id)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || '删除训练任务失败')
        return
      }

      router.refresh()
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(360px,440px)_1fr]">
      <div className="rounded-xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-900">创建训练任务</h2>
        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">训练名称</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="例如：期末选择题冲刺"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">说明</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="h-20 w-full rounded-lg border px-3 py-2"
              placeholder="可选"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <label className="block text-sm font-medium">班级</label>
                <button
                  type="button"
                  onClick={handleToggleAllClasses}
                  disabled={initialData.classOptions.length === 0}
                  className="text-sm text-blue-600 hover:text-blue-700 disabled:text-slate-400"
                >
                  {allClassesSelected ? '清空' : '全选'}
                </button>
              </div>
              <div className="max-h-40 overflow-auto rounded-lg border px-3 py-2">
                {initialData.classOptions.length === 0 ? (
                  <div className="py-3 text-sm text-slate-500">暂无班级</div>
                ) : (
                  <div className="space-y-2">
                    {initialData.classOptions.map((item) => (
                      <label key={item} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={classNames.includes(item)}
                          onChange={(event) => handleClassToggle(item, event.target.checked)}
                        />
                        <span>{item === UNASSIGNED_CLASS_FILTER ? '未分班' : item}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-400">已选 {classNames.length} 个班级</div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">客观题试卷</label>
              <select
                value={paperId}
                onChange={(event) => setPaperId(event.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              >
                {initialData.papers.map((paper) => (
                  <option key={paper.id} value={paper.id}>
                    {paper.title}（{paper._count.questions}题）
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">程序题</div>
            <div className="max-h-72 space-y-3 overflow-auto rounded-lg border p-3">
              {initialData.challengeOptions.map((chapter) => (
                <div key={chapter.key}>
                  <div className="mb-2 text-sm font-semibold text-slate-800">{chapter.title}</div>
                  <div className="space-y-2">
                    {chapter.levels.map((level) => {
                      const key = `${chapter.key}:${level.key}`
                      return (
                        <label key={key} className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedPrograms[key])}
                              onChange={(event) =>
                                setSelectedPrograms((current) => ({
                                  ...current,
                                  [key]: event.target.checked,
                                }))
                              }
                            />
                            {level.title}
                          </span>
                          <span className="text-xs text-slate-400">{level.points} 分</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? '创建中...' : '创建训练任务'}
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">训练任务</h2>
          <span className="text-sm text-slate-500">{initialData.trainingSets.length} 个</span>
        </div>
        <div className="mt-5 space-y-4">
          {initialData.trainingSets.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center text-sm text-slate-500">
              暂无训练任务
            </div>
          ) : (
            initialData.trainingSets.map((trainingSet) => (
              <div key={trainingSet.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/teacher/training/${trainingSet.id}`}
                        className="text-lg font-semibold text-slate-900 hover:text-blue-600"
                      >
                        {trainingSet.title}
                      </Link>
                      <span className={`rounded-full px-2 py-1 text-xs ${getStatusClassName(trainingSet.status)}`}>
                        {getStatusLabel(trainingSet.status)}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      班级：{trainingSet.className === UNASSIGNED_CLASS_FILTER ? '未分班' : trainingSet.className}
                      {' / '}
                      客观题 {trainingSet._count.objectiveQuestions} 道
                      {' / '}
                      程序题 {trainingSet._count.programQuestions} 道
                      {' / '}
                      练习 {trainingSet._count.attempts} 次
                    </div>
                    {trainingSet.publishedAt && (
                      <div className="mt-1 text-xs text-slate-400">
                        发布时间：{formatAppDateTime(trainingSet.publishedAt)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {trainingSet.status !== TRAINING_SET_STATUSES.PUBLISHED && (
                      <button
                        type="button"
                        onClick={() => handleAction(trainingSet, 'PUBLISH')}
                        disabled={actionId === trainingSet.id}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        发布
                      </button>
                    )}
                    {trainingSet.status === TRAINING_SET_STATUSES.PUBLISHED && (
                      <button
                        type="button"
                        onClick={() => handleAction(trainingSet, 'ARCHIVE')}
                        disabled={actionId === trainingSet.id}
                        className="rounded-lg bg-slate-600 px-3 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
                      >
                        下架
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(trainingSet)}
                      disabled={deletingId === trainingSet.id}
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === trainingSet.id ? '删除中...' : '删除'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
