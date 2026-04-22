'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

export default function Navbar() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  if (searchParams.get('embedded') === 'godot') {
    return null
  }

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    router.push('/login')
    router.refresh()
  }

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
                  <Link href="/teacher/challenges" className="hover:text-gray-300">代码闯关</Link>
                  <Link href="/teacher/pets" className="hover:text-gray-300">班级宠物</Link>
                  <Link href="/teacher/questions" className="hover:text-gray-300">试题管理</Link>
                  <Link href="/teacher/students" className="hover:text-gray-300">学生管理</Link>
                  <Link href="/teacher/submissions" className="hover:text-gray-300">批阅作业</Link>
                </>
              ) : (
                <>
                  <Link href="/student" className="hover:text-gray-300">我的作业</Link>
                  <Link href="/student/challenges" className="hover:text-gray-300">代码闯关</Link>
                  <Link href="/student/practice" className="hover:text-gray-300">答题练习</Link>
                  <Link href="/student/pets" className="hover:text-gray-300">班级宠物</Link>
                  <Link href="/student/profile" className="hover:text-gray-300">个人中心</Link>
                </>
              )}
              <button
                onClick={handleSignOut}
                className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
              >
                退出
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-gray-300">登录</Link>
              {/* <Link href="/register" className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm">
                注册
              </Link> */}
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
