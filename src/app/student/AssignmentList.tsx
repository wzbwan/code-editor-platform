'use client'

import Link from 'next/link'
import { formatAppDate } from '@/lib/date-format'

interface Assignment {
  id: string
  title: string
  description: string
  dueDate: string | null
  createdAt: string
  _count: { submissions: number }
  submissions: { id: string; score: number | null; feedback: string | null }[]
}

interface Props {
  assignments: Assignment[]
}

export default function AssignmentList({ assignments }: Props) {
  if (assignments.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">
        暂无作业
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {assignments.map((assignment) => {
        const submission = assignment.submissions?.[0]
        const isSubmitted = !!submission
        const isReviewed = submission?.score !== null && submission?.score !== undefined

        return (
          <div
            key={assignment.id}
            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{assignment.title}</h3>
                <p className="text-gray-600 mt-2 line-clamp-2">{assignment.description}</p>
                <div className="flex gap-4 mt-3 text-sm text-gray-500">
                  <span>创建时间: {formatAppDate(assignment.createdAt)}</span>
                  {assignment.dueDate && (
                    <span>截止日期: {formatAppDate(assignment.dueDate)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isReviewed ? (
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                    已批阅: {submission.score}分
                  </span>
                ) : isSubmitted ? (
                  <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm">
                    已提交
                  </span>
                ) : (
                  <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                    未提交
                  </span>
                )}
                <Link
                  href={`/student/assignment/${assignment.id}`}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                >
                  {isSubmitted ? '查看/修改' : '开始作答'}
                </Link>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
