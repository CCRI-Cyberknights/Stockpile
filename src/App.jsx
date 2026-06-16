import './App.css'
import { useState, useEffect } from 'react'
import SessionPage from './pages/session.jsx'
import GatePage from './pages/gate.jsx'
import DashboardPage from './pages/dashboard.jsx'
import { dom, networking } from './util'

function App() {
  const [page, setPage] = useState('gate')
  const [appState, setAppState] = useState({
    selectedModel: null,
    allModels: []
  })

//   setAppState((prev) => ({
//   ...prev,
//   selectedModel: 'new-model-name',
// }))

  useEffect(() => {
    networking.NET_getLocalModels().then((result) => {
      let models = {}

      for (const instance of result["models"]) {
        models[instance.name] = {name: instance.name, size: instance.details.parameter_size}
      }

      console.log('appStateModels = ', models)
      setAppState((prev) => ({
        ...prev,
        allModels: models
      }))

    })
  }, [])

  if (page === 'session') {
    return <SessionPage appState={appState} setAppState={setAppState} />
  } else if (page === 'dashboard') {
    return <DashboardPage
      appState={appState}
      setAppState={setAppState}
      onContinue={() => setPage('session')}
    />
  } else {
    return <GatePage onContinue={() => setPage('dashboard')} />
  }
}

export default App
