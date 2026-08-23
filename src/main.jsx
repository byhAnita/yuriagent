import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from './registerSW.js'
import { installDebug } from './tools/debugLog.js'

// Console handles for a hand-played bug report. Every model call is recorded
// either way; `yuri.debug()` only decides whether they also print as they go.
installDebug()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerSW()
