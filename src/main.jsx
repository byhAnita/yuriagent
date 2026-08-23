import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from './registerSW.js'
import { installDebug } from './tools/debugLog.js'
import { maybeInstallEruda } from './tools/eruda.js'

// Console handles for a hand-played bug report. Every model call is recorded
// either way; `yuri.debug()` only decides whether they also print as they go.
installDebug()

// ...and a console to type them into, on a phone that has none. Opt-in via
// `?debug=1`, dynamically imported, and deliberately not awaited - the game
// renders while the chunk arrives, and it renders anyway if it never does.
maybeInstallEruda()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerSW()
