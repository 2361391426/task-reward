const store = new Map()

const get = (key) => {
  const item = store.get(key)
  if (!item) return null
  if (item.expiresAt <= Date.now()) {
    store.delete(key)
    return null
  }
  return item.value
}

const set = (key, value, ttlMs = 10000) => {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  })
}

const clearByPrefix = (prefix) => {
  for (const key of store.keys()) {
    if (String(key).startsWith(prefix)) {
      store.delete(key)
    }
  }
}

module.exports = {
  get,
  set,
  clearByPrefix
}
