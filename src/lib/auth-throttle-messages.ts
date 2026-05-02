export const LOGIN_RETRY_ERROR_PREFIX = 'LOGIN_RETRY_AFTER:'

export function createLoginRetryError(retryAfterSeconds: number) {
  return `${LOGIN_RETRY_ERROR_PREFIX}${Math.max(1, Math.ceil(retryAfterSeconds))}`
}

export function parseLoginRetryError(error: string | null | undefined) {
  if (!error) {
    return null
  }

  let normalizedError = error
  try {
    normalizedError = decodeURIComponent(error)
  } catch {
    normalizedError = error
  }
  normalizedError = normalizedError.replace(/^Error:\s*/, '')
  const prefixIndex = normalizedError.indexOf(LOGIN_RETRY_ERROR_PREFIX)
  if (prefixIndex === -1) {
    return null
  }

  const retryAfterSeconds = Number(
    normalizedError.slice(prefixIndex + LOGIN_RETRY_ERROR_PREFIX.length)
  )
  if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) {
    return null
  }

  return Math.ceil(retryAfterSeconds)
}

export function formatLoginRetryMessage(retryAfterSeconds: number) {
  return `用户名或密码错误，请 ${Math.max(1, Math.ceil(retryAfterSeconds))} 秒后再试`
}
