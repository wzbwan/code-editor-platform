'use client'

import { useState } from 'react'

interface Props {
  className: string
  totalStudents: number
}

export default function ChallengePyPointGrantPanel({
  className,
  totalStudents,
}: Props) {
  const [amount, setAmount] = useState('1')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const handleGrant = async () => {
    const delta = Number.parseInt(amount.trim(), 10)
    if (!Number.isInteger(delta) || delta <= 0) {
      setMessage('Py点数量必须是正整数')
      return
    }

    if (
      !confirm(`确定给 ${className} 的 ${totalStudents} 名学生每人增加 ${delta} Py点吗？`)
    ) {
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const res = await fetch('/api/py-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          className,
          delta,
          reason: `代码闯关批量发放 ${delta} Py点`,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Py点发放失败')
        return
      }

      setMessage(`已给 ${data.count} 名学生每人增加 ${data.delta} Py点`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Py点批量发放</h2>
          <p className="mt-2 text-sm text-slate-600">
            给当前班级所有学生增加 Py点，用于 Godot 客户端求助AI额度。
          </p>
          <div className="mt-3 text-xs text-slate-500">
            当前班级：{className} / 人数：{totalStudents}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleGrant}
            disabled={saving || totalStudents === 0}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? '发放中...' : '批量增加Py点'}
          </button>
        </div>
      </div>
      {message && (
        <div
          className={`mt-4 text-sm ${
            message.startsWith('已') ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          {message}
        </div>
      )}
    </div>
  )
}
