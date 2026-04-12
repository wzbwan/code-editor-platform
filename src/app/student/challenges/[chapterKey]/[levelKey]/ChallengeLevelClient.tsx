'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import CodeEditor from '@/components/CodeEditor'
import LocalRunnerTerminal from '@/components/LocalRunnerTerminal'
import { formatAppDateTime } from '@/lib/date-format'
import { ChallengeJudgeConfig } from '@/lib/challenges/types'
import { judgeChallengeWithLocalRunner } from '@/lib/challenges/client-judge'

interface SimpleLevelLink {
  key: string
  title: string
}

interface Props {
  chapterKey: string
  chapterTitle: string
  level: {
    key: string
    title: string
    summary: string
    description: string
    points: number
    isAccessible: boolean
    isPassed: boolean
    attemptCount: number
    awardedPoints: number
    initialCode: string
    judge: ChallengeJudgeConfig
    latestCode: string | null
    latestJudgeMessage: string | null
    latestStdout: string | null
    latestStderr: string | null
    latestSubmittedAt: string | null
  }
  previousLevel: SimpleLevelLink | null
  nextLevel: SimpleLevelLink | null
}

export default function ChallengeLevelClient({
  chapterKey,
  chapterTitle,
  level,
  previousLevel,
  nextLevel,
}: Props) {
  const router = useRouter()
  const [code, setCode] = useState(level.latestCode || level.initialCode)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(level.latestJudgeMessage || '')
  const [stdout, setStdout] = useState(level.latestStdout || '')
  const [stderr, setStderr] = useState(level.latestStderr || '')

  const handleSubmit = async () => {
    if (!code.trim()) {
      setMessage('代码不能为空')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const localJudgeResult = await judgeChallengeWithLocalRunner({
        code,
        chapterTitle,
        levelTitle: level.title,
        judge: level.judge,
      })

      const res = await fetch('/api/challenges/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chapterKey,
          levelKey: level.key,
          code,
          judgeResult: localJudgeResult,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || '提交失败')
        return
      }

      setMessage(
        data.isFirstPass && data.pointsAwarded > 0
          ? `${data.message} 首次通关 +${data.pointsAwarded} 积分。`
          : data.message
      )
      setStdout(data.stdout || '')
      setStderr(data.stderr || '')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '提交失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full px-2 py-4 lg:px-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link href={`/student/challenges/${chapterKey}`} className="text-sm text-blue-600 hover:underline">
          返回章节
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">{chapterTitle}</span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
            通关积分 {level.points}
          </span>
          {level.isPassed && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
              已通关
            </span>
          )}
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-7.5rem)] grid-cols-1 gap-3 lg:grid-cols-[minmax(320px,30vw)_minmax(0,1fr)]">
        <div className="flex min-h-[320px] flex-col gap-3 lg:min-h-[calc(100vh-7.5rem)]">
          <div className="overflow-hidden rounded-xl bg-white shadow">
            <div className="border-b bg-slate-900 px-5 py-4 text-white">
              <div className="text-sm text-slate-300">代码闯关</div>
              <h1 className="mt-1 text-2xl font-bold">{level.title}</h1>
            </div>
            <div className="space-y-5 p-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">任务说明</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {level.description}
                </p>
              </div>

              <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                <div>已尝试：{level.attemptCount} 次</div>
                <div>已获得积分：{level.awardedPoints}</div>
                {level.latestSubmittedAt && (
                  <div>最近提交：{formatAppDateTime(level.latestSubmittedAt)}</div>
                )}
              </div>

              {(message || stdout || stderr) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">判题结果</h3>
                  {message && (
                    <p className={`mt-2 text-sm ${message.includes('恭喜') ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {message}
                    </p>
                  )}
                  {stdout && (
                    <div className="mt-3">
                      <div className="text-xs font-medium text-slate-500">标准输出</div>
                      <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-700 ring-1 ring-slate-200">
                        {stdout}
                      </pre>
                    </div>
                  )}
                  {stderr && (
                    <div className="mt-3">
                      <div className="text-xs font-medium text-slate-500">错误输出</div>
                      <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-rose-200">
                        {stderr}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                {previousLevel ? (
                  <Link
                    href={`/student/challenges/${chapterKey}/${previousLevel.key}`}
                    className="text-sm text-slate-600 hover:text-slate-900"
                  >
                    上一关：{previousLevel.title}
                  </Link>
                ) : (
                  <span className="text-sm text-slate-400">已经是第一关</span>
                )}

                {nextLevel ? (
                  <Link
                    href={`/student/challenges/${chapterKey}/${nextLevel.key}`}
                    className="text-sm text-slate-600 hover:text-slate-900"
                  >
                    下一关：{nextLevel.title}
                  </Link>
                ) : (
                  <span className="text-sm text-slate-400">已经是最后一关</span>
                )}
              </div>
            </div>
          </div>

          <LocalRunnerTerminal
            assignmentTitle={`${chapterTitle} - ${level.title}`}
            code={code}
            className="mt-0 min-h-[320px] flex-1"
            terminalClassName="h-[280px] min-h-[220px] lg:h-[calc(100vh-27rem)]"
          />
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow">
          <div className="flex items-center justify-between gap-3 border-b bg-slate-800 px-5 py-4 text-white">
            <div>
              <div className="text-sm text-slate-300">代码编辑区域</div>
              <div className="mt-1 text-xs text-slate-400">{level.summary}</div>
            </div>
            <div className="text-right text-xs text-slate-400">字符数：{code.length}</div>
          </div>

          <div className="flex min-h-[62vh] flex-col lg:min-h-[calc(100vh-10rem)]">
            <CodeEditor
              code={code}
              onChange={setCode}
              className="min-h-[62vh] flex-1 lg:min-h-[calc(100vh-16rem)]"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 px-5 py-4">
              <div className="text-sm text-slate-500">先运行再提交，判题只按提交结果计算。</div>
              <div className="flex flex-wrap items-center gap-3">
                {message && !message.includes('恭喜') && <span className="text-sm text-rose-600">{message}</span>}
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-6 py-2.5 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? '提交中...' : '提交判题'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
