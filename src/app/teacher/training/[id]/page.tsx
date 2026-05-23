import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth'
import { TRAINING_ATTEMPT_STATUSES, TRAINING_SET_STATUSES, UNASSIGNED_CLASS_FILTER } from '@/lib/constants'
import { formatAppDateTime } from '@/lib/date-format'
import { getTeacherTrainingAnalytics } from '@/lib/training'

interface Props {
  params: {
    id: string
  }
}

function formatRate(value: number | null) {
  if (value === null) {
    return '-'
  }
  return `${Math.round(value * 100)}%`
}

function getStatusLabel(status: string) {
  if (status === TRAINING_SET_STATUSES.PUBLISHED) {
    return '已发布'
  }
  if (status === TRAINING_SET_STATUSES.ARCHIVED) {
    return '已下架'
  }
  return '草稿'
}

export default async function TeacherTrainingDetailPage({ params }: Props) {
  const teacher = await requireTeacher()
  const data = await getTeacherTrainingAnalytics(teacher.id, params.id)
  if (!data) {
    notFound()
  }

  const totalScore = data.totalObjectiveScore + data.totalProgramScore
  const practicedCount = data.roster.filter((item) => item.attemptCount > 0).length

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/teacher/training" className="text-sm text-blue-600 hover:text-blue-700">
            返回训练场
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{data.trainingSet.title}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {getStatusLabel(data.trainingSet.status)} / 班级：
            {data.trainingSet.className === UNASSIGNED_CLASS_FILTER ? '未分班' : data.trainingSet.className}
            {' / '}
            总分 {totalScore} 分
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-white p-5 shadow">
          <div className="text-sm text-slate-500">参与人数</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {practicedCount}/{data.roster.length}
          </div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow">
          <div className="text-sm text-slate-500">练习次数</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {data.roster.reduce((total, item) => total + item.attemptCount, 0)}
          </div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow">
          <div className="text-sm text-slate-500">客观题</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {data.trainingSet.objectiveQuestions.length} 道
          </div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow">
          <div className="text-sm text-slate-500">程序题</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {data.trainingSet.programQuestions.length} 道
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold text-slate-900">学生练习情况</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2">学生</th>
                  <th className="px-3 py-2">次数</th>
                  <th className="px-3 py-2">最高分</th>
                  <th className="px-3 py-2">最近分</th>
                  <th className="px-3 py-2">最近时间</th>
                  <th className="px-3 py-2">状态</th>
                </tr>
              </thead>
              <tbody>
                {data.roster.map((item) => (
                  <tr key={item.student.id} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">
                        {item.student.name || item.student.username}
                      </div>
                      <div className="text-xs text-slate-400">{item.student.username}</div>
                    </td>
                    <td className="px-3 py-2">{item.attemptCount}</td>
                    <td className="px-3 py-2">{item.completedCount > 0 ? item.bestScore : '-'}</td>
                    <td className="px-3 py-2">{item.latestScore ?? '-'}</td>
                    <td className="px-3 py-2">
                      {item.latestAt ? formatAppDateTime(item.latestAt) : '-'}
                    </td>
                    <td className="px-3 py-2">
                      {item.latestStatus === TRAINING_ATTEMPT_STATUSES.IN_PROGRESS
                        ? '练习中'
                        : item.latestStatus === TRAINING_ATTEMPT_STATUSES.COMPLETED
                          ? '已完成'
                          : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold text-slate-900">错题排行</h2>
          <div className="mt-4 space-y-3">
            {data.questionStats.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-sm text-slate-500">
                暂无提交记录
              </div>
            ) : (
              data.questionStats.slice(0, 12).map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-slate-900">{item.title}</div>
                    <div className="text-sm text-slate-500">正确率 {formatRate(item.correctRate)}</div>
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm text-slate-600">{item.content}</div>
                  <div className="mt-2 text-xs text-slate-400">
                    提交 {item.submitCount} 次 / 错误 {item.wrongCount} 次
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
