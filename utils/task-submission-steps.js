import { REVIEW_SAFE_MODE } from './compliance.js'

const SOCIAL_PLATFORMS = new Set(['douyin', 'xiaohongshu'])

const STEP_DEFINITIONS = [
  {
    id: 1,
    key: 'search',
    name: '搜索结果凭证',
    count: 1,
    fieldNames: ['screenshot_search']
  },
  {
    id: 2,
    key: 'shop',
    name: '页面浏览凭证',
    count: 3,
    fieldNames: ['screenshot_shop_1', 'screenshot_shop_2', 'screenshot_shop_3']
  },
  {
    id: 3,
    key: 'follow',
    name: '互动凭证',
    count: 1,
    fieldNames: ['screenshot_follow'],
    socialOnly: true,
    highRisk: true
  },
  {
    id: 4,
    key: 'share',
    name: '补充凭证',
    count: 1,
    fieldNames: ['screenshot_share'],
    socialOnly: true,
    highRisk: true
  },
  {
    id: 5,
    key: 'detail',
    name: '详情页凭证',
    count: 1,
    fieldNames: ['screenshot_detail']
  },
  {
    id: 6,
    key: 'cart',
    name: '体验过程凭证',
    count: 1,
    fieldNames: ['screenshot_cart']
  },
  {
    id: 7,
    key: 'paid_order',
    name: '交易凭证',
    count: 1,
    fieldNames: ['screenshot_paid_order'],
    highRisk: true
  }
]

export const normalizePlatform = (platform) => {
  const value = String(platform || '').trim()
  if (['douyin', 'xiaohongshu', 'taobao', 'jd'].includes(value)) {
    return value
  }
  return 'taobao'
}

export const isSocialPlatform = (platform) => SOCIAL_PLATFORMS.has(normalizePlatform(platform))

export const getSubmissionStepDefinitions = (platform) => {
  const social = isSocialPlatform(platform)
  return STEP_DEFINITIONS
    .filter((item) => {
      if (REVIEW_SAFE_MODE && item.highRisk) return false
      return social || !item.socialOnly
    })
    .map(({ socialOnly, highRisk, ...item }) => item)
}

const cloneImages = (images = []) => {
  if (!Array.isArray(images)) return []
  return images.filter(Boolean).slice()
}

export const hydrateUploadSteps = (platform, draftSteps = []) => {
  const definitions = getSubmissionStepDefinitions(platform)
  const draftByKey = new Map()
  const draftById = new Map()

  draftSteps.forEach((step, index) => {
    if (!step || typeof step !== 'object') return
    if (step.key) {
      draftByKey.set(String(step.key), step)
    }
    if (step.id !== undefined && step.id !== null) {
      draftById.set(String(step.id), step)
    }
    draftById.set(String(index), step)
  })

  return definitions.map((definition, index) => {
    const draftStep = draftByKey.get(definition.key) || draftById.get(String(definition.id)) || draftSteps[index] || {}
    return {
      ...definition,
      images: cloneImages(draftStep.images).slice(0, definition.count)
    }
  })
}

export const createEmptyUploadSteps = (platform) => getSubmissionStepDefinitions(platform).map((definition) => ({
  ...definition,
  images: []
}))

export const buildSubmissionScreenshotSections = (submission = {}, platform = submission.platform) => {
  const definitions = getSubmissionStepDefinitions(platform)
  return definitions.map((definition, index) => ({
    ...definition,
    label: `${index + 1}. ${definition.name}`,
    images: definition.fieldNames.map((fieldName) => submission[fieldName]).filter(Boolean)
  }))
}
