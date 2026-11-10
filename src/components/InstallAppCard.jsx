import { useState } from 'react'

export default function InstallAppCard({ installation }) {
  const [hidden, setHidden] = useState(false)
  if (hidden) return <button className="text-button install-reopen" type="button" onClick={() => setHidden(false)}>App auf dem Startbildschirm</button>
  const { installed, canPrompt, busy, message, platform, install } = installation
  return <section className="card install-card" aria-labelledby="install-app-title">
    <div className="section-head"><h2 id="install-app-title">Auf dem Startbildschirm</h2><button className="icon-button" type="button" aria-label="Installationshinweis ausblenden" onClick={() => setHidden(true)}>×</button></div>
    {installed ? <p>Du verwendest die installierte App oder dein Browser hat die Installation bestätigt.</p> : <>
      <p>Einmal hinzufügen – danach öffnest du „Meine Zeit“ wie eine App, ohne die Adresse erneut einzugeben.</p>
      {canPrompt && <button className="button" type="button" disabled={busy} onClick={install}>{busy ? 'Browserdialog wird geöffnet …' : 'App installieren'}</button>}
      {platform === 'ios' ? <ol className="install-steps"><li>Öffne diese Seite auf deinem iPhone oder iPad in Safari.</li><li>Tippe auf <strong>Teilen</strong> und anschließend auf <strong>Zum Home-Bildschirm</strong>.</li><li>Bestätige mit <strong>Hinzufügen</strong>.</li></ol>
        : platform === 'android' ? <p className="muted small">{canPrompt ? 'Alternativ: ' : ''}Öffne das Browsermenü ⋮ und wähle <strong>App installieren</strong> oder <strong>Zum Startbildschirm hinzufügen</strong>. Fehlt der Menüpunkt, öffne die Seite in Chrome oder Edge.</p>
          : <p className="muted small">Nutze das Installationssymbol in der Adressleiste oder „App installieren“ im Browsermenü, wenn dein Browser diese Funktion anbietet. Am Handy kannst du den QR-Code im Drehpunkt-Webdashboard scannen.</p>}
    </>}
    {message && <p className="feedback" role="status">{message}</p>}
    <p className="muted small">Für Offline-Stempeln die App zuerst einmal mit Internet öffnen. Urlaub und Korrekturen benötigen Internet.</p>
  </section>
}
