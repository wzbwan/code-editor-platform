import { requireTeacher } from '@/lib/auth'
import { getTeacherQuizDashboard } from '@/lib/practice'
import {
  listTeacherClassDefenseMonsterTypes,
  listTeacherClassDefenseSessions,
} from '@/lib/class-defense/service'
import ClassDefenseManager from './ClassDefenseManager'

export default async function TeacherClassDefensePage() {
  const teacher = await requireTeacher()
  const [dashboard, sessions, monsterTypes] = await Promise.all([
    getTeacherQuizDashboard(teacher.id),
    listTeacherClassDefenseSessions(teacher.id),
    listTeacherClassDefenseMonsterTypes(teacher.id),
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">守护班级</h1>
      <p className="mb-6 text-sm text-slate-600">
        配置 Godot 端塔防答题游戏，学生必须先拥有宠物才能进入战场。
      </p>
      <ClassDefenseManager
        papers={JSON.parse(JSON.stringify(dashboard.papers))}
        classOptions={JSON.parse(JSON.stringify(dashboard.classOptions))}
        monsterTypes={JSON.parse(JSON.stringify(monsterTypes))}
        sessions={JSON.parse(JSON.stringify(sessions))}
      />
    </div>
  )
}
