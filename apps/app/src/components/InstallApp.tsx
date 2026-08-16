import { useEffect, useState } from 'react'
import { Check, Download, Share } from 'lucide-react'
import { Button, useLanguage } from '@guaca/ui'
import { appCopy } from '../lib/copy'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Store-free distribution: Chrome fires beforeinstallprompt once the
 * manifest and service worker qualify, and this button is what turns that
 * into a home-screen app. iOS never fires it — Safari only installs through
 * its Share sheet — so iPhones get the instruction instead of a dead button.
 *
 * Renders nothing when already installed or inside the native wrapper.
 */
export function InstallApp({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { lang } = useLanguage()
  const t = appCopy[lang].install
  const [event, setEvent] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    if (ua.includes('GuacaApp/')) return
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }
    // iOS Safari supports installation but not the prompt event.
    setIsIos(/iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua))

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) {
    return (
      <p className={`flex items-center justify-center gap-1.5 text-[11px] font-black ${tone === 'dark' ? 'text-white/70' : 'text-guaca-teal'}`}>
        <Check className="h-3.5 w-3.5" /> {t.installed}
      </p>
    )
  }

  if (isIos) {
    return (
      <div className={`rounded-2xl px-4 py-3 text-center ${tone === 'dark' ? 'bg-white/10 text-white' : 'bg-guaca-teal/8 text-guaca-ink'}`}>
        <p className="flex items-center justify-center gap-1.5 text-[12px] font-black">
          <Share className="h-3.5 w-3.5" /> {t.iosTitle}
        </p>
        <p className={`mt-1 text-[10px] font-semibold leading-relaxed ${tone === 'dark' ? 'text-white/70' : 'text-guaca-ink/55'}`}>
          {t.iosBody}
        </p>
      </div>
    )
  }

  if (!event) return null

  return (
    <div>
      <Button
        type="button"
        onClick={() => {
          void event.prompt()
          void event.userChoice.finally(() => setEvent(null))
        }}
        className={`h-11 w-full rounded-2xl text-xs font-black ${tone === 'dark' ? 'bg-white text-guaca-ocean-deep hover:bg-white/90' : 'bg-guaca-teal text-white hover:bg-guaca-teal-dark'}`}
      >
        <Download className="mr-2 h-4 w-4" /> {t.cta}
      </Button>
      <p className={`mt-1.5 text-center text-[10px] font-semibold ${tone === 'dark' ? 'text-white/55' : 'text-guaca-ink/45'}`}>
        {t.note}
      </p>
    </div>
  )
}
