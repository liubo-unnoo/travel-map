import { createContext, useContext, useState } from 'react'
import type { LangCode } from './countries'
import { UI_STRINGS } from './ui'
import type { UIStrings } from './ui'

interface LangContextValue {
  lang: LangCode
  setLang: (l: LangCode) => void
  t: UIStrings
}

const LangContext = createContext<LangContextValue>({
  lang: 'zh',
  setLang: () => {},
  t: UI_STRINGS.zh,
})

const LANG_STORAGE_KEY = 'travel-map-lang'

function detectInitialLang(): LangCode {
  const saved = localStorage.getItem(LANG_STORAGE_KEY) as LangCode | null
  if (saved && saved in UI_STRINGS) return saved
  const browserLang = navigator.language.toLowerCase()
  if (browserLang.startsWith('zh')) return 'zh'
  if (browserLang.startsWith('ja')) return 'ja'
  if (browserLang.startsWith('ko')) return 'ko'
  if (browserLang.startsWith('es')) return 'es'
  if (browserLang.startsWith('fr')) return 'fr'
  return 'en'
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(detectInitialLang)

  const setLang = (l: LangCode) => {
    localStorage.setItem(LANG_STORAGE_KEY, l)
    setLangState(l)
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t: UI_STRINGS[lang] }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
