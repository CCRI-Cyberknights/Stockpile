import './App.css'
import { useState, useEffect } from 'react'
import SessionPage from './pages/session.jsx'
import GatePage from './pages/gate.jsx'
import DashboardPage from './pages/dashboard.jsx'
import { networking } from './util'

function createSessionId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `session-${Date.now()}`
}

function App() {
  const [page, setPage] = useState('gate')
  const [appState, setAppState] = useState({
    selectedModel: null,
    allModels: {},
    targetUrl: '',
    sessionId: createSessionId(),
  })

//   setAppState((prev) => ({
//   ...prev,
//   selectedModel: 'new-model-name',
// }))
  useEffect(() => {
    console.log('appState changed:', appState)
  }, [appState])

  useEffect(() => {
    networking.NET_getLocalModels().then((result) => {
      const models = {}
      let firstModel = ''

      for (const instance of result.models ?? []) {
        models[instance.name] = { name: instance.name, size: instance.details.parameter_size }
        if (!firstModel) {
          firstModel = instance.name
        }
      }

      setAppState((prev) => ({
        ...prev,
        allModels: models,
        selectedModel: prev.selectedModel || firstModel || '',
      }))
    })
  }, [])

  function handleDashboardContinue(targetUrl) {
    setAppState((prev) => ({
      ...prev,
      targetUrl,
      sessionId: createSessionId(),
    }))

    setPage('session')
  }

  if (page === 'session') {
    return <SessionPage appState={appState} setAppState={setAppState} />
  } else if (page === 'dashboard') {
    return <DashboardPage
      appState={appState}
      setAppState={setAppState}
      onContinue={handleDashboardContinue}
    />
  } else {
    return <GatePage onContinue={() => setPage('dashboard')} />
  }
}

export default App
