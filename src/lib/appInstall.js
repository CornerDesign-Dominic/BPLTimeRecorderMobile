export function installationPlatform({ userAgent = '', maxTouchPoints = 0 } = {}) {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return 'ios'
  return /Android/i.test(userAgent) ? 'android' : 'desktop'
}

export function isStandalone(displayMode = false, navigatorStandalone = false) {
  return displayMode === true || navigatorStandalone === true
}

// An accepted browser prompt is not proof that installation has finished.
// Only appinstalled or standalone display confirms the installed state.
export async function requestInstallation(event) {
  if (typeof event?.prompt !== 'function') throw new Error('Installation wird über das Browsermenü gestartet.')
  const result = await event.prompt()
  const choice = event.userChoice ? await event.userChoice : result
  return choice?.outcome === 'accepted' ? 'requested' : 'dismissed'
}
