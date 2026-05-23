'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EXAM_STATUSES, UNASSIGNED_CLASS_FILTER } from '@/lib/constants'
import { formatAppDateTime } from '@/lib/date-format'

interface Paper {
  id: string
  title: string
  _count: {
    questions: number
  }
}

interface Exam {
  id: string
  title: string
  className: string
  status: string
  startsAt: string
  endsAt: string
  scoresPublished: boolean
  _count: {
    objectiveQuestions: number
    programQuestions: number
    studentSessions: number
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
    exams: Exam[]
    classOptions: string[]
    challengeOptions: ChallengeOption[]
  }
}

function toLocalInputValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function getStatusLabel(status: string) {
  if (status === EXAM_STATUSES.DRAFT) {
    return '未开始'
  }
  if (status === EXAM_STATUSES.ACTIVE) {
    return '进行中'
  }
  return '已结束'
}

export default function ExamManager({ initialData }: Props) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [className, setClassName] = useState(initialData.classOptions[0] || '')
  const [paperId, setPaperId] = useState(initialData.papers[0]?.id || '')
  const [startsAt, setStartsAt] = useState(toLocalInputValue(new Date()))
  const [endsAt, setEndsAt] = useState(toLocalInputValue(new Date(Date.now() + 90 * 60 * 1000)))
  const [selectedPrograms, setSelectedPrograms] = useState<Record<string, boolean>>({})

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
      alert('请填写考试名称')
      return
    }
    if (!className || !paperId) {
      alert('请选择班级和客观题试卷')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          className,
          paperId,
          startsAt,
          endsAt,
          programQuestions: selectedProgramRows.map((item) => ({
            chapterKey: item.chapterKey,
            levelKey: item.levelKey,
            score: item.score,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || '创建考试失败')
        return
      }

      router.push(`/teacher/exams/${data.id}`)
      router.refresh()
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (exam: Exam) => {
    if (!window.confirm(`确认删除考试“${exam.title}”吗？仅未产生考试记录的考试可删除。`)) {
      return
    }

    setDeletingId(exam.id)
    try {
      const res = await fetch(`/api/exams?id=${encodeURIComponent(exam.id)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || '删除考试失败')
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
        <h2 className="text-xl font-semibold text-slate-900">创建考试</h2>
        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">考试名称</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="例如：Python 期末考试"
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
              <label className="mb-1 block text-sm font-medium">班级</label>
              <select
                value={className}
                onChange={(event) => setClassName(event.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              >
                {initialData.classOptions.map((item) => (
                  <option key={item} value={item}>
                    {item === UNASSIGNED_CLASS_FILTER ? '未分班' : item}
                  </option>
                ))}
              </select>
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
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">开始时间</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">结束时间</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium">程序题</label>
              <span className="text-xs text-slate-500">已选 {selectedProgramRows.length} 题</span>
            </div>
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border p-3">
              {initialData.challengeOptions.map((chapter) => (
                <div key={chapter.key}>
                  <div className="text-sm font-semibold text-slate-800">{chapter.title}</div>
                  <div className="mt-2 space-y-1">
                    {chapter.levels.map((level) => {
                      const key = `${chapter.key}:${level.key}`
                      return (
                        <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
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
                          <span>{level.title}</span>
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
            onClick={() => void handleCreate()}
            disabled={creating}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? '创建中...' : '创建考试'}
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-900">考试列表</h2>
        <div className="mt-5 space-y-3">
          {initialData.exams.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-12 text-center text-sm text-slate-500">
              暂无考试
            </div>
          ) : (
            initialData.exams.map((exam) => (
              <div key={exam.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{exam.title}</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {getStatusLabel(exam.status)}
                      </span>
                      {exam.scoresPublished && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                          成绩已发布
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      班级：{exam.className === UNASSIGNED_CLASS_FILTER ? '未分班' : exam.className}
                      {' / '}
                      客观题 {exam._count.objectiveQuestions} 题，程序题 {exam._count.programQuestions} 题
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {formatAppDateTime(exam.startsAt)} 至 {formatAppDateTime(exam.endsAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/teacher/exams/${exam.id}`}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                    >
                      查看
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDelete(exam)}
                      disabled={deletingId === exam.id}
                      className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      {deletingId === exam.id ? '删除中...' : '删除'}
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
