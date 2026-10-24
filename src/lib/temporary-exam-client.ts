export async function examRequest<T>(url: string, body?: object, keepalive = false): Promise<T> {
  const encoded = body ? JSON.stringify(body) : undefined
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(url, body ? {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: encoded,
      keepalive: keepalive && new Blob([encoded!]).size < 60000, signal: controller.signal,
    } : { cache: 'no-store', signal: controller.signal })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '请求失败，请重试')
    return data as T
  } catch (error) {
    if (controller.signal.aborted) throw new Error('网络请求超时，请检查连接后重试')
    throw error
  } finally { clearTimeout(timeout) }
}
export const examDate = (value: string | Date) => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
export const examStatus = (status: string, endsAt: string) => new Date(endsAt).getTime() <= Date.now() ? '已结束' : ({ DRAFT: '待开考', ACTIVE: '考试中', ENDED: '已结束' }[status] || status)
