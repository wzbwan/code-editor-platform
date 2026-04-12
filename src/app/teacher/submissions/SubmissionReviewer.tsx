'use client'

import { useState } from 'react'
import CodeEditor from '@/components/CodeEditor'
import { formatAppDateTime } from '@/lib/date-format'

interface Submission {
  id: string
  code: string
  score: number | null
  feedback: string | null
  submittedAt: string
  reviewedAt: string | null
  student: { id: string; name: string; username: string; className: string | null }
  assignment: { id: string; title: string }
}

interface Assignment {
  id: string
  title: string
}

interface Props {
  submissions: Submission[]
  assignments: Assignment[]
  selectedAssignmentId: string
}

export default function SubmissionReviewer({ 
  submissions: initialSubmissions, 
  assignments, 
  selectedAssignmentId 
}: Props) {
  const [submissions, setSubmissions] = useState(initialSubmissions)
  const [selectedId, setSelectedAssignmentId] = useState(selectedAssignmentId)
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(
    initialSubmissions[0] || null
  )
  const [score, setScore] = useState('')
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)
  const [batchImporting, setBatchImporting] = useState(false)
  const [batchResult, setBatchResult] = useState<{
    updatedCount: number
    skippedCount: number
    skippedRows: Array<{ rowNumber: number; username: string; reason: string }>
  } | null>(null)

  const applySelectedSubmission = (submission: Submission | null) => {
    setSelectedSubmission(submission)
    setScore(submission?.score?.toString() || '')
    setFeedback(submission?.feedback || '')
  }

  const loadSubmissions = async (assignmentId: string, preferredSubmissionId?: string) => {
    const res = await fetch(`/api/submissions?assignmentId=${assignmentId}`)
    const data = await res.json()

    if (!res.ok) {
      alert(data.error || '加载提交失败')
      return
    }

    setSubmissions(data)

    if (data.length === 0) {
      applySelectedSubmission(null)
      return
    }

    const nextSubmission =
      data.find((item: Submission) => item.id === preferredSubmissionId) || data[0]
    applySelectedSubmission(nextSubmission)
  }

  const handleAssignmentChange = async (assignmentId: string) => {
    setSelectedAssignmentId(assignmentId)
    setBatchResult(null)
    
    if (!assignmentId) {
      setSubmissions([])
      applySelectedSubmission(null)
      return
    }

    await loadSubmissions(assignmentId)
  }

  const handleSelectSubmission = (submission: Submission) => {
    applySelectedSubmission(submission)
  }

  const handleReview = async () => {
    if (!selectedSubmission) return
    setLoading(true)

    try {
      const res = await fetch('/api/submissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedSubmission.id,
          score: score ? parseInt(score) : null,
          feedback,
        }),
      })

      if (res.ok) {
        const updated = await res.json()
        setSubmissions(submissions.map(s => 
          s.id === updated.id ? { ...s, ...updated } : s
        ))
        applySelectedSubmission({ ...selectedSubmission, ...updated })
        alert('批阅成功！')
      } else {
        const error = await res.json()
        alert(error.error || '批阅失败')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleBatchDownload = () => {
    if (!selectedId) {
      return
    }

    window.location.href = `/api/submissions/export?assignmentId=${selectedId}`
  }

  const handleBatchReviewImport = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file || !selectedId) {
      return
    }

    setBatchImporting(true)
    setBatchResult(null)

    try {
      const formData = new FormData()
      formData.append('assignmentId', selectedId)
      formData.append('file', file)

      const res = await fetch('/api/submissions/review-import', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '批量批阅失败')
        return
      }

      setBatchResult({
        updatedCount: data.updatedCount,
        skippedCount: data.skippedCount,
        skippedRows: data.skippedRows,
      })
      await loadSubmissions(selectedId, selectedSubmission?.id)
    } finally {
      setBatchImporting(false)
      event.target.value = ''
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={selectedId}
          onChange={(e) => handleAssignmentChange(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">选择作业</option>
          {assignments.map((a) => (
            <option key={a.id} value={a.id}>{a.title}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleBatchDownload}
          disabled={!selectedId}
          className="rounded-lg bg-slate-700 px-4 py-2 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          批量下载压缩包
        </button>
        <label
          className={`rounded-lg px-4 py-2 text-white ${
            selectedId && !batchImporting
              ? 'cursor-pointer bg-emerald-600 hover:bg-emerald-700'
              : 'cursor-not-allowed bg-emerald-300'
          }`}
        >
          {batchImporting ? '批量批阅中...' : '上传 Excel 批量批阅'}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleBatchReviewImport}
            disabled={!selectedId || batchImporting}
          />
        </label>
        <span className="text-sm text-gray-500">
          下载包含代码、作业要求和提交信息 Excel；批量批阅 Excel 需包含用户名、姓名、分数、评语
        </span>
      </div>

      {batchResult && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-green-700">成功批阅 {batchResult.updatedCount} 条</span>
            <span className="text-amber-700">跳过 {batchResult.skippedCount} 条</span>
          </div>
          {batchResult.skippedRows.length > 0 && (
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              {batchResult.skippedRows.slice(0, 10).map((row) => (
                <p key={`${row.rowNumber}-${row.username}`}>
                  第 {row.rowNumber} 行
                  {row.username ? `（${row.username}）` : ''}
                  ：{row.reason}
                </p>
              ))}
              {batchResult.skippedRows.length > 10 && (
                <p>其余 {batchResult.skippedRows.length - 10} 条跳过记录未展开显示。</p>
              )}
            </div>
          )}
        </div>
      )}

      {!selectedId ? (
        <div className="text-center text-gray-500 py-12">请选择一个作业查看提交</div>
      ) : submissions.length === 0 ? (
        <div className="text-center text-gray-500 py-12">该作业暂无提交</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 font-medium">提交列表</div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  onClick={() => handleSelectSubmission(submission)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${
                    selectedSubmission?.id === submission.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="font-medium">{submission.student.name}</div>
                  <div className="text-sm text-gray-500">
                    {submission.student.username}
                    {submission.student.className
                      ? ` · ${submission.student.className}`
                      : ''}
                  </div>
                  <div className="flex justify-between items-center mt-2 text-sm">
                    <span className="text-gray-400">
                      {formatAppDateTime(submission.submittedAt)}
                    </span>
                    {submission.score !== null ? (
                      <span className="text-green-600 font-medium">{submission.score}分</span>
                    ) : (
                      <span className="text-yellow-600">待批阅</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedSubmission && (
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow">
                <div className="bg-gray-50 px-4 py-3 font-medium flex justify-between">
                  <span>
                    代码 - {selectedSubmission.student.name}
                    {selectedSubmission.student.className
                      ? `（${selectedSubmission.student.className}）`
                      : ''}
                  </span>
                  <span className="text-sm text-gray-500">
                    提交时间: {formatAppDateTime(selectedSubmission.submittedAt)}
                  </span>
                </div>
                <CodeEditor
                  code={selectedSubmission.code}
                  onChange={() => {}}
                  readOnly
                  className="min-h-[400px]"
                />
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-medium mb-4">批阅</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">分数 (0-100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={score}
                      onChange={(e) => setScore(e.target.value)}
                      className="w-32 px-3 py-2 border rounded-lg"
                      placeholder="0-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">评语</label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg h-24"
                      placeholder="输入评语..."
                    />
                  </div>
                  <button
                    onClick={handleReview}
                    disabled={loading}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading ? '保存中...' : '保存批阅'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
