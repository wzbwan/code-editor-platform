import { requireStudent } from '@/lib/auth'
import { getClassPetBoard } from '@/lib/pets/service'
import ClassPetBoardClient from './ClassPetBoardClient'

export default async function StudentPetsPage() {
  const student = await requireStudent()
  const board = await getClassPetBoard(student.id)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <ClassPetBoardClient
        title="班级宠物"
        description="看看同班同学的宠物培养进度和成长状态。"
        backHref="/student/profile"
        backLabel="返回个人中心"
        board={board}
      />
    </div>
  )
}
