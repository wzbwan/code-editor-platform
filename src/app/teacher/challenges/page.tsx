import Link from 'next/link'
import { APP_SETTING_KEYS, getBooleanAppSetting } from '@/lib/app-settings'
import { requireTeacher } from '@/lib/auth'
import {
  getTeacherChallengeTaskListData,
  listChallengeClassOptions,
} from '@/lib/challenges/service'
import StudentChallengeNavToggle from './StudentChallengeNavToggle'

interface Props {
  searchParams: Promise<{ className?: string }>
}

export default async function TeacherChallengesPage({ searchParams }: Props) {
  await requireTeacher()
  const { className } = await searchParams
  const studentChallengeNavVisible = await getBooleanAppSetting(
    APP_SETTING_KEYS.studentChallengesNavVisible,
    true
  )
  const classOptions = await listChallengeClassOptions()
  const selectedClassName = className?.trim() || classOptions[0] || ''

  if (!selectedClassName) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-900">代码闯关</h1>
        <p className="mt-3 text-sm text-slate-600">当前还没有学生班级数据，无法配置闯关任务。</p>
        <div className="mt-6">
          <StudentChallengeNavToggle initialVisible={studentChallengeNavVisible} />
        </div>
      </div>
    )
  }

  const data = await getTeacherChallengeTaskListData(selectedClassName)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">代码闯关</h1>
          <p className="mt-2 text-sm text-slate-600">
            先选择班级，再进入某个闯关任务查看关卡通关情况和学生完成详情。
          </p>
        </div>
        <Link href="/teacher" className="text-sm text-blue-600 hover:underline">
          返回教师首页
        </Link>
      </div>

      <div className="mb-6">
        <StudentChallengeNavToggle initialVisible={studentChallengeNavVisible} />
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">闯关任务列表</h2>
            <p className="mt-2 text-sm text-slate-600">
              当前班级人数：{data.totalStudents}。每个任务卡片都可以进入详情页继续管理。
            </p>
          </div>
          <form className="flex items-center gap-3">
            <select
              name="className"
              defaultValue={selectedClassName}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {classOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              切换班级
            </button>
          </form>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {data.chapters.map((chapter) => (
          <div key={chapter.key} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                  {chapter.theme}
                </div>
                <h2 className="mt-3 text-xl font-semibold text-slate-900">{chapter.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{chapter.description}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 w-20 text-xs font-medium ${
                  chapter.isUnlocked
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {chapter.isUnlocked ? '已开放' : '未开放'}
              </span>
            </div>

            <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
              <span>关卡数：{chapter.levelCount}</span>
              <span>至少通关 1 关的学生：{chapter.passedStudentCount}/{data.totalStudents}</span>
            </div>

            <div className="mt-5">
              <Link
                href={`/teacher/challenges/${chapter.key}?className=${encodeURIComponent(selectedClassName)}`}
                className="inline-flex rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white hover:bg-slate-800"
              >
                查看任务详情
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
