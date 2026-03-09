'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Assignment {
  id: string
  title: string
  description: string
  dueDate: string | null
  createdAt: string
  _count: { submissions: number }
}

interface Props {
  assignments: Assignment[]
}

export default function AssignmentManager({ assignments: initialAssignments }: Props) {
  const [assignments, setAssignments] = useState(initialAssignments)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', description: '', dueDate: '' })
  const [loading, setLoading] = useState(false)

  const resetForm = () => {
    setForm({ title: '', description: '', dueDate: '' })
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (assignment: Assignment) => {
    setForm({
      title: assignment.title,
      description: assignment.description,
      dueDate: assignment.dueDate ? assignment.dueDate.split('T')[0] : '',
    })
    setEditingId(assignment.id)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = '/api/assignments'
      const method = editingId ? 'PUT' : 'POST'
      const body = editingId
        ? { id: editingId, ...form }
        : form

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const data = await res.json()
        if (editingId) {
          setAssignments(assignments.map(a => 
            a.id === editingId ? { ...a, ...data } : a
          ))
        } else {
          setAssignments([{ ...data, _count: { submissions: 0 } }, ...assignments])
        }
        resetForm()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个作业吗？所有相关提交也将被删除。')) return

    const res = await fetch(`/api/assignments?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAssignments(assignments.filter(a => a.id !== id))
    }
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          {showForm ? '取消' : '新建作业'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? '编辑作业' : '新建作业'}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">标题</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">描述</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg h-32"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">截止日期（可选）</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? '保存中...' : '保存'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
              >
                取消
              </button>
            </div>
          </div>
        </form>
      )}

      {assignments.length === 0 ? (
        <div className="text-center text-gray-500 py-12">暂无作业</div>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{assignment.title}</h3>
                  <p className="text-gray-600 mt-2 line-clamp-2">{assignment.description}</p>
                  <div className="flex gap-4 mt-3 text-sm text-gray-500">
                    <span>提交数: {assignment._count.submissions}</span>
                    <span>创建: {new Date(assignment.createdAt).toLocaleDateString()}</span>
                    {assignment.dueDate && (
                      <span>截止: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/teacher/submissions?assignmentId=${assignment.id}`}
                    className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
                  >
                    查看提交
                  </Link>
                  <button
                    onClick={() => handleEdit(assignment)}
                    className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 text-sm"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(assignment.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
