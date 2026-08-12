import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'en' | 'es'

const STORAGE_KEY = 'guaca-lang'

const LanguageContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void }>({
  lang: 'en',
  setLang: () => {},
})

/** Saved choice wins; otherwise the browser language; otherwise English. */
function initialLang(): Lang {
  if (typeof window === 'undefined') return 'en'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === 'en' || saved === 'es') return saved
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = (next: Lang) => {
    setLangState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return useContext(LanguageContext)
}
