'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn('credentials', {
      username,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('用户名或密码错误')
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-8 text-center">登录</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow">
        {error && (
          <div className="bg-red-100 text-red-600 p-3 rounded mb-4">{error}</div>
        )}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">用户名</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '登录中...' : '登录'}
        </button>
        <p className="mt-4 text-center text-sm text-gray-600">
          没有账号？{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            注册
          </Link>
        </p>
        <div className="mt-6 p-4 bg-gray-50 rounded text-sm text-gray-600">
          <p className="font-medium mb-2">测试账号：</p>
          <p>教师: teacher / 123456</p>
          <p>学生: student1 / 123456</p>
        </div>
      </form>
    </div>
  )
}
