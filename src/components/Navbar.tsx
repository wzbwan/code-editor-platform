'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'

export default function Navbar() {
  const { data: session } = useSession()

  return (
    <nav className="bg-gray-800 text-white px-6 py-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          Python代码平台
        </Link>
        <div className="flex items-center gap-4">
          {session ? (
            <>
              <span className="text-sm">
                {session.user?.name} ({session.user?.role === 'TEACHER' ? '教师' : '学生'})
              </span>
              {session.user?.role === 'TEACHER' ? (
                <>
                  <Link href="/teacher" className="hover:text-gray-300">作业管理</Link>
                  <Link href="/teacher/students" className="hover:text-gray-300">学生管理</Link>
                  <Link href="/teacher/submissions" className="hover:text-gray-300">批阅作业</Link>
                </>
              ) : (
                <Link href="/student" className="hover:text-gray-300">我的作业</Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
              >
                退出
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-gray-300">登录</Link>
              <Link href="/register" className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm">
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
