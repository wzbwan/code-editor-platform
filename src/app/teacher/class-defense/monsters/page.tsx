import Link from 'next/link'
import { requireTeacher } from '@/lib/auth'
import { CLASS_DEFENSE_MONSTER_IMAGE_OPTIONS } from '@/lib/class-defense/monsters'
import { listTeacherClassDefenseMonsterTypes } from '@/lib/class-defense/service'
import ClassDefenseMonsterManager from './ClassDefenseMonsterManager'

export default async function TeacherClassDefenseMonstersPage() {
  const teacher = await requireTeacher()
  const monsters = await listTeacherClassDefenseMonsterTypes(teacher.id)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">怪物管理</h1>
          <p className="mt-2 text-sm text-slate-600">
            管理守护班级可选怪物，创建游戏时按怪物类型设置等级和数量。
          </p>
        </div>
        <Link
          href="/teacher/class-defense"
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
        >
          返回守护班级
        </Link>
      </div>

      <ClassDefenseMonsterManager
        monsters={JSON.parse(JSON.stringify(monsters))}
        imageOptions={CLASS_DEFENSE_MONSTER_IMAGE_OPTIONS}
      />
    </div>
  )
}
