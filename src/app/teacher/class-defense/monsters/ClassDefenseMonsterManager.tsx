'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

interface MonsterType {
  id: string
  name: string
  baseHp: number
  baseAttack: number
  baseSpeed: number
  imagePath: string
}

interface ImageOption {
  label: string
  path: string
}

interface Props {
  monsters: MonsterType[]
  imageOptions: ImageOption[]
}

interface FormState {
  id: string
  name: string
  baseHp: string
  baseAttack: string
  baseSpeed: string
  imagePath: string
}

function emptyForm(imagePath: string): FormState {
  return {
    id: '',
    name: '',
    baseHp: '30',
    baseAttack: '10',
    baseSpeed: '0.01',
    imagePath,
  }
}

export default function ClassDefenseMonsterManager({ monsters, imageOptions }: Props) {
  const router = useRouter()
  const defaultImagePath = imageOptions[0]?.path || '/pets/rabbit.png'
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultImagePath))
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')

  const monsterById = useMemo(
    () => new Map(monsters.map((monster) => [monster.id, monster] as const)),
    [monsters]
  )

  const resetForm = () => setForm(emptyForm(defaultImagePath))

  const editMonster = (monsterId: string) => {
    const monster = monsterById.get(monsterId)
    if (!monster) {
      return
    }

    setForm({
      id: monster.id,
      name: monster.name,
      baseHp: String(monster.baseHp),
      baseAttack: String(monster.baseAttack),
      baseSpeed: String(monster.baseSpeed),
      imagePath: monster.imagePath,
    })
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('请输入怪物名称')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(
        form.id ? `/api/class-defense/monsters/${form.id}` : '/api/class-defense/monsters',
        {
          method: form.id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            baseHp: Number(form.baseHp),
            baseAttack: Number(form.baseAttack),
            baseSpeed: Number(form.baseSpeed),
            imagePath: form.imagePath,
          }),
        }
      )
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '保存怪物失败')
        return
      }

      resetForm()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (monsterId: string) => {
    if (!confirm('确定删除这个怪物吗？已创建的游戏不会受影响。')) {
      return
    }

    setDeletingId(monsterId)
    try {
      const res = await fetch(`/api/class-defense/monsters/${monsterId}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '删除怪物失败')
        return
      }

      if (form.id === monsterId) {
        resetForm()
      }
      router.refresh()
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
      <section className="rounded-xl bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-slate-900">
          {form.id ? '编辑怪物' : '新增怪物'}
        </h2>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">名称</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">基础血量</span>
              <input
                type="number"
                min={1}
                value={form.baseHp}
                onChange={(event) => setForm((current) => ({ ...current, baseHp: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">基础攻击</span>
              <input
                type="number"
                min={1}
                value={form.baseAttack}
                onChange={(event) => setForm((current) => ({ ...current, baseAttack: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">基础速度</span>
            <input
              type="number"
              min={0.001}
              step={0.001}
              value={form.baseSpeed}
              onChange={(event) => setForm((current) => ({ ...current, baseSpeed: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <div>
            <div className="text-sm font-medium text-slate-700">图片</div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {imageOptions.map((option) => (
                <button
                  key={option.path}
                  type="button"
                  title={option.label}
                  onClick={() => setForm((current) => ({ ...current, imagePath: option.path }))}
                  className={`rounded-lg border p-2 ${
                    form.imagePath === option.path
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <Image
                    src={option.path}
                    alt={option.label}
                    width={48}
                    height={48}
                    className="mx-auto h-12 w-12 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {form.id ? '保存修改' : '新增怪物'}
            </button>
            {form.id && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
              >
                取消
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-slate-900">怪物列表</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-3 py-2 font-medium">怪物</th>
                <th className="px-3 py-2 font-medium">基础血量</th>
                <th className="px-3 py-2 font-medium">基础攻击</th>
                <th className="px-3 py-2 font-medium">基础速度</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monsters.map((monster) => (
                <tr key={monster.id} className="align-middle">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <Image
                        src={monster.imagePath}
                        alt={monster.name}
                        width={40}
                        height={40}
                        className="h-10 w-10 object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                      <span className="font-medium text-slate-900">{monster.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{monster.baseHp}</td>
                  <td className="px-3 py-3 text-slate-700">{monster.baseAttack}</td>
                  <td className="px-3 py-3 text-slate-700">{monster.baseSpeed}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => editMonster(monster.id)}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === monster.id}
                        onClick={() => void handleDelete(monster.id)}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {monsters.length === 0 && (
                <tr>
                  <td className="px-3 py-8 text-center text-slate-500" colSpan={5}>
                    暂无怪物
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
