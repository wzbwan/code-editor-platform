'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Paper {
  id: string
  title: string
  _count: {
    questions: number
  }
}

interface MonsterType {
  id: string
  name: string
  baseHp: number
  baseAttack: number
  baseSpeed: number
  imagePath: string
}

interface ClassDefenseSession {
  id: string
  className: string
  paperId: string | null
  status: string
  classHp: number
  maxClassHp: number
  reviveSeconds: number
  configJson: string
  startedAt: string | null
  endedAt: string | null
  createdAt: string
  _count?: {
    participants: number
    monsters: number
    answers: number
  }
}

interface Props {
  papers: Paper[]
  classOptions: string[]
  monsterTypes: MonsterType[]
  sessions: ClassDefenseSession[]
}

interface WaveMonsterDraft {
  id: string
  monsterTypeId: string
  level: string
  quantity: string
}

interface WaveDraft {
  id: string
  rows: WaveMonsterDraft[]
}

const CLASS_DEFENSE_DIRECTIONS = [
  { id: 'northwest', label: '西北' },
  { id: 'north', label: '北' },
  { id: 'northeast', label: '东北' },
  { id: 'west', label: '西' },
  { id: 'east', label: '东' },
  { id: 'southwest', label: '西南' },
  { id: 'south', label: '南' },
  { id: 'southeast', label: '东南' },
] as const

function createDraftId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createMonsterRow(monsterTypeId: string): WaveMonsterDraft {
  return {
    id: createDraftId(),
    monsterTypeId,
    level: '1',
    quantity: '18',
  }
}

function createInitialWaves(monsterTypes: MonsterType[]): WaveDraft[] {
  const firstMonsterId = monsterTypes[0]?.id || ''
  const secondMonsterId = monsterTypes[1]?.id || firstMonsterId

  return [
    {
      id: createDraftId(),
      rows: [createMonsterRow(firstMonsterId)],
    },
    {
      id: createDraftId(),
      rows: [
        {
          ...createMonsterRow(secondMonsterId),
          level: '2',
          quantity: '18',
        },
      ],
    },
  ]
}

function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  })
}

function statusLabel(status: string) {
  if (status === 'PENDING') return '待开始'
  if (status === 'ACTIVE') return '进行中'
  if (status === 'ENDED') return '已结束'
  return status
}

