const crypto = require('crypto')
const fs = require('fs')
const https = require('https')
const path = require('path')

const endpoint = 'scf.tencentcloudapi.com'
const service = 'scf'
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
const timeout = Math.max(3, Math.min(Number(getEnv('SCF_TIMEOUT') || 30), 900))
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

const sha256 = (message, encoding = 'hex') => crypto.createHash('sha256').update(message).digest(encoding)
const hmac = (key, message, encoding) => crypto.createHmac('sha256', key).update(message).digest(encoding)

const createSignedOptions = (action, payload) => {
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

  return {
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
}

const callTencentCloud = (action, params, label) => {
  const payload = JSON.stringify(params)
  const requestOptions = createSignedOptions(action, payload)

  return new Promise((resolve, reject) => {
    const req = https.request(requestOptions, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const bodyText = Buffer.concat(chunks).toString('utf8')
        let result
        try {
          result = JSON.parse(bodyText)
        } catch (error) {
          reject(new Error(`${label}返回内容无法解析：${bodyText}`))
          return
        }

        if (result.Response && result.Response.Error) {
          reject(new Error(`${label}失败：${result.Response.Error.Code}\n${result.Response.Error.Message}`))
          return
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`${label}失败，HTTP 状态码：${res.statusCode}\n${bodyText}`))
          return
        }

        resolve(result)
      })
    })

    req.on('error', (error) => {
      reject(new Error(`${label}请求失败：${error.message}`))
    })

    req.write(payload)
    req.end()
  })
}

const main = async () => {
  try {
    const configResult = await callTencentCloud('UpdateFunctionConfiguration', {
      FunctionName: functionName,
      Namespace: namespace,
      Timeout: timeout
    }, '腾讯云函数配置更新')

    console.log(`腾讯云函数超时时间已设置为 ${timeout} 秒`)
    console.log(`配置请求编号：${configResult.Response && configResult.Response.RequestId ? configResult.Response.RequestId : '-'}`)

    const codeResult = await callTencentCloud('UpdateFunctionCode', {
      FunctionName: functionName,
      Namespace: namespace,
      Handler: handler,
      CodeSource: 'ZipFile',
      ZipFile: zipFile,
      Publish: 'TRUE'
    }, '腾讯云函数代码发布')

    console.log(`腾讯云函数发布成功：${functionName}`)
    console.log(`地域：${region}，命名空间：${namespace}`)
    console.log(`发布请求编号：${codeResult.Response && codeResult.Response.RequestId ? codeResult.Response.RequestId : '-'}`)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}

main()
