import Link from 'next/link'
import { requireTeacher } from '@/lib/auth'
import { getChallengeUnlockManagerData, listChallengeClassOptions } from '@/lib/challenges/service'
import ChallengeUnlockManager from './ChallengeUnlockManager'

interface Props {
  searchParams: Promise<{ className?: string }>
}

export default async function TeacherChallengesPage({ searchParams }: Props) {
  await requireTeacher()
  const { className } = await searchParams
  const classOptions = await listChallengeClassOptions()
  const selectedClassName = className?.trim() || classOptions[0] || ''

  if (!selectedClassName) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-900">代码闯关</h1>
        <p className="mt-3 text-sm text-slate-600">当前还没有学生班级数据，无法配置闯关开放状态。</p>
      </div>
    )
  }

  const data = await getChallengeUnlockManagerData(selectedClassName)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">代码闯关</h1>
          <p className="mt-2 text-sm text-slate-600">
            先按班级开放章节，再按需提前开放个别关卡。
          </p>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={`/api/challenges/export?className=${encodeURIComponent(selectedClassName)}`}
            className="text-sm text-emerald-600 hover:underline"
          >
            导出本班提交 JSON
          </a>
          <Link href="/teacher" className="text-sm text-blue-600 hover:underline">
            返回教师首页
          </Link>
        </div>
      </div>

      <ChallengeUnlockManager
        classOptions={classOptions}
        selectedClassName={selectedClassName}
        chapters={data.chapters}
      />
    </div>
  )
}
