import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import 'leaflet/dist/leaflet.css'

import App from './app/App'
import { AuthProvider } from './store/AuthContext'
import './styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)