import { createI18n } from 'vue-i18n'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import enLocales from './locales/en.json'
import zhLocales from './locales/zh-CN.json'

const LOCALE_KEY = 'kungeskill:locale'
const SUPPORTED_LOCALES = ['en', 'zh-CN'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const elementPlusLocales: Record<SupportedLocale, typeof zhCn | typeof en> = {
  en,
  'zh-CN': zhCn,
}

function detectLocale(): SupportedLocale {
  // 1. Check localStorage
  try {
    const stored = localStorage.getItem(LOCALE_KEY)
    if (stored && SUPPORTED_LOCALES.includes(stored as SupportedLocale)) {
      return stored as SupportedLocale
    }
  } catch {
    // localStorage unavailable
  }

  // 2. Check browser locale
  const browser = navigator.language
  if (browser.startsWith('zh')) return 'zh-CN'
  return 'en'
}

const defaultLocale = detectLocale()

const i18n = createI18n({
  locale: defaultLocale,
  fallbackLocale: 'en',
  messages: {
    en: enLocales,
    'zh-CN': zhLocales,
  },
  legacy: false,
})

export function setAppLocale(locale: SupportedLocale): void {
  i18n.global.locale.value = locale
  try {
    localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    // localStorage unavailable
  }
}

export { i18n as default }
