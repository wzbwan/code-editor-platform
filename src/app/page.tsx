import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { redirect } from 'next/navigation'

export default async function Home() {
  const session = await getServerSession(authOptions)
  
  if (session) {
    redirect(session.user.role === 'TEACHER' ? '/teacher' : '/student')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <h1 className="text-4xl font-bold mb-8">信网学院Python课程实战平台</h1>
      <p className="text-gray-600 mb-8 text-lg">
        一个专为课堂教学设计的Python代码练习平台，支持在线编辑、提交作业和教师批阅功能。
      </p>
      <div className="space-x-4">
        <Link
          href="/login"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
        >
          登录
        </Link>
        {/* <Link
          href="/register"
          className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
        >
          注册
        </Link> */}
      </div>
      {/* <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold text-lg mb-2">禁止粘贴</h3>
          <p className="text-gray-600 text-sm">编辑器禁止粘贴代码，确保学生真正动手敲代码</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold text-lg mb-2">代码高亮</h3>
          <p className="text-gray-600 text-sm">支持Python语法高亮，提升编码体验</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold text-lg mb-2">作业批阅</h3>
          <p className="text-gray-600 text-sm">教师可以在线批阅学生提交的代码作业</p>
        </div>
      </div> */}
    </div>
  )
}