export default function ClassDefenseManager({
  papers,
  classOptions,
  monsterTypes,
  sessions,
}: Props) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [actingId, setActingId] = useState('')
  const [className, setClassName] = useState(classOptions[0] || '')
  const [paperId, setPaperId] = useState(papers[0]?.id || '')
  const [maxClassHp, setMaxClassHp] = useState('10')
  const [reviveSeconds, setReviveSeconds] = useState('30')
  const [combatSeconds, setCombatSeconds] = useState('30')
  const [killPointReward, setKillPointReward] = useState('1')
  const [enabledDirections, setEnabledDirections] = useState<string[]>(
    () => CLASS_DEFENSE_DIRECTIONS.map((direction) => direction.id)
  )
  const [waves, setWaves] = useState<WaveDraft[]>(() => createInitialWaves(monsterTypes))

  const paperTitleById = useMemo(
    () => new Map(papers.map((paper) => [paper.id, paper.title] as const)),
    [papers]
  )
  const monsterById = useMemo(
    () => new Map(monsterTypes.map((monster) => [monster.id, monster] as const)),
    [monsterTypes]
  )

  const addWave = () => {
    const defaultMonsterId = monsterTypes[0]?.id || ''
    setWaves((current) => [
      ...current,
      {
        id: createDraftId(),
        rows: [createMonsterRow(defaultMonsterId)],
      },
    ])
  }

  const removeWave = (waveId: string) => {
    setWaves((current) => current.filter((wave) => wave.id !== waveId))
  }

  const addMonsterRow = (waveId: string) => {
    const defaultMonsterId = monsterTypes[0]?.id || ''
    setWaves((current) =>
      current.map((wave) =>
        wave.id === waveId
          ? {
              ...wave,
              rows: [...wave.rows, createMonsterRow(defaultMonsterId)],
            }
          : wave
      )
    )
  }

  const removeMonsterRow = (waveId: string, rowId: string) => {
    setWaves((current) =>
      current.map((wave) =>
        wave.id === waveId
          ? {
              ...wave,
              rows: wave.rows.filter((row) => row.id !== rowId),
            }
          : wave
      )
    )
  }

  const updateMonsterRow = (
    waveId: string,
    rowId: string,
    patch: Partial<WaveMonsterDraft>
  ) => {
    setWaves((current) =>
      current.map((wave) =>
        wave.id === waveId
          ? {
              ...wave,
              rows: wave.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
            }
          : wave
      )
    )
  }

  const toggleDirection = (directionId: string) => {
    setEnabledDirections((current) =>
      current.includes(directionId)
        ? current.filter((item) => item !== directionId)
        : [...current, directionId]
    )
  }

  const handleCreate = async () => {
    if (!className) {
      alert('请选择班级')
      return
    }

    if (!paperId) {
      alert('请选择试卷')
      return
    }

    if (!monsterTypes.length) {
      alert('请先创建怪物')
      return
    }

    if (enabledDirections.length === 0) {
      alert('请至少开启一个出怪方向')
      return
    }

    const configuredWaves = waves
      .map((wave, waveIndex) => ({
        waveIndex,
        startDelaySeconds: waveIndex === 0 ? 1 : waveIndex * 30 + 1,
        monsters: wave.rows
          .filter((row) => row.monsterTypeId && Number(row.quantity) > 0)
          .map((row) => ({
            monsterTypeId: row.monsterTypeId,
            level: Number(row.level),
            quantity: Number(row.quantity),
          })),
      }))
      .filter((wave) => wave.monsters.length > 0)

    if (configuredWaves.length === 0) {
      alert('请至少配置一波怪物')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/class-defense/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          className,
          paperId,
          config: {
            maxClassHp: Number(maxClassHp),
            reviveSeconds: Number(reviveSeconds),
            combatSeconds: Number(combatSeconds),
            killPointReward: Number(killPointReward),
            tickMs: 1000,
            spawnIntervalSeconds: 4,
            enabledDirections,
            waves: configuredWaves,
          },
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '创建守护班级失败')
        return
      }

      router.refresh()
    } finally {
      setCreating(false)
    }
  }

  const handleAction = async (sessionId: string, action: 'START' | 'END') => {
    setActingId(sessionId)
    try {
      const res = await fetch(`/api/class-defense/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '操作失败')
        return
      }

      router.refresh()
    } finally {
      setActingId('')
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,520px)_1fr]">
      <section className="rounded-xl bg-white p-6 shadow">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">创建游戏</h2>
          <Link
            href="/teacher/class-defense/monsters"
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
          >
            管理怪物
          </Link>
        </div>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">班级</span>
            <select
              value={className}
              onChange={(event) => setClassName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {classOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">战斗题库试卷</span>
            <select
              value={paperId}
              onChange={(event) => setPaperId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {papers.map((paper) => (
                <option key={paper.id} value={paper.id}>
                  {paper.title}（{paper._count.questions} 题）
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">班级血量</span>
              <input
                type="number"
                min={1}
                value={maxClassHp}
                onChange={(event) => setMaxClassHp(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">复活秒数</span>
              <input
                type="number"
                min={1}
                value={reviveSeconds}
                onChange={(event) => setReviveSeconds(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">答题时限</span>
              <input
                type="number"
                min={1}
                value={combatSeconds}
                onChange={(event) => setCombatSeconds(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">击杀积分</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={killPointReward}
                onChange={(event) => setKillPointReward(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-700">出怪方向</span>
              <button
                type="button"
                onClick={() =>
                  setEnabledDirections(CLASS_DEFENSE_DIRECTIONS.map((direction) => direction.id))
                }
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200"
              >
                全开
              </button>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {CLASS_DEFENSE_DIRECTIONS.map((direction) => {
                const checked = enabledDirections.includes(direction.id)

                return (
                  <label
                    key={direction.id}
                    className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm ${
                      checked
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDirection(direction.id)}
                      className="sr-only"
                    />
                    {direction.label}
                  </label>
                )
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">波次怪物</h3>
              <button
                type="button"
                onClick={addWave}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200"
              >
                增加波次
              </button>
            </div>

            {waves.map((wave, waveIndex) => (
              <div key={wave.id} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">第 {waveIndex + 1} 波</div>
                    <div className="text-xs text-slate-500">
                      开始时间：{waveIndex === 0 ? 1 : waveIndex * 30 + 1} 秒
                    </div>
                  </div>
                  {waves.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeWave(wave.id)}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100"
                    >
                      删除波次
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {wave.rows.map((row) => {
                    const selectedMonster = monsterById.get(row.monsterTypeId)

                    return (
                      <div
                        key={row.id}
                        className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_82px_82px_48px]"
                      >
                        <label className="block">
                          <span className="text-xs font-medium text-slate-600">怪物</span>
                          <div className="mt-1 flex items-center gap-2">
                            {selectedMonster && (
                              <Image
                                src={selectedMonster.imagePath}
                                alt={selectedMonster.name}
                                width={32}
                                height={32}
                                className="h-8 w-8 object-contain"
                                style={{ imageRendering: 'pixelated' }}
                              />
                            )}
                            <select
                              value={row.monsterTypeId}
                              onChange={(event) =>
                                updateMonsterRow(wave.id, row.id, {
                                  monsterTypeId: event.target.value,
                                })
                              }
                              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            >
                              {monsterTypes.map((monster) => (
                                <option key={monster.id} value={monster.id}>
                                  {monster.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </label>
                        <label className="block">
                          <span className="text-xs font-medium text-slate-600">等级</span>
                          <input
                            type="number"
                            min={1}
                            value={row.level}
                            onChange={(event) =>
                              updateMonsterRow(wave.id, row.id, {
                                level: event.target.value,
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-medium text-slate-600">数量</span>
                          <input
                            type="number"
                            min={1}
                            value={row.quantity}
                            onChange={(event) =>
                              updateMonsterRow(wave.id, row.id, {
                                quantity: event.target.value,
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <div className="flex items-end">
                          <button
                            type="button"
                            disabled={wave.rows.length === 1}
                            title="删除怪物"
                            onClick={() => removeMonsterRow(wave.id, row.id)}
                            className="h-10 w-10 rounded-lg bg-white text-sm text-red-600 ring-1 ring-slate-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => addMonsterRow(wave.id)}
                  className="mt-3 rounded-lg bg-white px-3 py-1.5 text-xs text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  增加怪物
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={creating || !papers.length || !classOptions.length || !monsterTypes.length}
            onClick={() => void handleCreate()}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            创建守护班级
          </button>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">游戏会话</h2>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
          >
            刷新
          </button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-3 py-2 font-medium">班级</th>
                <th className="px-3 py-2 font-medium">试卷</th>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium">血量</th>
                <th className="px-3 py-2 font-medium">参与</th>
                <th className="px-3 py-2 font-medium">怪物</th>
                <th className="px-3 py-2 font-medium">创建时间</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map((session) => (
                <tr key={session.id} className="align-top">
                  <td className="px-3 py-3 text-slate-800">{session.className}</td>
                  <td className="px-3 py-3 text-slate-600">
                    {session.paperId ? paperTitleById.get(session.paperId) || session.paperId : '-'}
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      {statusLabel(session.status)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {session.classHp} / {session.maxClassHp}
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {session._count?.participants || 0} 人
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {session._count?.monsters || 0} 只
                  </td>
                  <td className="px-3 py-3 text-slate-500">{formatDate(session.createdAt)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {session.status === 'PENDING' && (
                        <button
                          type="button"
                          disabled={actingId === session.id}
                          onClick={() => void handleAction(session.id, 'START')}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          开始
                        </button>
                      )}
                      {session.status !== 'ENDED' && (
                        <button
                          type="button"
                          disabled={actingId === session.id}
                          onClick={() => void handleAction(session.id, 'END')}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          结束
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td className="px-3 py-8 text-center text-slate-500" colSpan={8}>
                    暂无守护班级会话
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
