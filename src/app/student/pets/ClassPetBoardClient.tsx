'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type BoardStudent = {
  studentId: string
  studentName: string
  isCurrentStudent: boolean
  hasPet: boolean
  pet: null | {
    id: string
    speciesKey: string
    name: string
    title: string
    description: string
    imagePath: string
    nickname: string | null
    level: number
    exp: number
    nextLevelExp: number
    currentHp: number
    battlePower: number
    weeklyExp: number
    weeklyLevelUps: number
    latestGrowthAt: string | null
    badges: string[]
    stats: {
      maxHp: number
      attack: number
      defense: number
      critRate: number
      dodgeRate: number
    }
    equipmentSlots: Array<{
      slotIndex: number
      equipmentKey: string | null
      equipmentName: string | null
    }>
    skillSlots: Array<{
      slotIndex: number
      skillKey: string | null
      skillName: string | null
    }>
    inventorySlots: Array<{
      slotIndex: number
      itemKey: string | null
      itemName: string | null
      quantity: number
    }>
    expRecords: Array<{
      id: string
      expDelta: number
      pointDelta: number | null
      reason: string
      source: string
      levelBefore: number
      levelAfter: number
      occurredAt: string
    }>
  }
}

interface Props {
  title: string
  description: string
  backHref: string
  backLabel: string
  board: {
    currentStudentId: string
    currentStudentName: string
    className: string
    students: BoardStudent[]
    summary: {
      totalStudents: number
      withPets: number
      withoutPets: number
      classWeeklyExp: number
    }
  }
  classOptions?: string[]
  selectedClassName?: string
  classSwitchPath?: string
}

type SortKey = 'level' | 'power' | 'growth' | 'recent' | 'name'

const sortOptions: Array<{ key: SortKey; label: string }> = [
  { key: 'level', label: '等级优先' },
  { key: 'power', label: '战力优先' },
  { key: 'growth', label: '本周成长' },
  { key: 'recent', label: '最近活跃' },
  { key: 'name', label: '姓名排序' },
]

function countFilled<T extends { [key: string]: unknown }>(items: T[], field: keyof T) {
  return items.filter((item) => Boolean(item[field])).length
}

