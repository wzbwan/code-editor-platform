import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth'
import {
  getChallengeUnlockManagerData,
  listChallengeClassOptions,
} from '@/lib/challenges/service'
import ChallengeUnlockManager from '../ChallengeUnlockManager'

interface Props {
  params: Promise<{ chapterKey: string }>
  searchParams: Promise<{ className?: string }>
}

export default async function TeacherChallengeDetailPage({ params, searchParams }: Props) {
  await requireTeacher()
  const { chapterKey } = await params
  const { className } = await searchParams
  const classOptions = await listChallengeClassOptions()
  const selectedClassName = className?.trim() || classOptions[0] || ''

  if (!selectedClassName) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-900">代码闯关</h1>
        <p className="mt-3 text-sm text-slate-600">当前还没有学生班级数据，无法配置闯关任务。</p>
      </div>
    )
  }

  const data = await getChallengeUnlockManagerData(selectedClassName, chapterKey)
  if (!data) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <Link
            href={`/teacher/challenges?className=${encodeURIComponent(selectedClassName)}`}
            className="text-sm text-blue-600 hover:underline"
          >
            返回任务列表
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">{data.chapter.title}</h1>
          <p className="mt-2 text-sm text-slate-600">
            当前查看班级：{selectedClassName}。这里展示这个闯关任务的关卡通关情况和学生进度。
          </p>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={`/api/challenges/export?className=${encodeURIComponent(selectedClassName)}&chapterKey=${encodeURIComponent(chapterKey)}`}
            className="text-sm text-emerald-600 hover:underline"
          >
            导出当前任务提交 JSON
          </a>
          <Link href="/teacher" className="text-sm text-blue-600 hover:underline">
            返回教师首页
          </Link>
        </div>
      </div>

      <ChallengeUnlockManager
        classOptions={classOptions}
        selectedClassName={selectedClassName}
        chapter={data.chapter}
        totalStudents={data.totalStudents}
        studentRankings={data.studentRankings}
      />
    </div>
  )
}
