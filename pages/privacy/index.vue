<template>
  <view class="page">
    <view class="hero">
      <text class="hero-title">隐私条款</text>
      <text class="hero-subtitle">诺斯马丁个人信息保护说明</text>
      <text class="hero-date">生效日期：2026年7月21日</text>
    </view>

    <view class="card">
      <view class="section">
        <text class="section-title">一、我们收集的信息</text>
        <text class="paragraph">
          为提供登录、项目参与、凭证提交、审核、积分记录和反馈处理服务，我们可能收集您的微信授权信息、手机号、昵称、头像、微信号、活动记录号、收货地址、设备标识、网络地址、提交截图、视频和反馈内容。
        </text>
      </view>

      <view class="section">
        <text class="section-title">二、信息使用目的</text>
        <text class="paragraph">
          我们使用上述信息用于账号识别、参与资格校验、项目审核、风控识别、积分记录、异常处理、客服回复、系统安全保障和依法合规留存。
        </text>
      </view>

      <view class="section">
        <text class="section-title">三、图片与视频资料</text>
        <text class="paragraph">
          您上传的截图、图片或视频仅用于完成项目审核和争议核验。草稿资料、超时未提交资料、已驳回资料和已通过资料会按系统保留规则定期清理。
        </text>
      </view>

      <view class="section">
        <text class="section-title">四、信息共享</text>
        <text class="paragraph">
          我们不会出售您的个人信息。仅在完成项目审核、系统存储、消息通知、合规要求、争议处理或依法配合监管时，向必要的服务提供方或有权机关提供必要信息。
        </text>
      </view>

      <view class="section">
        <text class="section-title">五、信息安全</text>
        <text class="paragraph">
          我们会采用访问控制、身份校验、上传限制、日志审计、定期清理等措施保护您的资料安全。请妥善保管账号信息，不要向他人转让或共享账号。
        </text>
      </view>

      <view class="section">
        <text class="section-title">六、您的权利</text>
        <text class="paragraph">
          您可以在小程序内查看和修改昵称、头像、手机号等资料。如需查询、更正、删除其他个人信息，或注销相关服务数据，可通过“意见反馈”提交申请。
        </text>
      </view>

      <view class="section">
        <text class="section-title">七、未成年人保护</text>
        <text class="paragraph">
          若您为未成年人，请在监护人同意和指导下使用本服务。监护人发现未成年人信息需要更正或删除的，可通过意见反馈联系我们处理。
        </text>
      </view>

      <view class="section">
        <text class="section-title">八、条款更新</text>
        <text class="paragraph">
          本条款可能根据业务、法律法规或平台规则调整。更新后将在小程序页面展示，您继续使用服务即表示理解并接受更新内容。
        </text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'PrivacyPolicyPage'
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 28rpx;
  background: #f6f7f9;
  box-sizing: border-box;
}

.hero {
  padding: 34rpx 30rpx;
  border-radius: 28rpx;
  background: linear-gradient(135deg, #0f766e, #334155);
  color: #fff;
  box-shadow: 0 18rpx 38rpx rgba(15, 118, 110, 0.16);
}

.hero-title {
  display: block;
  font-size: 42rpx;
  font-weight: 800;
}

.hero-subtitle,
.hero-date {
  display: block;
  margin-top: 14rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.78);
}

.card {
  margin-top: 24rpx;
  padding: 30rpx;
  border-radius: 28rpx;
  background: #fff;
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.06);
}

.section + .section {
  margin-top: 34rpx;
}

.section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 800;
  color: #111827;
}

.paragraph {
  display: block;
  margin-top: 14rpx;
  font-size: 27rpx;
  line-height: 1.78;
  color: #475569;
}
</style>
