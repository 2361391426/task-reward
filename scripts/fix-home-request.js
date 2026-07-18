const fs = require('fs')
const path = require('path')

const filePath = path.join(process.cwd(), 'pages/index/index.vue')
let content = fs.readFileSync(filePath, 'utf8')

content = content.replace(
  /      try \{\r?\n        const taskLoaded = await this\.loadTasks\(true\)\r?\n        const visibleTaskIds = this\.taskList\.map\(task => String\(task\.id\)\)\.filter\(Boolean\)\r?\n        const \[statsLoaded, submissionsLoaded\] = await Promise\.all\(\[\r?\n          this\.loadUserInfo\(\),\r?\n          this\.loadUserStats\(\),\r?\n          this\.loadMySubmissions\(true, visibleTaskIds\)\r?\n        \]\)\r?\n        if \(\(!taskLoaded \|\| !statsLoaded \|\| !submissionsLoaded\) && !this\.loadError\) \{\r?\n          this\.loadError = '.*?'\r?\n        \}\r?\n      \} catch \(error\) \{\r?\n        console\.error\('.*?', error\)\r?\n        this\.loadError = this\.loadError \|\| '.*?'\r?\n      \}/s,
  `      try {
        const taskLoaded = await this.loadTasks(true)
        const visibleTaskIds = this.taskList.map(task => String(task.id)).filter(Boolean)
        const hasToken = this.isLoggedIn()
        let statsLoaded = true
        let submissionsLoaded = true

        if (hasToken) {
          const [userLoaded, earningsLoaded, submissionLoaded] = await Promise.all([
            this.loadUserInfo(),
            this.loadUserStats(),
            this.loadMySubmissions(true, visibleTaskIds)
          ])
          statsLoaded = userLoaded && earningsLoaded
          submissionsLoaded = submissionLoaded
        } else {
          this.userInfo = {}
          this.totalEarnings = 0
          this.submissionMap = {}
        }

        if (!taskLoaded && !this.loadError) {
          this.loadError = '首页任务加载失败，请重试'
        } else if (hasToken && (!statsLoaded || !submissionsLoaded) && !this.loadError) {
          this.loadError = '部分数据加载失败，请稍后重试'
        }
      } catch (error) {
        console.error('刷新首页失败', error)
        this.loadError = this.loadError || '首页加载失败，请重试'
      }`
)

content = content.replace(
  /        this\.loadError = this\.loadError \|\| '.*?'/g,
  "        this.loadError = this.loadError || '首页任务加载失败，请重试'"
)

content = content.replace(
  /    async loadUserStats\(\) \{\r?\n      try \{\r?\n/,
  `    async loadUserStats() {
      try {
        if (!this.isLoggedIn()) {
          this.totalEarnings = 0
          return true
        }
`
)

content = content.replace(
  /    async loadUserInfo\(\) \{\r?\n      try \{\r?\n/,
  `    async loadUserInfo() {
      try {
        if (!this.isLoggedIn()) {
          this.userInfo = {}
          return true
        }
`
)

content = content.replace(
  /      \} catch \(error\) \{\r?\n        console\.error\('.*?', error\)\r?\n        return false\r?\n      \}\r?\n    \},\r?\n\r?\n    async loadMySubmissions\(forceRefresh = false, targetTaskIds = \[\]\) \{\r?\n      try \{/s,
  `      } catch (error) {
        console.error('加载用户信息失败', error)
        if (!this.isLoggedIn()) {
          this.userInfo = {}
          return true
        }
        return false
      }
    },

    async loadMySubmissions(forceRefresh = false, targetTaskIds = []) {
      try {`
)

content = content.replace(
  /        this\.loadError = this\.loadError \|\| '.*?'/g,
  "        this.loadError = this.loadError || '首页提交记录加载失败，请重试'"
)

content = content.replace(
  /        if \(!targetTaskIds \|\| targetTaskIds\.length === 0\) \{\r?\n          this\.submissionMap = \{\}\r?\n        \}\r?\n        this\.loadError = this\.loadError \|\| '.*?'\r?\n        return false\r?\n      \}/s,
  `        if (!targetTaskIds || targetTaskIds.length === 0) {
          this.submissionMap = {}
        }
        this.loadError = this.loadError || '首页提交记录加载失败，请重试'
        return false
      }`
)

fs.writeFileSync(filePath, content, 'utf8')
