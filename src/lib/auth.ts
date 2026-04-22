import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { redirect } from 'next/navigation'
import { SESSION_CLIENT_TYPES, type SessionClientType } from '@/lib/session-client'

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  return user
}

export async function requireTeacher() {
  const user = await requireAuth()
  if (user.role !== 'TEACHER') {
    redirect('/student')
  }
  return user
}

interface RequireStudentOptions {
  clientType?: SessionClientType
}

export async function requireStudent(options?: RequireStudentOptions) {
  const user = await requireAuth()
  if (user.role !== 'STUDENT') {
    redirect('/teacher')
  }

  if (options?.clientType && user.clientType !== options.clientType) {
    redirect('/student')
  }

  return user
}

export async function requireGodotStudent() {
  return requireStudent({ clientType: SESSION_CLIENT_TYPES.GODOT })
}
