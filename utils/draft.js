export const createDraftScheduler = (saveFn, delay = 400) => {
  let timer = null

  const flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    return saveFn()
  }

  const schedule = () => {
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      timer = null
      saveFn()
    }, delay)
  }

  const cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return {
    schedule,
    flush,
    cancel
  }
}
