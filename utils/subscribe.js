const TEMPLATE_IDS = [
  import.meta.env.VITE_WECHAT_TEMPLATE_TASK_STARTED,
  import.meta.env.VITE_WECHAT_TEMPLATE_TASK_REVIEW_APPROVED,
  import.meta.env.VITE_WECHAT_TEMPLATE_TASK_REVIEW_REJECTED,
  import.meta.env.VITE_WECHAT_TEMPLATE_WITHDRAWAL_PROCESSED,
  import.meta.env.VITE_WECHAT_TEMPLATE_TASK_TIMEOUT
].filter(Boolean)

let lastPromptAt = 0
const PROMPT_COOLDOWN_MS = 60 * 1000

export const requestTaskSubscribeMessage = async () => {
  if (typeof uni.requestSubscribeMessage !== 'function') {
    return false
  }

  if (!TEMPLATE_IDS.length) {
    return false
  }

  const now = Date.now()
  if (now - lastPromptAt < PROMPT_COOLDOWN_MS) {
    return false
  }
  lastPromptAt = now

  return new Promise((resolve) => {
    uni.requestSubscribeMessage({
      tmplIds: TEMPLATE_IDS,
      success: () => resolve(true),
      fail: () => resolve(false)
    })
  })
}
