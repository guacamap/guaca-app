import type { ReactNode } from 'react'
import { InfoProvider, LanguageProvider } from '@guaca/ui'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <InfoProvider>
      <LanguageProvider>{children}</LanguageProvider>
    </InfoProvider>
  )
}
