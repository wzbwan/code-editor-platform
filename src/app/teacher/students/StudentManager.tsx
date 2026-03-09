'use client'

import { useRef, useState } from 'react'

interface Student {
  id: string
  username: string
  name: string
  createdAt: string
  _count: { submissions: number }
}

interface Props {
  students: Student[]
}

interface SkippedRow {
  rowNumber: number
  username: string
  reason: string
}

interface ImportResult {
  createdCount: number
  skippedCount: number
  skippedRows: SkippedRow[]
}

export default function StudentManager({ students: initialStudents }: Props) {
  const [students, setStudents] = useState(initialStudents)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', name: '' })
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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
        setStudents((current) => [{ ...data, _count: { submissions: 0 } }, ...current])
        setForm({ username: '', password: '', name: '' })
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

      if (createdStudents.length > 0) {
        setStudents((current) => [...createdStudents, ...current])
      }

      setImportResult({
        createdCount: data.createdCount,
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
          首行需包含：姓名 / 用户名 / 密码
        </span>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">添加学生</h2>
          <div className="grid grid-cols-3 gap-4">
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

      {students.length === 0 ? (
        <div className="text-center text-gray-500 py-12">暂无学生</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">姓名</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">用户名</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">提交数</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">创建时间</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {students.map((student) => (
                <tr key={student.id}>
                  <td className="px-6 py-4">{student.name}</td>
                  <td className="px-6 py-4">{student.username}</td>
                  <td className="px-6 py-4">{student._count.submissions}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(student.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(student.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
