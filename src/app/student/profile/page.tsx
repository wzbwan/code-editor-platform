import Link from 'next/link'
import { requireStudent } from '@/lib/auth'
import { listStudentPointRecords } from '@/lib/student-points'
import { prisma } from '@/lib/prisma'
import PasswordForm from './PasswordForm'

function formatDelta(delta: number) {
  return delta > 0 ? `+${delta}` : `${delta}`
}

export default async function StudentProfilePage() {
  const user = await requireStudent()

  const [student, pointRecords, assignments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        name: true,
        className: true,
        pointBalance: true,
        createdAt: true,
      },
    }),
    listStudentPointRecords(user.id, 50),
    prisma.assignment.findMany({
      include: {
        teacher: {
          select: {
            name: true,
          },
        },
        submissions: {
          where: { studentId: user.id },
          select: {
            id: true,
            score: true,
            feedback: true,
            submittedAt: true,
            reviewedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  if (!student) {
    return null
  }

  const reviewedCount = assignments.filter((assignment) => {
    const submission = assignment.submissions[0]
    return submission?.score !== null && submission?.score !== undefined
  }).length
  const submittedCount = assignments.filter((assignment) => assignment.submissions.length > 0).length

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">个人中心</h1>
          <p className="mt-1 text-sm text-gray-500">查看积分、批阅结果，并维护登录密码</p>
        </div>
        <Link href="/student" className="text-blue-600 hover:underline">
          返回作业列表
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold">个人信息</h2>
            <div className="space-y-2 text-sm text-gray-700">
              <p>姓名：{student.name}</p>
              <p>用户名：{student.username}</p>
              <p>班级：{student.className || '-'}</p>
              <p>注册时间：{new Date(student.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold">积分概览</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="text-sm text-blue-600">当前积分</div>
                <div className="mt-2 text-3xl font-bold text-blue-700">{student.pointBalance}</div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-4">
                <div className="text-sm text-emerald-600">已提交作业</div>
                <div className="mt-2 text-3xl font-bold text-emerald-700">{submittedCount}</div>
              </div>
              <div className="rounded-lg bg-amber-50 p-4">
                <div className="text-sm text-amber-600">已批阅作业</div>
                <div className="mt-2 text-3xl font-bold text-amber-700">{reviewedCount}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-sm text-slate-600">积分记录</div>
                <div className="mt-2 text-3xl font-bold text-slate-700">{pointRecords.length}</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold">修改密码</h2>
            <PasswordForm />
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">积分记录</h2>
              <span className="text-sm text-gray-500">最近 {pointRecords.length} 条</span>
            </div>
            {pointRecords.length === 0 ? (
              <div className="text-sm text-gray-500">暂无积分记录</div>
            ) : (
              <div className="space-y-3">
                {pointRecords.map((record) => (
                  <div
                    key={record.id}
                    className="rounded-lg border border-gray-100 px-4 py-3"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          {record.reason}
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                              record.delta > 0
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {formatDelta(record.delta)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          来源：
                          {record.source === 'MOBILE_API' ? '手机接口' : '网页后台'}
                          {record.operator?.name || record.operatorLabel
                            ? ` / 操作人：${record.operator?.name || record.operatorLabel}`
                            : ''}
                        </p>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(record.occurredAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">作业情况</h2>
              <span className="text-sm text-gray-500">包含评分与评语</span>
            </div>
            {assignments.length === 0 ? (
              <div className="text-sm text-gray-500">暂无作业</div>
            ) : (
              <div className="space-y-4">
                {assignments.map((assignment) => {
                  const submission = assignment.submissions[0]
                  const reviewed =
                    submission?.score !== null && submission?.score !== undefined

                  return (
                    <div
                      key={assignment.id}
                      className="rounded-lg border border-gray-100 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-medium text-gray-900">
                              {assignment.title}
                            </h3>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${
                                assignment.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-gray-200 text-gray-700'
                              }`}
                            >
                              {assignment.status === 'ACTIVE' ? '进行中' : '已停用'}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-gray-500">
                            发布教师：{assignment.teacher.name}
                          </div>
                          <div className="mt-1 text-sm text-gray-500">
                            创建时间：{new Date(assignment.createdAt).toLocaleString()}
                            {assignment.dueDate
                              ? ` / 截止时间：${new Date(assignment.dueDate).toLocaleString()}`
                              : ''}
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                            {assignment.description}
                          </p>
                        </div>

                        <div className="min-w-[220px] rounded-lg bg-gray-50 p-4 text-sm">
                          {!submission ? (
                            <div className="text-gray-500">未提交</div>
                          ) : (
                            <div className="space-y-2">
                              <p>提交时间：{new Date(submission.submittedAt).toLocaleString()}</p>
                              <p>
                                评分：
                                {reviewed ? (
                                  <span className="font-semibold text-green-700">
                                    {submission.score} 分
                                  </span>
                                ) : (
                                  <span className="text-amber-600">待批阅</span>
                                )}
                              </p>
                              <p className="whitespace-pre-wrap text-gray-700">
                                评语：{submission.feedback || '暂无评语'}
                              </p>
                              {submission.reviewedAt && (
                                <p className="text-gray-500">
                                  批阅时间：{new Date(submission.reviewedAt).toLocaleString()}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
