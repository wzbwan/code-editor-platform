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
  const [code, setCode] = useState(
    assignment.submissions?.[0]?.code || '# 在此编写你的Python代码\n\ndef solution():\n    pass\n'
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [requirementsCollapsed, setRequirementsCollapsed] = useState(false)
  const [requirementWarning, setRequirementWarning] = useState(false)
  const submission = assignment.submissions?.[0]

  const showRequirementWarning = () => {
    setRequirementWarning(true)
    window.setTimeout(() => {
      setRequirementWarning(false)
    }, 2000)
  }

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
    <div className="w-full px-2 py-4 lg:px-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link href="/student" className="text-sm text-blue-600 hover:underline">
          返回作业列表
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">
            Python 作业
          </span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
            禁止粘贴，请手动输入代码
          </span>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-7.5rem)] grid-cols-1 gap-3 lg:grid-cols-[minmax(320px,28vw)_minmax(0,1fr)]">
        <div className="flex min-h-[320px] flex-col gap-3 lg:min-h-[calc(100vh-7.5rem)]">
          <div
            className={`overflow-hidden rounded-xl bg-white shadow transition-all ${
              requirementsCollapsed ? 'lg:flex-none' : 'lg:basis-[38%]'
            }`}
          >
            <div className="flex items-start justify-between gap-4 border-b bg-slate-900 px-5 py-4 text-white">
              <div>
                <h1 className="mt-1 text-2xl font-bold">{assignment.title}</h1>
                {requirementWarning && (
                  <div className="mt-3 inline-flex rounded-lg bg-rose-500 px-3 py-1 text-xs text-white">
                    作业要求禁止复制
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setRequirementsCollapsed((current) => !current)}
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800"
              >
                {requirementsCollapsed ? '展开要求' : '折叠要求'}
              </button>
            </div>
            {requirementsCollapsed ? (
              <div className="px-5 py-4 text-sm text-slate-600">
                作业要求已折叠，需要时可重新展开。
              </div>
            ) : (
              <div className="h-full max-h-[calc(100vh-18rem)] overflow-y-auto p-5 lg:max-h-[calc(38vh-1rem)]">
                <pre
                  onCopy={(event) => {
                    event.preventDefault()
                    showRequirementWarning()
                  }}
                  onCut={(event) => {
                    event.preventDefault()
                    showRequirementWarning()
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    showRequirementWarning()
                  }}
                  className="select-none whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-700"
                >
                  {assignment.description}
                </pre>
                {submission?.score !== null && submission?.score !== undefined && (
                  <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <h4 className="font-semibold text-emerald-800">批阅结果</h4>
                    <p className="mt-2 text-emerald-700">分数：{submission.score} 分</p>
                    {submission.feedback && (
                      <p className="mt-2 whitespace-pre-wrap text-emerald-700">
                        评语：{submission.feedback}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <LocalRunnerTerminal
            assignmentTitle={assignment.title}
            code={code}
            className="mt-0 min-h-[320px] flex-1"
            terminalClassName={
              requirementsCollapsed
                ? 'h-[320px] lg:h-[calc(100vh-13rem)] min-h-[260px]'
                : 'h-[240px] lg:h-[calc(62vh-12rem)] min-h-[220px]'
            }
          />
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow">
          <div className="flex items-center justify-between gap-3 border-b bg-slate-800 px-5 py-4 text-white">
            <div>
              <div className="text-sm text-slate-300">代码编辑区域</div>
            </div>
            <div className="text-right text-xs text-slate-400">
              <div>字符数：{code.length}</div>
            </div>
          </div>
          <div className="flex min-h-[62vh] flex-col lg:min-h-[calc(100vh-10rem)]">
            <CodeEditor code={code} onChange={setCode} className="flex-1 min-h-[62vh] lg:min-h-[calc(100vh-16rem)]" />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 px-5 py-4">
              <div className="text-sm text-slate-500">
                提交前可先在左下角查看运行结果。
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {message && (
                  <span className={message.includes('成功') ? 'text-green-600' : 'text-red-600'}>
                    {message}
                  </span>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-6 py-2.5 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? '提交中...' : '提交作业'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
