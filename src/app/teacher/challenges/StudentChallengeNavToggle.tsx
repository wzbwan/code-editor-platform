'use client'

import { useState } from 'react'

interface Props {
  initialVisible: boolean
}

export default function StudentChallengeNavToggle({ initialVisible }: Props) {
  const [visible, setVisible] = useState(initialVisible)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleToggle = async () => {
    const nextVisible = !visible
    setVisible(nextVisible)
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/app-settings/student-challenges-nav', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: nextVisible }),
      })
      const data = await res.json()

      if (!res.ok) {
        setVisible(!nextVisible)
        setError(data.error || '保存失败')
        return
      }

      setVisible(Boolean(data.visible))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">学生端导航</h2>
          <p className="mt-2 text-sm text-slate-600">
            控制学生导航栏是否显示“代码闯关”入口，不影响直接访问闯关页面。
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={visible}
          disabled={saving}
          onClick={() => void handleToggle()}
          className={`relative h-8 w-14 rounded-full transition ${
            visible ? 'bg-blue-600' : 'bg-slate-300'
          } disabled:opacity-50`}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
              visible ? 'left-7' : 'left-1'
            }`}
          />
          <span className="sr-only">
            {visible ? '隐藏学生端代码闯关导航' : '显示学生端代码闯关导航'}
          </span>
        </button>
      </div>
    </div>
  )
}
