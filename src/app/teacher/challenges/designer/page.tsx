import Link from 'next/link'
import { requireTeacher } from '@/lib/auth'
import { getAllChallengeChapters } from '@/lib/challenges/registry'
import ChallengeDesigner from './ChallengeDesigner'

export default async function TeacherChallengeDesignerPage() {
  await requireTeacher()
  const chapters = getAllChallengeChapters()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/teacher/challenges" className="text-sm text-blue-600 hover:underline">
            返回代码闯关
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">代码闯关设计台</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            面向教师的闯关任务设计、关卡编辑和判题测试界面。当前版本先以现有任务为模板，
            编辑结果可保存为浏览器草稿或导出 JSON，用于后续写入题库。
          </p>
        </div>
        <Link href="/teacher" className="text-sm text-blue-600 hover:underline">
          返回教师首页
        </Link>
      </div>

      <ChallengeDesigner initialChapters={JSON.parse(JSON.stringify(chapters))} />
    </div>
  )
}
