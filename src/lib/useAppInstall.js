import { useEffect, useRef, useState } from 'react'
import { installationPlatform, isStandalone, requestInstallation } from './appInstall.js'

const standaloneNow = () => isStandalone(window.matchMedia?.('(display-mode: standalone)').matches, navigator.standalone)

export function useAppInstall() {
  const pendingPrompt = useRef(null)
  const installationConfirmed = useRef(standaloneNow())
  const [installed, setInstalled] = useState(standaloneNow)
  const [canPrompt, setCanPrompt] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const platform = installationPlatform(navigator)

  useEffect(() => {
    const display = window.matchMedia?.('(display-mode: standalone)')
    const confirmInstalled = () => {
      installationConfirmed.current = true
      pendingPrompt.current = null
      setInstalled(true)
      setCanPrompt(false)
      setMessage('Die App ist installiert. Du findest sie auf deinem Startbildschirm.')
    }
    const onPrompt = event => {
      if (standaloneNow()) return
      event.preventDefault()
      pendingPrompt.current = event
      setCanPrompt(true)
      setMessage('')
    }
    const onDisplayMode = () => {
      if (standaloneNow()) confirmInstalled()
      else { installationConfirmed.current = false; setInstalled(false) }
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', confirmInstalled)
    display?.addEventListener?.('change', onDisplayMode)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', confirmInstalled)
      display?.removeEventListener?.('change', onDisplayMode)
    }
  }, [])

  async function install() {
    const prompt = pendingPrompt.current
    if (!prompt || busy) return
    pendingPrompt.current = null
    setCanPrompt(false)
    setBusy(true)
    try {
      const outcome = await requestInstallation(prompt)
      if (!installationConfirmed.current && !standaloneNow()) setMessage(outcome === 'requested'
        ? 'Installation im Browser angefordert. Folge den weiteren Hinweisen des Browsers.'
        : 'Installation abgebrochen. Du kannst sie später über das Browsermenü erneut starten.')
    } catch {
      setMessage('Der Installationsdialog konnte nicht geöffnet werden. Bitte nutze das Browsermenü.')
    } finally { setBusy(false) }
  }

  return { installed, canPrompt, busy, message, platform, install }
}
