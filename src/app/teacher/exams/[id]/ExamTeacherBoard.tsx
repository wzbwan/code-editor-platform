'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { EXAM_STATUSES, UNASSIGNED_CLASS_FILTER } from '@/lib/constants'
import { formatAppDateTime } from '@/lib/date-format'

interface Props {
  examId: string
  initialData: any
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

export default function ExamTeacherBoard({ examId, initialData }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const data = initialData
  const exam = data.exam
  const totalScore = data.totalObjectiveScore + data.totalProgramScore

  const handleAction = async (action: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const result = await res.json()
      if (!res.ok) {
        alert(result.error || '操作失败')
        return
      }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/teacher/exams" className="text-sm text-blue-600 hover:underline">
              返回考试列表
            </Link>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">{exam.title}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {getStatusLabel(exam.status)} / 班级：
              {exam.className === UNASSIGNED_CLASS_FILTER ? '未分班' : exam.className} / 总分 {totalScore}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {formatAppDateTime(exam.startsAt)} 至 {formatAppDateTime(exam.endsAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {exam.status === EXAM_STATUSES.DRAFT && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleAction('START')}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                开始考试
              </button>
            )}
            {exam.status === EXAM_STATUSES.ACTIVE && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleAction('END')}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 disabled:opacity-50"
              >
                结束考试
              </button>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleAction(exam.scoresPublished ? 'UNPUBLISH' : 'PUBLISH')}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {exam.scoresPublished ? '取消发布成绩' : '发布成绩'}
            </button>
            <a
              href={`/api/exams/${examId}/export`}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-900"
            >
              导出成绩 CSV
            </a>
            <a
              href={`/api/exams/${examId}/program-submissions/export`}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
            >
              导出程序源码 ZIP
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl bg-white p-6 shadow">
          <div className="text-sm text-slate-500">客观题</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {exam.objectiveQuestions.length}
          </div>
          <div className="mt-1 text-sm text-slate-500">{data.totalObjectiveScore} 分</div>
        </div>
        <div className="rounded-xl bg-white p-6 shadow">
          <div className="text-sm text-slate-500">程序题</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {exam.programQuestions.length}
          </div>
          <div className="mt-1 text-sm text-slate-500">{data.totalProgramScore} 分</div>
        </div>
        <div className="rounded-xl bg-white p-6 shadow">
          <div className="text-sm text-slate-500">已进入考试</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {exam.studentSessions.length}
          </div>
          <div className="mt-1 text-sm text-slate-500">全班 {data.roster.length} 人</div>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-900">学生状态与成绩</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-3 py-2">姓名</th>
                <th className="px-3 py-2">账号</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">客观题</th>
                <th className="px-3 py-2">程序题</th>
                <th className="px-3 py-2">总分</th>
                <th className="px-3 py-2">切屏</th>
                <th className="px-3 py-2">程序提交</th>
                <th className="px-3 py-2">交卷时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.roster.map((item: any) => (
                <tr key={item.student.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{item.student.name}</td>
                  <td className="px-3 py-2 text-slate-600">{item.student.username}</td>
                  <td className="px-3 py-2 text-slate-600">{item.session?.status || '未进入'}</td>
                  <td className="px-3 py-2 text-slate-600">{item.session?.objectiveScore ?? 0}</td>
                  <td className="px-3 py-2 text-slate-600">{item.session?.programScore ?? 0}</td>
                  <td className="px-3 py-2 font-semibold text-slate-900">{item.session?.totalScore ?? 0}</td>
                  <td className="px-3 py-2 text-slate-600">{item.focusLostCount}</td>
                  <td className="px-3 py-2 text-slate-600">{item.session?._count?.programSubmissions ?? 0}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {item.session?.submittedAt ? formatAppDateTime(item.session.submittedAt) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
