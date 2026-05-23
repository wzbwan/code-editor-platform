export const ASSIGNMENT_STATUS = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
} as const

export const POINT_SOURCE = {
  WEB: 'WEB',
  MOBILE_API: 'MOBILE_API',
  CHALLENGE: 'CHALLENGE',
  CLASS_DEFENSE: 'CLASS_DEFENSE',
} as const

export const PY_POINT_SOURCE = {
  WEB: 'WEB',
  GODOT_AI_HELP: 'GODOT_AI_HELP',
  PRACTICE: 'PRACTICE',
} as const

export const QUESTION_TYPES = {
  SINGLE: '单选题',
  CODE_READING: '代码理解题',
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

export const EXAM_STATUSES = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
} as const

export const EXAM_STUDENT_STATUSES = {
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  AUTO_SUBMITTED: 'AUTO_SUBMITTED',
} as const

export const EXAM_EVENT_TYPES = {
  FOCUS_LOST: 'focus_lost',
  FOCUS_RETURNED: 'focus_returned',
  HEARTBEAT: 'heartbeat',
} as const

export const TRAINING_SET_STATUSES = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const

export const TRAINING_ATTEMPT_STATUSES = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const

export const UNASSIGNED_CLASS_FILTER = '__UNASSIGNED__'
