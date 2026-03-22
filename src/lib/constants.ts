export const ASSIGNMENT_STATUS = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
} as const

export const POINT_SOURCE = {
  WEB: 'WEB',
  MOBILE_API: 'MOBILE_API',
} as const

export const QUESTION_TYPES = {
  SINGLE: '单选题',
  MULTIPLE: '多选题',
  JUDGE: '判断题',
  BLANK: '填空题',
  SHORT: '简答题',
} as const

export const PRACTICE_MODES = {
  QUESTION: 'QUESTION',
  PAPER: 'PAPER',
} as const

export const PRACTICE_STATUSES = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  REVIEW: 'REVIEW',
  ENDED: 'ENDED',
} as const

export const UNASSIGNED_CLASS_FILTER = '__UNASSIGNED__'
