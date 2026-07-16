'use client'

import { useRef, useState } from 'react'
import { formatAppDate, formatAppDateTime } from '@/lib/date-format'
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
  pyPointBalance: number
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
  const [pyPointLoadingId, setPyPointLoadingId] = useState<string | null>(null)
  const [resettingPasswordId, setResettingPasswordId] = useState<string | null>(null)
  const [recentPointRecords, setRecentPointRecords] = useState(initialRecentPointRecords)
  const [recordModalStudent, setRecordModalStudent] =
    useState<StudentWithSearchIndex | null>(null)
  const [studentPointRecords, setStudentPointRecords] = useState<PointRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const filteredStudents = students.filter((student) =>
    matchesStudentQuery(student, query)
  )
  const exportQuery = query.trim()
    ? `?${new URLSearchParams({ query: query.trim() }).toString()}`
    : ''

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
      if (recordModalStudent?.id === id) {
        setRecordModalStudent(null)
        setStudentPointRecords([])
      }
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
      if (recordModalStudent?.id === student.id) {
        setStudentPointRecords((current) => [data.record, ...current])
      }
    } finally {
      setPointLoadingId(null)
    }
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

  const handleOpenPointRecords = async (student: StudentWithSearchIndex) => {
    setRecordModalStudent(student)
    setStudentPointRecords([])
    setRecordsLoading(true)

    try {
      const params = new URLSearchParams({
        studentId: student.id,
        take: 'all',
      })
      const res = await fetch(`/api/points?${params.toString()}`)
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '积分记录加载失败')
        setRecordModalStudent(null)
        return
      }

      setStudentPointRecords(data)
    } finally {
      setRecordsLoading(false)
    }
  }

  const handlePyPointGrant = async (student: StudentWithSearchIndex) => {
    const amountInput = window.prompt(
      `请输入要给 ${student.name}（${student.username}）增加的 Py点数量：`
    )

    if (!amountInput?.trim()) {
      return
    }

    const delta = Number.parseInt(amountInput.trim(), 10)
    if (!Number.isInteger(delta) || delta <= 0) {
      alert('Py点数量必须是正整数')
      return
    }

    const reason =
      window.prompt('请输入本次增加 Py点的理由：')?.trim() || '教师手动发放Py点'

    setPyPointLoadingId(student.id)

    try {
      const res = await fetch('/api/py-points', {
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
        alert(data.error || 'Py点发放失败')
        return
      }

      const updatedStudent = data.students?.[0]
      setStudents((current) =>
        current.map((item) =>
          item.id === student.id
            ? { ...item, pyPointBalance: updatedStudent?.pyPointBalance ?? item.pyPointBalance + delta }
            : item
        )
      )
    } finally {
      setPyPointLoadingId(null)
    }
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
        <a
          href={`/api/users/export${exportQuery}`}
          className="rounded-lg bg-violet-600 px-4 py-2 text-white hover:bg-violet-700"
        >
          导出学生积分
        </a>
        <a
          href={`/api/challenges/points-export${exportQuery}`}
          className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700"
        >
          导出闯关积分明细
        </a>
        <span className="text-sm text-gray-500">
          首行需包含：姓名 / 用户名，新增账号需密码，可选班级；导出会跟随当前检索结果
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
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Py点</th>
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
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
                      {student.pyPointBalance}
                    </span>
                  </td>
                  <td className="px-6 py-4">{student._count.submissions}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatAppDate(student.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        onClick={() => handleCustomPointAction(student)}
                        disabled={pointLoadingId === student.id}
                        className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {pointLoadingId === student.id ? '处理中...' : '加/减分'}
                      </button>
                      <button
                        onClick={() => handleOpenPointRecords(student)}
                        disabled={recordsLoading && recordModalStudent?.id === student.id}
                        className="rounded bg-slate-600 px-3 py-1 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
                      >
                        记录
                      </button>
                      <button
                        onClick={() => handlePyPointGrant(student)}
                        disabled={pyPointLoadingId === student.id}
                        className="rounded bg-sky-600 px-3 py-1 text-sm text-white hover:bg-sky-700 disabled:opacity-50"
                      >
                        {pyPointLoadingId === student.id ? '发放中...' : '+Py点'}
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
                    {formatAppDateTime(record.occurredAt)}
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

      {recordModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {recordModalStudent.name} 的积分记录
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  用户名：{recordModalStudent.username}
                  {recordModalStudent.className ? ` / 班级：${recordModalStudent.className}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecordModalStudent(null)}
                className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
              >
                关闭
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-4">
              {recordsLoading ? (
                <div className="py-10 text-center text-sm text-gray-500">
                  正在加载积分记录...
                </div>
              ) : studentPointRecords.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">
                  暂无积分记录
                </div>
              ) : (
                <div className="space-y-3">
                  {studentPointRecords.map((record) => (
                    <div
                      key={record.id}
                      className="rounded-lg border border-gray-100 px-4 py-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                record.delta > 0
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {formatSignedOneDecimal(record.delta)}
                            </span>
                            <span className="text-sm text-gray-500">
                              {formatAppDateTime(record.occurredAt)}
                            </span>
                          </div>
                          <p className="mt-2 break-words text-sm text-gray-800">
                            {record.reason}
                          </p>
                        </div>
                        <div className="shrink-0 text-sm text-gray-500 sm:text-right">
                          <div>
                            来源：
                            {record.source === 'MOBILE_API' ? '手机接口' : '网页后台'}
                          </div>
                          {(record.operator?.name || record.operatorLabel) && (
                            <div>
                              操作人：{record.operator?.name || record.operatorLabel}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