export default function ClassPetBoardClient({
  title,
  description,
  backHref,
  backLabel,
  board,
  classOptions,
  selectedClassName,
  classSwitchPath,
}: Props) {
  const router = useRouter()
  const [sortBy, setSortBy] = useState<SortKey>('level')
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    const current = board.students.find((student) => student.studentId === board.currentStudentId)
    return current?.studentId || board.students[0]?.studentId || ''
  })

  const studentsWithPets = useMemo(
    () => board.students.filter((student) => student.hasPet && student.pet),
    [board.students]
  )

  const sortedStudents = useMemo(() => {
    const students = [...board.students]

    const latestGrowthValue = (student: BoardStudent) =>
      student.pet?.latestGrowthAt ? new Date(student.pet.latestGrowthAt).getTime() : 0

    students.sort((left, right) => {
      if (left.hasPet !== right.hasPet) {
        return left.hasPet ? -1 : 1
      }

      switch (sortBy) {
        case 'level':
          return (right.pet?.level || 0) - (left.pet?.level || 0) || right.studentName.localeCompare(left.studentName, 'zh-CN')
        case 'power':
          return (right.pet?.battlePower || 0) - (left.pet?.battlePower || 0) || (right.pet?.level || 0) - (left.pet?.level || 0)
        case 'growth':
          return (right.pet?.weeklyExp || 0) - (left.pet?.weeklyExp || 0) || (right.pet?.weeklyLevelUps || 0) - (left.pet?.weeklyLevelUps || 0)
        case 'recent':
          return latestGrowthValue(right) - latestGrowthValue(left) || (right.pet?.weeklyExp || 0) - (left.pet?.weeklyExp || 0)
        case 'name':
          return left.studentName.localeCompare(right.studentName, 'zh-CN')
        default:
          return 0
      }
    })

    return students
  }, [board.students, sortBy])

  useEffect(() => {
    if (!sortedStudents.some((student) => student.studentId === selectedStudentId)) {
      setSelectedStudentId(sortedStudents[0]?.studentId || '')
    }
  }, [selectedStudentId, sortedStudents])

  const selectedStudent =
    sortedStudents.find((student) => student.studentId === selectedStudentId) || sortedStudents[0] || null

  const classHighlights = useMemo(() => {
    const byLevel = [...studentsWithPets].sort(
      (left, right) => (right.pet?.level || 0) - (left.pet?.level || 0)
    )[0] || null
    const byPower = [...studentsWithPets].sort(
      (left, right) => (right.pet?.battlePower || 0) - (left.pet?.battlePower || 0)
    )[0] || null
    const byGrowth = [...studentsWithPets].sort(
      (left, right) => (right.pet?.weeklyExp || 0) - (left.pet?.weeklyExp || 0)
    )[0] || null

    return { byLevel, byPower, byGrowth }
  }, [studentsWithPets])

  if (!board.className) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
        <h2 className="text-2xl font-bold text-slate-900">当前账号还没有分班</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          只有分班后的学生才能查看同班宠物状态。
        </p>
        <Link
          href="/student/profile"
          className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm text-white hover:bg-slate-800"
        >
          返回个人中心
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          {classOptions && classOptions.length > 0 && selectedClassName && classSwitchPath ? (
            <select
              value={selectedClassName}
              onChange={(event) => {
                router.push(`${classSwitchPath}?className=${encodeURIComponent(event.target.value)}`)
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {classOptions.map((className) => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </select>
          ) : null}
          <Link href={backHref} className="text-blue-600 hover:underline">
            {backLabel}
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-sky-950 via-slate-900 to-emerald-900 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.35em] text-sky-200">Class Pets</div>
            <h2 className="mt-3 text-4xl font-bold">{board.className} 宠物图鉴</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
              公告：请所有同学尽快领取宠物
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-xs text-sky-100">班级人数</div>
              <div className="mt-2 text-3xl font-bold">{board.summary.totalStudents}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-xs text-sky-100">已拥有宠物</div>
              <div className="mt-2 text-3xl font-bold">{board.summary.withPets}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-xs text-sky-100">待选择宠物</div>
              <div className="mt-2 text-3xl font-bold">{board.summary.withoutPets}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-xs text-sky-100">本周班级经验</div>
              <div className="mt-2 text-3xl font-bold">{board.summary.classWeeklyExp}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl bg-amber-50 p-5 shadow-sm ring-1 ring-amber-200">
          <div className="text-sm text-amber-700">等级之星</div>
          <div className="mt-2 text-xl font-bold text-slate-900">
            {classHighlights.byLevel ? `${classHighlights.byLevel.studentName} · Lv.${classHighlights.byLevel.pet?.level}` : '暂无'}
          </div>
        </div>
        <div className="rounded-3xl bg-sky-50 p-5 shadow-sm ring-1 ring-sky-200">
          <div className="text-sm text-sky-700">战力之星</div>
          <div className="mt-2 text-xl font-bold text-slate-900">
            {classHighlights.byPower ? `${classHighlights.byPower.studentName} · ${classHighlights.byPower.pet?.battlePower}` : '暂无'}
          </div>
        </div>
        <div className="rounded-3xl bg-emerald-50 p-5 shadow-sm ring-1 ring-emerald-200">
          <div className="text-sm text-emerald-700">成长之星</div>
          <div className="mt-2 text-xl font-bold text-slate-900">
            {classHighlights.byGrowth ? `${classHighlights.byGrowth.studentName} · +${classHighlights.byGrowth.pet?.weeklyExp} 经验` : '暂无'}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            {sortOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSortBy(option.key)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  sortBy === option.key
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {sortedStudents.map((student) => (
              <button
                key={student.studentId}
                type="button"
                onClick={() => setSelectedStudentId(student.studentId)}
                className={`text-left rounded-3xl p-5 transition ${
                  selectedStudent?.studentId === student.studentId
                    ? 'bg-slate-900 text-white shadow-lg'
                    : student.hasPet
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 hover:-translate-y-0.5'
                      : 'bg-slate-50 text-slate-700 shadow-sm ring-1 ring-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-xl font-bold">{student.studentName}</div>
                      {student.isCurrentStudent && (
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          selectedStudent?.studentId === student.studentId
                            ? 'bg-white/15 text-slate-100'
                            : 'bg-slate-900 text-white'
                        }`}>
                          我
                        </span>
                      )}
                    </div>
                    <div className={`mt-1 text-sm ${
                      selectedStudent?.studentId === student.studentId ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                      {student.pet ? `${student.pet.name} · ${student.pet.title}` : '待选择宠物'}
                    </div>
                  </div>
                  {student.pet && (
                    <div className={`rounded-full px-3 py-1 text-sm ${
                      selectedStudent?.studentId === student.studentId
                        ? 'bg-white/10 text-amber-200'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      Lv.{student.pet.level}
                    </div>
                  )}
                </div>

                {student.pet ? (
                  <>
                    <div className="mt-4 flex items-center gap-4">
                      <div className={`flex h-20 w-20 items-center justify-center rounded-3xl ${
                        selectedStudent?.studentId === student.studentId ? 'bg-white/10' : 'bg-slate-100'
                      }`}>
                        <Image
                          src={student.pet.imagePath}
                          alt={student.pet.name}
                          width={72}
                          height={72}
                          className="h-18 w-18 object-contain"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      </div>
                      <div className="grid flex-1 grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className={selectedStudent?.studentId === student.studentId ? 'text-slate-300' : 'text-slate-500'}>
                            战力
                          </div>
                          <div className="mt-1 text-lg font-bold">{student.pet.battlePower}</div>
                        </div>
                        <div>
                          <div className={selectedStudent?.studentId === student.studentId ? 'text-slate-300' : 'text-slate-500'}>
                            本周经验
                          </div>
                          <div className="mt-1 text-lg font-bold">+{student.pet.weeklyExp}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {student.pet.badges.length > 0 ? (
                        student.pet.badges.map((badge) => (
                          <span
                            key={`${student.studentId}-${badge}`}
                            className={`rounded-full px-3 py-1 text-xs ${
                              selectedStudent?.studentId === student.studentId
                                ? 'bg-white/10 text-sky-100'
                                : 'bg-sky-100 text-sky-700'
                            }`}
                          >
                            {badge}
                          </span>
                        ))
                      ) : (
                        <span className={`text-xs ${
                          selectedStudent?.studentId === student.studentId ? 'text-slate-300' : 'text-slate-500'
                        }`}>
                          持续成长中
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                    这位同学还没有选择宠物。
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">宠物详情</h3>
              <Link href="/student/profile" className="text-sm text-blue-600 hover:underline">
                回到个人中心
              </Link>
            </div>

            {!selectedStudent ? (
              <div className="text-sm text-slate-500">暂无班级成员</div>
            ) : selectedStudent.pet ? (
              <div className="space-y-5">
                <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-5 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-sky-200">{selectedStudent.studentName}</div>
                      <div className="mt-2 text-3xl font-bold">{selectedStudent.pet.name}</div>
                      <div className="mt-2 text-sm text-slate-300">{selectedStudent.pet.title}</div>
                    </div>
                    <div className="rounded-full bg-white/10 px-3 py-1 text-sm text-amber-200">
                      Lv.{selectedStudent.pet.level}
                    </div>
                  </div>
                  <div className="mt-5 flex justify-center rounded-3xl bg-white/10 p-5">
                    <Image
                      src={selectedStudent.pet.imagePath}
                      alt={selectedStudent.pet.name}
                      width={144}
                      height={144}
                      className="h-36 w-36 object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-200">
                    {selectedStudent.pet.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">战力</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">{selectedStudent.pet.battlePower}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">本周经验</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">+{selectedStudent.pet.weeklyExp}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">攻击 / 防御</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">
                      {selectedStudent.pet.stats.attack} / {selectedStudent.pet.stats.defense}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">生命值</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">
                      {selectedStudent.pet.currentHp} / {selectedStudent.pet.stats.maxHp}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">暴击 / 躲闪</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">
                      {selectedStudent.pet.stats.critRate}% / {selectedStudent.pet.stats.dodgeRate}%
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">装备槽已装配</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">
                      {countFilled(selectedStudent.pet.equipmentSlots, 'equipmentName')} / {selectedStudent.pet.equipmentSlots.length}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">装备槽位</div>
                    </div>
                    <div className="grid gap-2">
                      {selectedStudent.pet.equipmentSlots.map((slot) => (
                        <div
                          key={`detail-equipment-${slot.slotIndex}`}
                          className="rounded-xl bg-slate-50 px-3 py-2"
                        >
                          <div className="text-xs text-slate-500">装备槽 {slot.slotIndex + 1}</div>
                          <div className="mt-1 text-sm font-medium text-slate-900">
                            {slot.equipmentName || '未装备'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">技能槽位</div>
                    </div>
                    <div className="grid gap-2">
                      {selectedStudent.pet.skillSlots.map((slot) => (
                        <div
                          key={`detail-skill-${slot.slotIndex}`}
                          className="rounded-xl bg-slate-50 px-3 py-2"
                        >
                          <div className="text-xs text-slate-500">技能槽 {slot.slotIndex + 1}</div>
                          <div className="mt-1 text-sm font-medium text-slate-900">
                            {slot.skillName || '未装配'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">
                {selectedStudent.isCurrentStudent
                  ? '你还没有选择宠物，去个人中心先选一只，再回来查看班级对比。'
                  : `${selectedStudent.studentName} 还没有选择宠物。`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
