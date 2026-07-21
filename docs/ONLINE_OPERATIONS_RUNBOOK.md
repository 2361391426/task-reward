# 诺斯马丁上线运营手册

## 每次发布前

1. 确认 GitHub Secrets 已配置完整：
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `CRYPTO_KEY`
   - `CRYPTO_IV`
   - `WECHAT_APPID`
   - `WECHAT_SECRET`
   - `R2_ENDPOINT`
   - `R2_BUCKET`
   - `R2_PUBLIC_URL`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `TASK_LIFECYCLE_SWEEP_SECRET`
   - `TENCENT_SECRET_ID`
   - `TENCENT_SECRET_KEY`
   - `PRODUCTION_API_BASE_URL`

2. 本地执行构建检查：

```bash
npm run check:release
cd task-reward-backend
npm run check
npm run build:scf
```

3. 微信小程序后台确认合法域名：
   - `request` 合法域名：腾讯云函数 HTTPS 域名
   - `uploadFile` 合法域名：腾讯云函数 HTTPS 域名
   - `downloadFile` 合法域名：R2 公网图片域名

## 发布后检查

1. 健康检查：

```bash
cd task-reward-backend
set API_BASE=https://你的腾讯云函数域名/api
set SMOKE_SKIP_AUTH=true
npm run smoke
```

2. 完整冒烟测试：

```bash
cd task-reward-backend
set API_BASE=https://你的腾讯云函数域名/api
set SMOKE_MERCHANT_USERNAME=管理员账号
set SMOKE_MERCHANT_PASSWORD=管理员密码
npm run smoke
```

3. 重点人工测试：
   - 用户登录后能看到昵称、头像、手机号状态。
   - 任务大厅能加载最新发布项目。
   - 用户开始项目后进入“我的参与”。
   - 提交截图后计时器停止，商家后台出现待审核。
   - 商家审核通过/驳回后，小程序状态同步。
   - 头像、提交截图、反馈图片上传后能正常预览。

## 每日运营

1. 看商家后台首页待办：
   - 待审核提交
   - 超时未审核
   - 待处理奖励结算
   - 待发布项目

2. 看风控用户：
   - 同 IP、同设备、同账号、同地址命中的用户要人工确认。
   - 误判用户由管理员解除标记。

3. 看反馈管理：
   - 新反馈当天处理。
   - 处理后给用户回复，必要时记录到发布计划。

## 每周运营

1. 执行上传文件兜底清理：

```bash
cd task-reward-backend
npm run cleanup:uploads:weekly
```

2. 检查 R2 用量：
   - 草稿图 12 小时后可清。
   - 超时未提交当天清。
   - 已驳回保留 3 天。
   - 已通过保留 90 天。
   - 实付款截图保留作证据，不清理。

3. 检查数据库：
   - 任务总数、提交总数、待审核数量是否异常增长。
   - 商家余额是否异常。
   - 审计日志是否存在失败操作高峰。

## 线上故障处理

### 小程序提示网络错误

1. 访问 `/api/health` 确认后端可用。
2. 微信后台确认合法域名没有写错，不能带路径，只填域名。
3. 腾讯云函数日志里查看是否有 500。
4. 如果是图片加载失败，检查 R2 公网域名是否能打开。

### 发布任务失败

1. 看商家余额是否足够。
2. 看商家角色是否有 `owner` 或 `operator` 权限。
3. 看任务时间是否使用北京时间并且结束时间晚于发布时间。
4. 看腾讯云函数日志中的 `/api/merchant/tasks` 错误。

### 用户无法参与项目

1. 看用户是否已经是发布账号，发布账号不能参与自己的项目。
2. 看任务是否被他人 1 小时内占用。
3. 看用户是否触发风控标记。
4. 看该平台三个月冷却限制是否命中。

### 上传失败

1. 头像必须小于 3MB。
2. 普通截图必须小于 5MB。
3. 文件必须是真实图片内容。
4. 检查 R2 密钥、桶名、公网地址是否一致。

## 回滚策略

1. GitHub Actions 发布失败：不影响当前线上版本，修复后重新推送。
2. 腾讯云函数发布后异常：在腾讯云函数控制台切回上一版本。
3. 小程序版本异常：微信公众平台撤回体验版或回滚到上一个线上版本。
4. 数据库结构异常：先停止发布，再根据最近一次备份或迁移脚本人工修复。
