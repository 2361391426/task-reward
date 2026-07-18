const UNIQUE_CONFLICT_COLUMNS = {
  login_attempts: ['login_key'],
  user_risk_flags: ['user_id'],
  user_platform_cooldowns: ['user_id', 'platform'],
  user_identity_links: ['identity_type', 'identity_hash']
}

const stripQuotes = (value) => String(value || '').replace(/[`"]/g, '').trim()

const replaceQuestionPlaceholders = (sql) => {
  let output = ''
  let index = 1
  let inSingleQuote = false
  let inDoubleQuote = false
  let inBacktick = false

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i]
    const prev = sql[i - 1]

    if (char === "'" && !inDoubleQuote && !inBacktick && prev !== '\\') {
      inSingleQuote = !inSingleQuote
      output += char
      continue
    }

    if (char === '"' && !inSingleQuote && !inBacktick && prev !== '\\') {
      inDoubleQuote = !inDoubleQuote
      output += char
      continue
    }

    if (char === '`' && !inSingleQuote && !inDoubleQuote) {
      inBacktick = !inBacktick
      output += char
      continue
    }

    if (char === '?' && !inSingleQuote && !inDoubleQuote && !inBacktick) {
      output += `$${index}`
      index += 1
      continue
    }

    output += char
  }

  return output
}

const replaceDateFormat = (sql) => {
  return sql.replace(/DATE_FORMAT\s*\(\s*([^,]+?)\s*,\s*'([^']+)'\s*\)/gi, (_, expr, fmt) => {
    const pgFmt = fmt
      .replace(/%Y/g, 'YYYY')
      .replace(/%m/g, 'MM')
      .replace(/%d/g, 'DD')
      .replace(/%H/g, 'HH24')
      .replace(/%i/g, 'MI')
      .replace(/%s/g, 'SS')
    return `TO_CHAR(${expr.trim()}, '${pgFmt}')`
  })
}

const splitAssignments = (value) => {
  const items = []
  let current = ''
  let depth = 0
  let inSingleQuote = false

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i]
    const prev = value[i - 1]

    if (char === "'" && prev !== '\\') {
      inSingleQuote = !inSingleQuote
    }

    if (!inSingleQuote) {
      if (char === '(') depth += 1
      if (char === ')') depth = Math.max(depth - 1, 0)
      if (char === ',' && depth === 0) {
        items.push(current.trim())
        current = ''
        continue
      }
    }

    current += char
  }

  if (current.trim()) {
    items.push(current.trim())
  }

  return items
}

const replaceOnDuplicateKeyUpdate = (sql) => {
  const match = sql.match(/^(\s*INSERT\s+INTO\s+[`"]?([A-Za-z0-9_]+)[`"]?\s*\([^)]+\)\s*VALUES\s*\([^)]+\))\s+ON\s+DUPLICATE\s+KEY\s+UPDATE\s+([\s\S]+)$/i)
  if (!match) {
    return sql
  }

  const insertPrefix = match[1]
  const tableName = stripQuotes(match[2]).toLowerCase()
  const updateClause = match[3].trim().replace(/;$/, '')
  const conflictColumns = UNIQUE_CONFLICT_COLUMNS[tableName]

  if (!conflictColumns) {
    return sql
  }

  const updates = splitAssignments(updateClause).map((assignment) => {
    const pair = assignment.match(/^([A-Za-z0-9_`"]+)\s*=\s*(.+)$/)
    if (!pair) {
      return assignment
    }

    const left = stripQuotes(pair[1])
    const right = pair[2].trim()
    const valuesMatch = right.match(/^VALUES\s*\(\s*([A-Za-z0-9_`"]+)\s*\)$/i)
    if (valuesMatch) {
      return `${left} = EXCLUDED.${stripQuotes(valuesMatch[1])}`
    }

    return `${left} = ${right}`
  })

  return `${insertPrefix} ON CONFLICT (${conflictColumns.join(', ')}) DO UPDATE SET ${updates.join(', ')}`
}

const translateMysqlToPostgres = (sql) => {
  let nextSql = String(sql || '').trim()

  nextSql = nextSql.replace(/IFNULL\s*\(/gi, 'COALESCE(')
  nextSql = replaceDateFormat(nextSql)
  nextSql = nextSql.replace(/DATE_SUB\s*\(\s*NOW\s*\(\s*\)\s*,\s*INTERVAL\s*\?\s*HOUR\s*\)/gi, "NOW() - ($1 * INTERVAL '1 hour')")
  nextSql = nextSql.replace(/DATE_SUB\s*\(\s*NOW\s*\(\s*\)\s*,\s*INTERVAL\s*(\d+)\s*HOUR\s*\)/gi, "NOW() - ($1 * INTERVAL '1 hour')")
  nextSql = replaceOnDuplicateKeyUpdate(nextSql)
  nextSql = nextSql.replace(/`([A-Za-z0-9_]+)`/g, '"$1"')
  nextSql = replaceQuestionPlaceholders(nextSql)

  return nextSql
}

const isSelectSql = (sql) => /^\s*(SELECT|WITH|SHOW|DESCRIBE|EXPLAIN)\b/i.test(sql)
const isInsertSql = (sql) => /^\s*INSERT\b/i.test(sql)
const isWriteSql = (sql) => /^\s*(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE)\b/i.test(sql)

const ensureReturningId = (sql) => {
  if (!isInsertSql(sql) || /\bRETURNING\b/i.test(sql)) {
    return sql
  }

  return `${sql} RETURNING id`
}

module.exports = {
  ensureReturningId,
  isInsertSql,
  isSelectSql,
  isWriteSql,
  replaceQuestionPlaceholders,
  translateMysqlToPostgres
}
