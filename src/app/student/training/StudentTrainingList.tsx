'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TRAINING_ATTEMPT_STATUSES } from '@/lib/constants'
import { formatAppDateTime } from '@/lib/date-format'

interface TrainingSetSummary {
  id: string
  title: string
  description: string | null
  publishedAt: string | null
  objectiveQuestionCount: number
  programQuestionCount: number
  attemptCount: number
  bestScore: number
  latestAttempt: {
    id: string
    status: string
    totalScore: number
    createdAt: string
    completedAt: string | null
  } | null
}

interface Props {
  trainingSets: TrainingSetSummary[]
}

export default function StudentTrainingList({ trainingSets }: Props) {
  const router = useRouter()
  const [startingId, setStartingId] = useState('')

  const startTraining = async (trainingSet: TrainingSetSummary) => {
    setStartingId(trainingSet.id)
    try {
      const res = await fetch(`/api/student-training/${trainingSet.id}/attempts`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || '开始训练失败')
        return
      }
      router.push(`/student/training/attempts/${data.id}`)
    } finally {
      setStartingId('')
    }
  }

  if (trainingSets.length === 0) {
    return (
      <div className="rounded-xl bg-white p-12 text-center text-sm text-slate-500 shadow">
        当前没有可用的训练任务。
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {trainingSets.map((trainingSet) => (
        <div key={trainingSet.id} className="rounded-xl bg-white p-6 shadow">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{trainingSet.title}</h2>
              {trainingSet.description && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                  {trainingSet.description}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  客观题 {trainingSet.objectiveQuestionCount} 道
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  程序题 {trainingSet.programQuestionCount} 道
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  已练 {trainingSet.attemptCount} 次
                </span>
                {trainingSet.attemptCount > 0 && (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                    最高分 {trainingSet.bestScore}
                  </span>
                )}
              </div>
              {trainingSet.publishedAt && (
                <div className="mt-2 text-xs text-slate-400">
                  发布时间：{formatAppDateTime(trainingSet.publishedAt)}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {trainingSet.latestAttempt?.status === TRAINING_ATTEMPT_STATUSES.IN_PROGRESS && (
                <Link
                  href={`/student/training/attempts/${trainingSet.latestAttempt.id}`}
                  className="rounded-lg border border-blue-200 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                >
                  继续上次
                </Link>
              )}
              <button
                type="button"
                onClick={() => startTraining(trainingSet)}
                disabled={startingId === trainingSet.id}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {startingId === trainingSet.id ? '进入中...' : '开始新练习'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
