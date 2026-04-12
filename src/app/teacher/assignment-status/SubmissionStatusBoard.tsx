'use client'

import { useEffect, useState } from 'react'
import CodeEditor from '@/components/CodeEditor'
import { formatAppDate, formatAppDateTime } from '@/lib/date-format'
import { formatOneDecimal, formatSignedOneDecimal } from '@/lib/point-format'

const UNASSIGNED_CLASS_FILTER = '__UNASSIGNED__'

interface AssignmentOption {
  id: string
  title: string
}

interface StatusItem {
  id: string
  username: string
  name: string
  className: string | null
  pointBalance: number
  submissionId: string | null
  submittedAt: string | null
  score: number | null
  feedback: string | null
}

interface StatusResponse {
  assignment: {
    id: string
    title: string
    status: string
    dueDate: string | null
  }
  classOptions: string[]
  selectedClassName: string
  summary: {
    totalStudents: number
    submittedCount: number
    pendingCount: number
  }
  items: StatusItem[]
}

interface DetailResponse {
  assignment: {
    id: string
    title: string
    description: string
    dueDate: string | null
    status: string
  }
  student: {
    id: string
    username: string
    name: string
    className: string | null
    pointBalance: number
    createdAt: string
  }
  submission: {
    id: string
    code: string
    score: number | null
    feedback: string | null
    submittedAt: string
    reviewedAt: string | null
  } | null
  recentPointRecords: Array<{
    id: string
    delta: number
    reason: string
    occurredAt: string
    operatorLabel: string | null
    source: string
    operator: {
      name: string
      username: string
    } | null
  }>
}

interface Props {
  assignments: AssignmentOption[]
  initialSelectedAssignmentId: string
  initialStatusData: StatusResponse | null
}

