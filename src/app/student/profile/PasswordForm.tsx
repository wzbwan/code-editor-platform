'use client'

import { useState } from 'react'

export default function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致')
      setMessage('')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const res = await fetch('/api/account/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '修改密码失败')
        return
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('密码修改成功')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">当前密码</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          className="w-full rounded-lg border px-3 py-2"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">新密码</label>
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="w-full rounded-lg border px-3 py-2"
          minLength={6}
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">确认新密码</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="w-full rounded-lg border px-3 py-2"
          minLength={6}
          required
        />
      </div>
      {(error || message) && (
        <p className={`text-sm ${error ? 'text-red-600' : 'text-green-600'}`}>
          {error || message}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? '保存中...' : '修改密码'}
      </button>
    </form>
  )
}
