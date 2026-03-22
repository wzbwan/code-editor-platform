import Link from 'next/link'
import { requireStudent } from '@/lib/auth'
import StudentPracticeClient from './StudentPracticeClient'

export default async function StudentPracticePage() {
  await requireStudent()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">答题练习</h1>
          <p className="mt-1 text-sm text-gray-500">系统会自动同步当前班级正在进行的练习</p>
        </div>
        <Link href="/student" className="text-blue-600 hover:underline">
          返回学生首页
        </Link>
      </div>
      <StudentPracticeClient />
    </div>
  )
}