export default function SubmissionStatusBoard({
  assignments,
  initialSelectedAssignmentId,
  initialStatusData,
}: Props) {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(
    initialSelectedAssignmentId
  )
  const [selectedClassName, setSelectedClassName] = useState(
    initialStatusData?.selectedClassName || ''
  )
  const [statusData, setStatusData] = useState<StatusResponse | null>(initialStatusData)
  const [loading, setLoading] = useState(false)
  const [detailStudent, setDetailStudent] = useState<StatusItem | null>(null)
  const [detail, setDetail] = useState<DetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadStatus = async (assignmentId: string, className: string) => {
    if (!assignmentId) {
      setStatusData(null)
      return
    }

    setLoading(true)

    try {
      const params = new URLSearchParams({ assignmentId })
      if (className) {
        params.set('className', className)
      }

      const res = await fetch(`/api/assignment-status?${params.toString()}`)
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '加载提交状态失败')
        return
      }

      setStatusData(data)
    } finally {
      setLoading(false)
    }
  }

  const handleAssignmentChange = async (assignmentId: string) => {
    setSelectedAssignmentId(assignmentId)
    setSelectedClassName('')
    setDetailStudent(null)
    setDetail(null)

    await loadStatus(assignmentId, '')
  }

  const handleClassChange = async (className: string) => {
    setSelectedClassName(className)
    setDetailStudent(null)
    setDetail(null)

    await loadStatus(selectedAssignmentId, className)
  }

  const handleRefresh = async () => {
    await loadStatus(selectedAssignmentId, selectedClassName)
  }

  const handleOpenDetail = async (student: StatusItem) => {
    setDetailStudent(student)
    setDetail(null)
    setDetailLoading(true)

    try {
      const params = new URLSearchParams({
        assignmentId: selectedAssignmentId,
        studentId: student.id,
      })

      const res = await fetch(`/api/assignment-status/detail?${params.toString()}`)
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '加载详情失败')
        setDetailStudent(null)
        return
      }

      setDetail(data)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    setSelectedClassName(initialStatusData?.selectedClassName || '')
  }, [initialStatusData])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-4 shadow">
        <select
          value={selectedAssignmentId}
          onChange={(event) => handleAssignmentChange(event.target.value)}
          className="rounded-lg border px-4 py-2"
        >
          <option value="">选择作业</option>
          {assignments.map((assignment) => (
            <option key={assignment.id} value={assignment.id}>
              {assignment.title}
            </option>
          ))}
        </select>

        <select
          value={selectedClassName}
          onChange={(event) => handleClassChange(event.target.value)}
          className="rounded-lg border px-4 py-2"
          disabled={!selectedAssignmentId}
        >
          <option value="">全部班级</option>
          {statusData?.classOptions.map((className) => (
            <option key={className} value={className}>
              {className === UNASSIGNED_CLASS_FILTER ? '未分班' : className}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={!selectedAssignmentId || loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '刷新中...' : '刷新状态'}
        </button>

        {statusData && (
          <div className="ml-auto flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              总人数 {statusData.summary.totalStudents}
            </span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
              已提交 {statusData.summary.submittedCount}
            </span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
              未提交 {statusData.summary.pendingCount}
            </span>
          </div>
        )}
      </div>

      {!selectedAssignmentId ? (
        <div className="rounded-lg bg-white px-6 py-12 text-center text-gray-500 shadow">
          请选择一个作业查看提交状态
        </div>
      ) : !statusData ? (
        <div className="rounded-lg bg-white px-6 py-12 text-center text-gray-500 shadow">
          暂无状态数据
        </div>
      ) : statusData.items.length === 0 ? (
        <div className="rounded-lg bg-white px-6 py-12 text-center text-gray-500 shadow">
          当前班级下暂无学生
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {statusData.items.map((student, index) => {
            const isSubmitted = Boolean(student.submittedAt)

            return (
              <button
                key={student.id}
                type="button"
                onClick={() => handleOpenDetail(student)}
                className={`rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  isSubmitted
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">
                      {student.name}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{student.username}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        isSubmitted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isSubmitted ? '已提交' : '未提交'}
                    </span>
                    {isSubmitted && (
                      <span className="text-xs text-emerald-700">第 {index + 1} 位提交</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                  <div>班级：{student.className || '未分班'}</div>
                  <div>
                    提交时间：
                    {student.submittedAt
                      ? formatAppDateTime(student.submittedAt)
                      : '未提交'}
                  </div>
                  <div>
                    评分：
                    {student.score !== null ? `${student.score} 分` : '未评分'}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {detailStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {detailStudent.name} 的提交详情
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {detailStudent.username}
                  {detailStudent.className ? ` · ${detailStudent.className}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailStudent(null)
                  setDetail(null)
                }}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
              >
                关闭
              </button>
            </div>

            {detailLoading || !detail ? (
              <div className="px-6 py-16 text-center text-slate-500">加载详情中...</div>
            ) : (
              <div className="grid gap-6 p-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-1">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="mb-3 text-lg font-semibold text-slate-900">学生信息</h3>
                    <div className="space-y-2 text-sm text-slate-700">
                      <p>姓名：{detail.student.name}</p>
                      <p>学号：{detail.student.username}</p>
                      <p>班级：{detail.student.className || '未分班'}</p>
                      <p>当前积分：{formatOneDecimal(detail.student.pointBalance)}</p>
                      <p>
                        注册时间：{formatAppDate(detail.student.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="mb-3 text-lg font-semibold text-slate-900">提交情况</h3>
                    {detail.submission ? (
                      <div className="space-y-2 text-sm text-slate-700">
                        <p>
                          提交时间：
                          {formatAppDateTime(detail.submission.submittedAt)}
                        </p>
                        <p>
                          评分：
                          {detail.submission.score !== null
                            ? `${detail.submission.score} 分`
                            : '未评分'}
                        </p>
                        <p>评语：{detail.submission.feedback || '暂无评语'}</p>
                        <p>
                          批阅时间：
                          {detail.submission.reviewedAt
                            ? formatAppDateTime(detail.submission.reviewedAt)
                            : '未批阅'}
                        </p>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">该学生尚未提交本次作业</div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="mb-3 text-lg font-semibold text-slate-900">最近积分记录</h3>
                    {detail.recentPointRecords.length === 0 ? (
                      <div className="text-sm text-slate-500">暂无积分记录</div>
                    ) : (
                      <div className="space-y-3">
                        {detail.recentPointRecords.map((record) => (
                          <div
                            key={record.id}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-slate-900">
                                  {record.reason}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {formatAppDateTime(record.occurredAt)}
                                </div>
                              </div>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  record.delta > 0
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {formatSignedOneDecimal(record.delta)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6 lg:col-span-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <h3 className="mb-3 text-lg font-semibold text-slate-900">
                      作业信息
                    </h3>
                    <div className="space-y-2 text-sm text-slate-700">
                      <p>标题：{detail.assignment.title}</p>
                      <p>
                        状态：
                        {detail.assignment.status === 'ACTIVE' ? '启用中' : '已停用'}
                      </p>
                      <p>
                        截止时间：
                        {detail.assignment.dueDate
                          ? formatAppDateTime(detail.assignment.dueDate)
                          : '未设置'}
                      </p>
                    </div>
                    <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                      {detail.assignment.description}
                    </pre>
                  </div>

                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
                      <h3 className="text-lg font-semibold text-slate-900">作业内容</h3>
                      <span className="text-sm text-slate-500">
                        {detail.submission ? '学生提交代码' : '暂无提交'}
                      </span>
                    </div>
                    {detail.submission ? (
                      <CodeEditor
                        code={detail.submission.code}
                        onChange={() => {}}
                        readOnly
                        className="min-h-[420px]"
                      />
                    ) : (
                      <div className="px-6 py-16 text-center text-slate-500">
                        该学生尚未提交代码
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
