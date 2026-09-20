import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { GameProvider } from './state/gameStore'
import './styles/base.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/levels.css'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <GameProvider>
      <App />
    </GameProvider>
  </StrictMode>,
)
