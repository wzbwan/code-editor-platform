export const SESSION_CLIENT_TYPES = {
  WEB: 'WEB',
  GODOT: 'GODOT',
} as const

export type SessionClientType =
  (typeof SESSION_CLIENT_TYPES)[keyof typeof SESSION_CLIENT_TYPES]

export function isSessionClientType(value: string | null | undefined): value is SessionClientType {
  return value === SESSION_CLIENT_TYPES.WEB || value === SESSION_CLIENT_TYPES.GODOT
}

export function isGodotClientType(value: string | null | undefined) {
  return value === SESSION_CLIENT_TYPES.GODOT
}
