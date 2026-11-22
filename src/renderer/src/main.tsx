import '@fontsource/pixelify-sans/400.css'
import '@fontsource/pixelify-sans/600.css'
import './styles/global.css'
import { createRoot } from 'react-dom/client'
import { App } from './App'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

// No <StrictMode>: it mounts effects twice in development, which would boot
// the Phaser game twice. Everything else follows StrictMode-safe patterns.
createRoot(container).render(<App />)
