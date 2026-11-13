// Visible controls for exercising online state and light/dark layouts. Test only.
const controls = document.createElement('div')
controls.className = 'qa-controls'
controls.innerHTML = '<strong>Lokaler Test · keine Echtdaten</strong><button id="qa-network">Offline simulieren</button><button id="qa-theme">Dunkel</button>'
document.body.append(controls)
const style = document.createElement('style')
style.textContent = '.qa-controls{position:fixed;top:0;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:8px;background:#e8d6a4;color:#241d0c;padding:5px;font:10px Arial;z-index:100}.qa-controls button{font:10px Arial;padding:4px}.app{padding-top:35px}html.qa-dark{--primary:#96c8ee;--accent:#66b8f1;--text:#d8e5ef;--muted:#95a7b8;--surface:#192735;--border:#2c3d4f;--soft:#20364b;--danger:#f2a396;--success:#89cdb0;background:#101b26;color:var(--text);color-scheme:dark}html.qa-dark .bar-target{background:#293f53}html.qa-dark .bar-work{background:#416d92}'
document.head.append(style)
if (localStorage.getItem('qa-dark') === 'true') document.documentElement.classList.add('qa-dark')
let connected = true
Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => connected })
document.getElementById('qa-network').onclick = event => { connected = !connected; event.target.textContent = connected ? 'Offline simulieren' : 'Wieder online'; window.dispatchEvent(new Event(connected ? 'online' : 'offline')) }
document.getElementById('qa-theme').onclick = () => { const dark = document.documentElement.classList.toggle('qa-dark'); localStorage.setItem('qa-dark', String(dark)) }
