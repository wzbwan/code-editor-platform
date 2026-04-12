'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { formatAppDateTime } from '@/lib/date-format'

interface PetSpeciesCard {
  key: string
  name: string
  title: string
  description: string
  imagePath: string
}

interface PetExpRecord {
  id: string
  expDelta: number
  pointDelta: number | null
  reason: string
  source: string
  levelBefore: number
  levelAfter: number
  occurredAt: string
}

interface PetProfile {
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
  expRecords: PetExpRecord[]
}

interface Props {
  pet: PetProfile | null
  availablePets: PetSpeciesCard[]
}

function EmptySlot({ label, sublabel }: { label: string; sublabel: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-3 text-center">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <div className="mt-1 text-xs text-slate-500">{sublabel}</div>
    </div>
  )
}

export default function StudentPetPanel({ pet, availablePets }: Props) {
  const router = useRouter()
  const [selectingKey, setSelectingKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [manualOpen, setManualOpen] = useState(false)

  const shouldShowModal = !pet || manualOpen
  const expPercent = useMemo(() => {
    if (!pet) {
      return 0
    }

    if (pet.nextLevelExp <= 0) {
      return 100
    }

    return Math.min(100, Math.max(4, (pet.exp / pet.nextLevelExp) * 100))
  }, [pet])

  const handleSelectPet = async (speciesKey: string) => {
    setSelectingKey(speciesKey)
    setError('')

    try {
      const res = await fetch('/api/student-pet/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ speciesKey }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '选择宠物失败')
        return
      }

      setManualOpen(false)
      router.refresh()
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : '选择宠物失败')
    } finally {
      setSelectingKey(null)
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-amber-100 via-white to-sky-100 shadow">
        {pet ? (
          <div className="grid gap-6 p-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-amber-300">Student Pet</div>
                  <h2 className="mt-2 text-3xl font-bold">{pet.name}</h2>
                  <p className="mt-2 text-sm text-slate-300">{pet.title}</p>
                </div>
                <div className="rounded-full bg-white/10 px-3 py-1 text-sm text-amber-200">
                  Lv.{pet.level}
                </div>
              </div>

              <div className="mt-6 flex justify-center rounded-3xl bg-white/10 p-6">
                <Image
                  src={pet.imagePath}
                  alt={pet.name}
                  width={160}
                  height={160}
                  className="h-40 w-40 object-contain"
                  style={{ imageRendering: 'pixelated' }}
                  priority
                />
              </div>

              <p className="mt-5 text-sm leading-6 text-slate-200">{pet.description}</p>

              <div className="mt-5 rounded-2xl bg-white/10 p-4">
                <div className="flex items-center justify-between text-sm text-slate-200">
                  <span>经验值</span>
                  <span>
                    {pet.nextLevelExp > 0 ? `${pet.exp} / ${pet.nextLevelExp}` : '已满级'}
                  </span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400"
                    style={{ width: `${expPercent}%` }}
                  />
                </div>
                <div className="mt-3 text-xs text-slate-300">
                  当前生命 {pet.currentHp} / {pet.stats.maxHp}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-sm text-slate-500">攻击力</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{pet.stats.attack}</div>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-sm text-slate-500">防御力</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{pet.stats.defense}</div>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-sm text-slate-500">暴击率</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{pet.stats.critRate}%</div>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-sm text-slate-500">躲闪率</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{pet.stats.dodgeRate}%</div>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-sm text-slate-500">最大血量</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{pet.stats.maxHp}</div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-6">
                  <div className="rounded-2xl bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">装备槽位</h3>
                      <span className="text-sm text-slate-500">4 / 4</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {pet.equipmentSlots.map((slot) =>
                        slot.equipmentName ? (
                          <div
                            key={`equipment-${slot.slotIndex}`}
                            className="rounded-2xl border border-amber-200 bg-amber-50 p-3"
                          >
                            <div className="text-xs text-amber-700">装备槽 {slot.slotIndex + 1}</div>
                            <div className="mt-1 font-medium text-slate-900">{slot.equipmentName}</div>
                          </div>
                        ) : (
                          <EmptySlot
                            key={`equipment-${slot.slotIndex}`}
                            label={`装备槽 ${slot.slotIndex + 1}`}
                            sublabel=""
                          />
                        )
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">技能槽位</h3>
                      <span className="text-sm text-slate-500">4 / 4</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {pet.skillSlots.map((slot) =>
                        slot.skillName ? (
                          <div
                            key={`skill-${slot.slotIndex}`}
                            className="rounded-2xl border border-sky-200 bg-sky-50 p-3"
                          >
                            <div className="text-xs text-sky-700">技能槽 {slot.slotIndex + 1}</div>
                            <div className="mt-1 font-medium text-slate-900">{slot.skillName}</div>
                          </div>
                        ) : (
                          <EmptySlot
                            key={`skill-${slot.slotIndex}`}
                            label={`技能槽 ${slot.slotIndex + 1}`}
                            sublabel=""
                          />
                        )
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">背包</h3>
                      <span className="text-sm text-slate-500">16 格</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {pet.inventorySlots.map((slot) => (
                        <div
                          key={`inventory-${slot.slotIndex}`}
                          className={`rounded-2xl border p-3 ${
                            slot.itemName
                              ? 'border-emerald-200 bg-emerald-50'
                              : 'border-dashed border-slate-300 bg-slate-50'
                          }`}
                        >
                          <div className="text-xs text-slate-500">{slot.slotIndex + 1}</div>
                          <div className="mt-2 min-h-10 text-sm font-medium text-slate-800">
                            {slot.itemName || '空'}
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            {slot.itemName ? `数量 x${slot.quantity}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">成长记录</h3>
                    <button
                      type="button"
                      onClick={() => setManualOpen(true)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      查看图鉴
                    </button>
                  </div>

                  {pet.expRecords.length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                      还没有成长记录，获取积分后这里会自动更新。
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pet.expRecords.map((record) => (
                        <div key={record.id} className="rounded-2xl bg-slate-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-slate-900">+{record.expDelta} 经验</div>
                            {record.levelAfter > record.levelBefore && (
                              <div className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                                Lv.{record.levelBefore} → Lv.{record.levelAfter}
                              </div>
                            )}
                          </div>
                          <div className="mt-2 text-sm text-slate-600">{record.reason}</div>
                          <div className="mt-2 text-xs text-slate-500">
                            {record.pointDelta !== null ? `对应积分 +${record.pointDelta.toFixed(1)} / ` : ''}
                            {formatAppDateTime(record.occurredAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-5">
                    <Link
                      href="/student/pets"
                      className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white hover:bg-slate-800"
                    >
                      查看班级宠物
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm uppercase tracking-[0.25em] text-amber-600">Student Pet</div>
                  <h2 className="mt-2 text-3xl font-bold text-slate-900">还没有宠物伙伴</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                    先选择一只初始宠物。之后你每次获得正向积分，宠物都会同步获得经验并自动升级。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setManualOpen(true)}
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm text-white hover:bg-slate-800"
                >
                  立即选宠
                </button>
              </div>
              <div className="mt-4">
                <Link href="/student/pets" className="text-sm text-blue-600 hover:underline">
                  先看看班级里的宠物状态
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {shouldShowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-[0.25em] text-amber-600">Choose Your Pet</div>
                <h3 className="mt-2 text-3xl font-bold text-slate-900">选择你的初始宠物</h3>
                <p className="mt-3 text-sm text-slate-600">
                  每次获得正向积分，宠物都会同步获得经验并伴随你的进步一起成长。
                </p>
              </div>
              {pet && (
                <button
                  type="button"
                  onClick={() => {
                    setManualOpen(false)
                    setError('')
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  关闭
                </button>
              )}
            </div>

            {error && (
              <div className="mb-5 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {availablePets.map((candidate) => (
                <div
                  key={candidate.key}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm"
                >
                  <div className="rounded-3xl bg-white p-5">
                    <div className="flex justify-center">
                      <Image
                        src={candidate.imagePath}
                        alt={candidate.name}
                        width={96}
                        height={96}
                        className="h-24 w-24 object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                    <div className="mt-4 text-center">
                      <div className="text-xl font-bold text-slate-900">{candidate.name}</div>
                      <div className="mt-1 text-sm text-amber-600">{candidate.title}</div>
                      <p className="mt-3 min-h-12 text-sm leading-6 text-slate-600">
                        {candidate.description}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(selectingKey)}
                    onClick={() => void handleSelectPet(candidate.key)}
                    className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {selectingKey === candidate.key ? '选择中...' : `选择 ${candidate.name}`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
