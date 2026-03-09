'use client'

import { useState } from 'react'
import CodeEditor from '@/components/CodeEditor'

interface Submission {
  id: string
  code: string
  score: number | null
  feedback: string | null
  submittedAt: string
  reviewedAt: string | null
  student: { id: string; name: string; username: string }
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

  const handleAssignmentChange = async (assignmentId: string) => {
    setSelectedAssignmentId(assignmentId)
    setSelectedSubmission(null)
    
    if (!assignmentId) {
      setSubmissions([])
      return
    }

    const res = await fetch(`/api/submissions?assignmentId=${assignmentId}`)
    const data = await res.json()
    setSubmissions(data)
    if (data.length > 0) {
      setSelectedSubmission(data[0])
      setScore(data[0].score?.toString() || '')
      setFeedback(data[0].feedback || '')
    } else {
      setSelectedSubmission(null)
    }
  }

  const handleSelectSubmission = (submission: Submission) => {
    setSelectedSubmission(submission)
    setScore(submission.score?.toString() || '')
    setFeedback(submission.feedback || '')
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
        setSelectedSubmission({ ...selectedSubmission, ...updated })
        alert('批阅成功！')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
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
      </div>

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
                  </div>
                  <div className="flex justify-between items-center mt-2 text-sm">
                    <span className="text-gray-400">
                      {new Date(submission.submittedAt).toLocaleString()}
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
                  <span>代码 - {selectedSubmission.student.name}</span>
                  <span className="text-sm text-gray-500">
                    提交时间: {new Date(selectedSubmission.submittedAt).toLocaleString()}
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
