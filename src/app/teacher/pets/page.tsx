import Link from 'next/link'
import { requireTeacher } from '@/lib/auth'
import { getClassPetBoardByClassName, listPetClassOptions } from '@/lib/pets/service'
import ClassPetBoardClient from '@/app/student/pets/ClassPetBoardClient'

interface Props {
  searchParams: Promise<{ className?: string }>
}

export default async function TeacherPetsPage({ searchParams }: Props) {
  await requireTeacher()

  const { className } = await searchParams
  const classOptions = await listPetClassOptions()
  const selectedClassName = className?.trim() || classOptions[0] || ''

  if (!selectedClassName) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-900">班级宠物</h1>
        <p className="mt-3 text-sm text-slate-600">当前还没有学生班级数据，无法查看班级宠物状态。</p>
        <Link href="/teacher" className="mt-6 inline-flex text-sm text-blue-600 hover:underline">
          返回教师首页
        </Link>
      </div>
    )
  }

  const board = await getClassPetBoardByClassName(selectedClassName)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <ClassPetBoardClient
        title="班级宠物"
        description="教师可按班级查看宠物养成进度、等级分布和公开装备/技能状态。"
        backHref="/teacher"
        backLabel="返回教师首页"
        board={board}
        classOptions={classOptions}
        selectedClassName={selectedClassName}
        classSwitchPath="/teacher/pets"
      />
    </div>
  )
}
