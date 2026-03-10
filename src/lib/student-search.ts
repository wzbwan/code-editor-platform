import { pinyin } from 'pinyin-pro'

export interface StudentSearchTarget {
  name: string
  username: string
}

export interface StudentSearchIndex {
  name: string
  username: string
  namePinyin: string
  nameInitials: string
  usernameSuffix: string
}

function compact(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

export function getUsernameSuffix(username: string) {
  const match = username.trim().match(/(\d{3})$/)
  return match ? match[1] : ''
}

export function buildStudentSearchIndex(
  student: StudentSearchTarget
): StudentSearchIndex {
  return {
    name: student.name.trim().toLowerCase(),
    username: student.username.trim().toLowerCase(),
    namePinyin: compact(pinyin(student.name, { toneType: 'none' })),
    nameInitials: compact(
      pinyin(student.name, { toneType: 'none', pattern: 'first' })
    ),
    usernameSuffix: getUsernameSuffix(student.username),
  }
}

export function matchesStudentQuery(
  student: StudentSearchTarget | (StudentSearchTarget & { searchIndex: StudentSearchIndex }),
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return true
  }

  const compactQuery = compact(normalizedQuery)
  const searchIndex =
    'searchIndex' in student ? student.searchIndex : buildStudentSearchIndex(student)

  return (
    searchIndex.name.includes(normalizedQuery) ||
    searchIndex.username.includes(normalizedQuery) ||
    searchIndex.namePinyin.includes(compactQuery) ||
    searchIndex.nameInitials.includes(compactQuery) ||
    searchIndex.usernameSuffix.includes(compactQuery)
  )
}
