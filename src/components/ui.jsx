import { useEffect, useRef } from 'react'
export function Icon({ name, size = 24 }) {
  const paths = { trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></>, play: <path d="m9 5 11 7-11 7Z"/>, pause: <><path d="M5 8h12v7a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5Z"/><path d="M17 9h2a3 3 0 0 1 0 6h-2M8 2v3m5-3v3"/></>, exit: <><path d="M10 4H4v16h6m4-13 5 5-5 5M8 12h11"/></>, clock: <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>, calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18m-13 4h2m4 0h2"/></>, user: <><circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/></>, back: <path d="m14 5-7 7 7 7"/>, forward: <path d="m10 5 7 7-7 7"/>, refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.3 8a8 8 0 0 1 13-3L20 8M4 16l1.7 3a8 8 0 0 0 13-3"/></>, check: <path d="m5 12 4 4L19 6"/>, edit: <><path d="m15 4 5 5-11 11H4v-5Z"/><path d="m12 7 5 5"/></> }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={name === 'play' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.clock}</svg>
}
export function Modal({ title, children, onClose }) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement
    const root = ref.current
    root.focus()
    const key = event => {
      if (event.key === 'Escape') closeRef.current()
      if (event.key === 'Tab') {
        const items = [...root.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(item => !item.disabled)
        if (!items.length) { event.preventDefault(); return }
        if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === root)) { event.preventDefault(); items.at(-1).focus() }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus() }
      }
    }
    document.addEventListener('keydown', key)
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = old; previous?.focus() }
  }, [])
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex="-1" ref={ref}><div className="section-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Schließen">×</button></div>{children}</section></div>
}
export function Notice({ children, danger = false }) { return <div className={`notice ${danger ? 'notice--danger' : ''}`} role={danger ? 'alert' : 'status'}>{children}</div> }
