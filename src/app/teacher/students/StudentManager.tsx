'use client'

import { useRef, useState } from 'react'
import { formatOneDecimal, formatSignedOneDecimal } from '@/lib/point-format'
import {
  buildStudentSearchIndex,
  matchesStudentQuery,
  type StudentSearchIndex,
} from '@/lib/student-search'

interface Student {
  id: string
  username: string
  name: string
  className: string | null
  pointBalance: number
  createdAt: string
  _count: { submissions: number }
}

interface Props {
  students: Student[]
  recentPointRecords: PointRecord[]
}

interface SkippedRow {
  rowNumber: number
  username: string
  reason: string
}

interface ImportResult {
  createdCount: number
  updatedCount: number
  skippedCount: number
  skippedRows: SkippedRow[]
}

interface PointRecord {
  id: string
  studentId: string
  studentUsername: string
  operatorLabel: string | null
  delta: number
  reason: string
  occurredAt: string
  source: string
  createdAt: string
  student: {
    name: string
    username: string
  }
  operator: {
    name: string
    username: string
  } | null
}

interface StudentWithSearchIndex extends Student {
  searchIndex: StudentSearchIndex
}

function sortStudentsByUsername(students: StudentWithSearchIndex[]) {
  return [...students].sort((left, right) => left.username.localeCompare(right.username))
}

function enrichStudent(student: Student): StudentWithSearchIndex {
  return {
    ...student,
    searchIndex: buildStudentSearchIndex(student),
  }
}

