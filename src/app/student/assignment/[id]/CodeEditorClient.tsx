'use client'

import { useState } from 'react'
import CodeEditor from '@/components/CodeEditor'
import LocalRunnerTerminal from '@/components/LocalRunnerTerminal'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Assignment {
  id: string
  title: string
  description: string
  submissions: { id: string; code: string; score: number | null; feedback: string | null }[]
}

interface Props {
  assignment: Assignment
}

export default function CodeEditorClient({ assignment }: Props) {
  const router = useRouter()
  const [code, setCode] = useState(assignment.submissions?.[0]?.code || '# 在此编写你的Python代码\n\ndef solution():\n    pass\n')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const submission = assignment.submissions?.[0]

  const handleSubmit = async () => {
    if (!code.trim()) {
      setMessage('代码不能为空')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: assignment.id,
          code,
        }),
      })

      if (res.ok) {
        setMessage('提交成功！')
        router.refresh()
      } else {
        setMessage('提交失败，请重试')
      }
    } catch {
      setMessage('提交失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/student" className="text-blue-600 hover:underline">
          返回作业列表
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-lg shadow">
            <h1 className="text-xl font-bold mb-4">{assignment.title}</h1>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-gray-700 text-sm bg-gray-50 p-4 rounded">
                {assignment.description}
              </pre>
            </div>
            {submission?.score !== null && submission?.score !== undefined && (
              <div className="mt-6 p-4 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-800">批阅结果</h4>
                <p className="text-green-700">分数: {submission.score} 分</p>
                {submission.feedback && (
                  <p className="text-green-700 mt-2">评语: {submission.feedback}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center">
              <span className="text-sm">Python 编辑器</span>
              <span className="text-xs text-gray-400">禁止粘贴，请手动输入代码</span>
            </div>
            <CodeEditor
              code={code}
              onChange={setCode}
              className="min-h-[500px]"
            />
            <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
              <div className="text-sm text-gray-500">
                字符数: {code.length}
              </div>
              <div className="flex gap-3">
                {message && (
                  <span className={message.includes('成功') ? 'text-green-600' : 'text-red-600'}>
                    {message}
                  </span>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? '提交中...' : '提交作业'}
                </button>
              </div>
            </div>
          </div>

          <LocalRunnerTerminal assignmentTitle={assignment.title} code={code} />
        </div>
      </div>
    </div>
  )
}
