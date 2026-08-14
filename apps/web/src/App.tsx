import { InfoProvider, LanguageProvider } from '@guaca/ui'
import { MarketingLanding } from './components/MarketingLanding'

/** apps/web is the marketing site only (§4.7) — the product lives in
 *  apps/app, served at app.guaca.live. */
export default function App() {
  return (
    <InfoProvider>
      <LanguageProvider>
        <MarketingLanding />
      </LanguageProvider>
    </InfoProvider>
  )
}
