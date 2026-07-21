<template>
  <view class="page">
    <view class="hero">
      <text class="hero-title">用户协议</text>
      <text class="hero-subtitle">诺斯马丁体验项目服务规则</text>
      <text class="hero-date">生效日期：2026年7月21日</text>
    </view>

    <view class="card">
      <view class="section">
        <text class="section-title">一、协议范围</text>
        <text class="paragraph">
          本协议适用于您使用诺斯马丁小程序及相关服务，包括浏览体验项目、参与项目、提交凭证、查看审核结果、积分记录、奖励结算、意见反馈等功能。
        </text>
      </view>

      <view class="section">
        <text class="section-title">二、账号与授权</text>
        <text class="paragraph">
          您需要通过微信授权登录后使用参与项目、提交凭证、奖励结算等功能。您应确保提供的昵称、头像、手机号、微信号、订单号、地址及其他资料真实、准确、完整。
        </text>
      </view>

      <view class="section">
        <text class="section-title">三、体验项目规则</text>
        <text class="paragraph">
          您参与项目前应仔细阅读项目详情、平台要求、提交材料和完成时限。项目开始后，请按页面提示在规定时间内提交凭证；超时未提交的，系统可释放项目名额并限制当日继续参与。
        </text>
        <text class="paragraph">
          已审核通过的项目将归档到您的参与记录；被驳回的项目可按驳回原因重新编辑并再次提交，具体是否通过以审核结果为准。
        </text>
      </view>

      <view class="section">
        <text class="section-title">四、禁止行为</text>
        <text class="paragraph">
          您不得提交虚假截图、冒用他人资料、重复参与同平台限制项目、使用多账号规避风控、篡改订单信息、上传违法违规内容，或以其他方式影响平台正常运营。
        </text>
        <text class="paragraph">
          同一手机号、微信账号、设备、网络地址、收货地址或其他可识别信息高度一致的，平台可视为同一用户进行参与资格判断。
        </text>
      </view>

      <view class="section">
        <text class="section-title">五、积分与奖励结算</text>
        <text class="paragraph">
          平台根据项目规则、提交凭证和审核结果记录体验奖励积分。若发现异常参与、材料不完整、订单信息不符或违反规则，平台有权驳回、扣回或暂停相关积分结算。
        </text>
      </view>

      <view class="section">
        <text class="section-title">六、内容与资料</text>
        <text class="paragraph">
          您上传的图片、视频、文字、订单信息等资料仅用于项目审核、风控校验、客服处理、争议核验和依法留存。您应确保上传内容不侵犯他人合法权益。
        </text>
      </view>

      <view class="section">
        <text class="section-title">七、服务调整</text>
        <text class="paragraph">
          平台可根据业务、合规、风控或系统维护需要调整项目规则、功能入口、审核标准和服务内容。重大变化将以页面提示、公告或其他合理方式告知。
        </text>
      </view>

      <view class="section">
        <text class="section-title">八、责任限制</text>
        <text class="paragraph">
          因不可抗力、网络异常、第三方平台限制、用户设备环境、信息填写错误等原因导致服务中断、审核延迟或资料无法提交的，平台将在合理范围内协助处理。
        </text>
      </view>

      <view class="section">
        <text class="section-title">九、联系我们</text>
        <text class="paragraph">
          如您对本协议、项目规则、积分记录或个人资料有疑问，可通过小程序“意见反馈”提交问题，平台将在核实后处理。
        </text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'UserAgreementPage'
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
  background: linear-gradient(135deg, #111827, #475569);
  color: #fff;
  box-shadow: 0 18rpx 38rpx rgba(15, 23, 42, 0.16);
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
