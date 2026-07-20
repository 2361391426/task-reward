const crypto = require('crypto')
const fs = require('fs')
const https = require('https')
const path = require('path')

const endpoint = 'scf.tencentcloudapi.com'
const service = 'scf'
const action = 'UpdateFunctionCode'
const version = '2018-04-16'

const getEnv = (...names) => {
  for (const name of names) {
    if (process.env[name]) return process.env[name]
  }
  return ''
}

const secretId = getEnv('TENCENT_SECRET_ID', 'TENCENTCLOUD_SECRET_ID')
const secretKey = getEnv('TENCENT_SECRET_KEY', 'TENCENTCLOUD_SECRET_KEY')
const region = getEnv('TENCENT_REGION', 'TENCENTCLOUD_REGION') || 'ap-guangzhou'
const functionName = getEnv('SCF_FUNCTION_NAME') || 'taskreward'
const namespace = getEnv('SCF_NAMESPACE') || 'default'
const handler = getEnv('SCF_HANDLER') || 'scf_bootstrap'
const zipPath = getEnv('SCF_ZIP_PATH') || path.join(__dirname, '..', 'dist-scf', 'taskreward-scf.zip')

const fail = (message) => {
  console.error(message)
  process.exit(1)
}

if (!secretId || !secretKey) {
  fail('缺少腾讯云密钥，请在 GitHub Secrets 配置 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY。')
}

if (!fs.existsSync(zipPath)) {
  fail(`未找到函数压缩包：${zipPath}，请先执行 npm run build:scf。`)
}

const zipFile = fs.readFileSync(zipPath).toString('base64')
const payload = JSON.stringify({
  FunctionName: functionName,
  Namespace: namespace,
  Handler: handler,
  CodeSource: 'ZipFile',
  ZipFile: zipFile,
  Publish: 'TRUE'
})

const sha256 = (message, encoding = 'hex') => crypto.createHash('sha256').update(message).digest(encoding)
const hmac = (key, message, encoding) => crypto.createHmac('sha256', key).update(message).digest(encoding)

const timestamp = Math.floor(Date.now() / 1000)
const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${endpoint}\nx-tc-action:${action.toLowerCase()}\n`
const signedHeaders = 'content-type;host;x-tc-action'
const canonicalRequest = [
  'POST',
  '/',
  '',
  canonicalHeaders,
  signedHeaders,
  sha256(payload)
].join('\n')

const credentialScope = `${date}/${service}/tc3_request`
const stringToSign = [
  'TC3-HMAC-SHA256',
  timestamp,
  credentialScope,
  sha256(canonicalRequest)
].join('\n')

const secretDate = hmac(`TC3${secretKey}`, date)
const secretService = hmac(secretDate, service)
const secretSigning = hmac(secretService, 'tc3_request')
const signature = hmac(secretSigning, stringToSign, 'hex')

const authorization = [
  'TC3-HMAC-SHA256',
  [
    `Credential=${secretId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(', ')
].join(' ')

const requestOptions = {
  hostname: endpoint,
  method: 'POST',
  path: '/',
  headers: {
    Authorization: authorization,
    'Content-Type': 'application/json; charset=utf-8',
    Host: endpoint,
    'X-TC-Action': action,
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Version': version,
    'X-TC-Region': region
  }
}

const req = https.request(requestOptions, (res) => {
  const chunks = []
  res.on('data', chunk => chunks.push(chunk))
  res.on('end', () => {
    const bodyText = Buffer.concat(chunks).toString('utf8')
    let result
    try {
      result = JSON.parse(bodyText)
    } catch (error) {
      console.error('腾讯云返回内容无法解析：')
      console.error(bodyText)
      process.exit(1)
    }

    if (result.Response && result.Response.Error) {
      console.error(`腾讯云函数发布失败：${result.Response.Error.Code}`)
      console.error(result.Response.Error.Message)
      process.exit(1)
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      console.error(`腾讯云函数发布失败，HTTP 状态码：${res.statusCode}`)
      console.error(bodyText)
      process.exit(1)
    }

    console.log(`腾讯云函数发布成功：${functionName}`)
    console.log(`地域：${region}，命名空间：${namespace}`)
    console.log(`请求编号：${result.Response && result.Response.RequestId ? result.Response.RequestId : '-'}`)
  })
})

req.on('error', (error) => {
  console.error('腾讯云函数发布请求失败：')
  console.error(error.message)
  process.exit(1)
})

req.write(payload)
req.end()