export default function StudentManager({
  students: initialStudents,
  recentPointRecords: initialRecentPointRecords,
}: Props) {
  const [students, setStudents] = useState(() =>
    sortStudentsByUsername(initialStudents.map(enrichStudent))
  )
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    className: '',
  })
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [pointLoadingId, setPointLoadingId] = useState<string | null>(null)
  const [resettingPasswordId, setResettingPasswordId] = useState<string | null>(null)
  const [recentPointRecords, setRecentPointRecords] = useState(initialRecentPointRecords)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const filteredStudents = students.filter((student) =>
    matchesStudentQuery(student, query)
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (res.ok) {
        const data = await res.json()
        setStudents((current) =>
          sortStudentsByUsername([
            ...current,
            enrichStudent({ ...data, _count: { submissions: 0 } }),
          ])
        )
        setForm({ username: '', password: '', name: '', className: '' })
        setShowForm(false)
        setImportResult(null)
      } else {
        const error = await res.json()
        alert(error.error || '创建失败')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个学生吗？所有相关提交也将被删除。')) return

    const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setStudents((current) => current.filter((student) => student.id !== id))
      setRecentPointRecords((current) =>
        current.filter((record) => record.studentId !== id)
      )
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }

    setImporting(true)
    setImportResult(null)

    try {
      const body = new FormData()
      body.append('file', file)

      const res = await fetch('/api/users/import', {
        method: 'POST',
        body,
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '导入失败')
        if (data.skippedRows) {
          setImportResult({
            createdCount: 0,
            updatedCount: 0,
            skippedCount: data.skippedRows.length,
            skippedRows: data.skippedRows,
          })
        }
        return
      }

      const createdStudents = (data.createdStudents as Omit<Student, '_count'>[]).map(
        (student) => ({
          ...student,
          _count: { submissions: 0 },
        })
      )
      const updatedStudents = data.updatedStudents as Omit<Student, '_count'>[]

      setStudents((current) => {
        const studentMap = new Map(
          current.map((student) => [student.id, student] as const)
        )

        for (const student of createdStudents) {
          studentMap.set(student.id, enrichStudent(student))
        }

        for (const student of updatedStudents) {
          const existing = studentMap.get(student.id)
          if (!existing) {
            continue
          }

          studentMap.set(
            student.id,
            enrichStudent({
              ...existing,
              ...student,
              _count: existing._count,
            })
          )
        }

        return sortStudentsByUsername(Array.from(studentMap.values()))
      })

      setImportResult({
        createdCount: data.createdCount,
        updatedCount: data.updatedCount,
        skippedCount: data.skippedCount,
        skippedRows: data.skippedRows,
      })
    } finally {
      setImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const submitPointChange = async (
    student: StudentWithSearchIndex,
    delta: number,
    reason: string
  ) => {
    setPointLoadingId(student.id)

    try {
      const res = await fetch('/api/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          delta,
          reason,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '积分操作失败')
        return
      }

      setStudents((current) =>
        current.map((item) =>
          item.id === student.id
            ? { ...item, pointBalance: data.student.pointBalance }
            : item
        )
      )
      setRecentPointRecords((current) => [data.record, ...current].slice(0, 20))
    } finally {
      setPointLoadingId(null)
    }
  }

  const handleQuickPointAction = async (
    student: StudentWithSearchIndex,
    delta: number
  ) => {
    const actionText = delta > 0 ? `加 ${delta} 分` : `扣 ${Math.abs(delta)} 分`
    const reason = window.prompt(
      `给 ${student.name}（${student.username}）${actionText}，请输入理由：`
    )

    if (!reason?.trim()) {
      return
    }

    await submitPointChange(student, delta, reason.trim())
  }

  const handleCustomPointAction = async (student: StudentWithSearchIndex) => {
    const deltaInput = window.prompt(
      `请输入 ${student.name}（${student.username}）的加减分值，正数为加分，负数为扣分：`
    )

    if (!deltaInput?.trim()) {
      return
    }

    const delta = Number.parseInt(deltaInput.trim(), 10)
    if (!Number.isInteger(delta) || delta === 0) {
      alert('分值必须是非 0 整数')
      return
    }

    const reason = window.prompt('请输入本次加分/扣分理由：')
    if (!reason?.trim()) {
      return
    }

    await submitPointChange(student, delta, reason.trim())
  }

  const handleResetPassword = async (student: StudentWithSearchIndex) => {
    if (!confirm(`确定将 ${student.name}（${student.username}）的密码重置为 111111 吗？`)) {
      return
    }

    setResettingPasswordId(student.id)

    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: student.id,
          action: 'RESET_PASSWORD',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '重置密码失败')
        return
      }

      alert(`已将 ${student.name} 的密码重置为 ${data.password}`)
    } finally {
      setResettingPasswordId(null)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          {showForm ? '取消' : '添加学生'}
        </button>
        <label className="cursor-pointer bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700">
          {importing ? '导入中...' : 'Excel批量导入'}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImport}
            disabled={importing}
          />
        </label>
        <span className="text-sm text-gray-500">
          首行需包含：姓名 / 用户名，新增账号需密码，可选班级；已存在用户名会回填班级
        </span>
      </div>

      <div className="mb-6 rounded-lg bg-white p-4 shadow">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          快速检索
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入姓名、班级、音序（如 zs）、用户名或学号后三位"
            className="min-w-[280px] flex-1 rounded-lg border px-3 py-2"
          />
          <button
            type="button"
            onClick={() => setQuery('')}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
          >
            清空
          </button>
          <span className="text-sm text-gray-500">
            当前结果 {filteredStudents.length} / {students.length}
          </span>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">添加学生</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm font-medium mb-1">姓名</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">用户名</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">密码</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">班级</label>
              <input
                type="text"
                value={form.className}
                onChange={(e) => setForm({ ...form, className: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="例如：计科2301"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? '创建中...' : '创建'}
          </button>
        </form>
      )}

      {importResult && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-green-700">成功导入 {importResult.createdCount} 条</span>
            <span className="text-blue-700">更新班级 {importResult.updatedCount} 条</span>
            <span className="text-amber-700">跳过 {importResult.skippedCount} 条</span>
          </div>
          {importResult.skippedRows.length > 0 && (
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              {importResult.skippedRows.slice(0, 10).map((row) => (
                <p key={`${row.rowNumber}-${row.username}`}>
                  第 {row.rowNumber} 行
                  {row.username ? `（${row.username}）` : ''}
                  ：{row.reason}
                </p>
              ))}
              {importResult.skippedRows.length > 10 && (
                <p>其余 {importResult.skippedRows.length - 10} 条跳过记录未展开显示。</p>
              )}
            </div>
          )}
        </div>
      )}

      {filteredStudents.length === 0 ? (
        <div className="text-center text-gray-500 py-12">暂无学生</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">姓名</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">用户名</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">班级</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">积分</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">提交数</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">创建时间</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredStudents.map((student) => (
                <tr key={student.id}>
                  <td className="px-6 py-4">{student.name}</td>
                  <td className="px-6 py-4">{student.username}</td>
                  <td className="px-6 py-4">{student.className || '-'}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${
                        student.pointBalance >= 0
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {formatOneDecimal(student.pointBalance)}
                    </span>
                  </td>
                  <td className="px-6 py-4">{student._count.submissions}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(student.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleQuickPointAction(student, 1)}
                        disabled={pointLoadingId === student.id}
                        className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        +1
                      </button>
                      <button
                        onClick={() => handleQuickPointAction(student, 2)}
                        disabled={pointLoadingId === student.id}
                        className="rounded bg-emerald-700 px-3 py-1 text-sm text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        +2
                      </button>
                      <button
                        onClick={() => handleQuickPointAction(student, -1)}
                        disabled={pointLoadingId === student.id}
                        className="rounded bg-amber-600 px-3 py-1 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        -1
                      </button>
                      <button
                        onClick={() => handleCustomPointAction(student)}
                        disabled={pointLoadingId === student.id}
                        className="rounded bg-slate-600 px-3 py-1 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
                      >
                        自定义
                      </button>
                      <button
                        onClick={() => handleResetPassword(student)}
                        disabled={resettingPasswordId === student.id}
                        className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {resettingPasswordId === student.id ? '重置中...' : '重置密码'}
                      </button>
                      <button
                        onClick={() => handleDelete(student.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">最近积分记录</h2>
          <span className="text-sm text-gray-500">保留最近 20 条</span>
        </div>
        {recentPointRecords.length === 0 ? (
          <div className="text-sm text-gray-500">暂无积分记录</div>
        ) : (
          <div className="space-y-3">
            {recentPointRecords.map((record) => (
              <div
                key={record.id}
                className="flex flex-col gap-2 rounded-lg border border-gray-100 px-4 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {record.student.name}（{record.studentUsername}）
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                        record.delta > 0
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {formatSignedOneDecimal(record.delta)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{record.reason}</p>
                </div>
                <div className="text-sm text-gray-500">
                  <div>
                    {new Date(record.occurredAt).toLocaleString()}
                  </div>
                  <div>
                    来源：
                    {record.source === 'MOBILE_API' ? '手机接口' : '网页后台'}
                    {record.operator?.name || record.operatorLabel
                      ? ` / 操作人：${record.operator?.name || record.operatorLabel}`
                      : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
