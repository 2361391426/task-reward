const path = require('path')
const fs = require('fs')

require('dotenv').config({
  path: fs.existsSync(path.join(__dirname, '.env.scf'))
    ? path.join(__dirname, '.env.scf')
    : path.join(__dirname, '.env')
})

const app = require('./app')

const port = Number(process.env.PORT || 9000)

app.listen(port, '0.0.0.0', () => {
  console.log(`TaskReward API 已启动，监听端口 ${port}`)
})
