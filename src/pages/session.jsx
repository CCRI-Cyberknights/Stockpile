import { useEffect, useState } from 'react'

const starterPrompt = [
  'You are assisting with a capture-the-flag practice session.',
  'Confirm that you are online and ready to inspect page structure, controls, and suspicious DOM behavior.',
].join(' ')

function formatActionSummary(action) {
  if (!action || typeof action !== 'object') {
    return ''
  }

  switch (action.type) {
    case 'click':
      return `Clicked ${action.target}${action.button && action.button !== 'left' ? ` with the ${action.button} mouse button` : ''}.`

    case 'fill':
      return `Filled ${action.target} with ${JSON.stringify(action.text)}${action.submit ? ' and submitted the field' : ''}.`

    case 'type':
      return `Typed ${JSON.stringify(action.text)} into the active element.`

    case 'press':
      return `Pressed ${action.key}.`

    case 'select':
      return `Selected ${JSON.stringify(action.value)} in ${action.target}.`

    case 'hover':
      return `Hovered ${action.target}.`

    case 'check':
      return `Checked ${action.target}.`

    case 'uncheck':
      return `Unchecked ${action.target}.`

    case 'goto':
      return `Navigated to ${action.url}.`

    case 'go_back':
      return 'Went back to the previous page.'

    case 'go_forward':
      return 'Went forward to the next page.'

    case 'reload':
      return 'Reloaded the current page.'

    case 'snapshot':
      return 'Captured a fresh browser snapshot.'

    default:
      return ''
  }
}

function SessionPage({ appState }) {
  const [prompt, setPrompt] = useState(starterPrompt)
  const [response, setResponse] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [browserState, setBrowserState] = useState(null)
  const [browserError, setBrowserError] = useState('')
  const [isBrowserLoading, setIsBrowserLoading] = useState(false)

  const hasBridge =
    typeof window !== 'undefined'
    && typeof window.api?.runPlaywrightAgentTurn === 'function'
    && typeof window.api?.startPlaywrightSession === 'function'
    && typeof window.api?.navigatePlaywrightSession === 'function'
    && typeof window.api?.getPlaywrightState === 'function'
  const startupBrowserError = !hasBridge
    ? 'The Electron preload bridge is unavailable. Start the desktop shell with npm run dev or npm start.'
    : !appState.targetUrl
      ? 'No target URL is configured for this session. Return to the dashboard and start again.'
      : ''

  useEffect(() => {
    if (startupBrowserError) {
      return
    }

    let isCancelled = false

    async function startBrowserSession() {
      setIsBrowserLoading(true)
      setBrowserError('')

      try {
        const result = await window.api.startPlaywrightSession(appState.sessionId, appState.targetUrl)

        if (isCancelled) {
          return
        }

        if (!result?.success) {
          setBrowserError(result?.error ?? 'Failed to start the Playwright CLI session.')
          return
        }

        setBrowserState(result.state ?? null)
      } catch (caughtError) {
        if (!isCancelled) {
          setBrowserError(caughtError instanceof Error ? caughtError.message : 'Failed to start the Playwright CLI session.')
        }
      } finally {
        if (!isCancelled) {
          setIsBrowserLoading(false)
        }
      }
    }

    startBrowserSession()

    return () => {
      isCancelled = true
    }
  }, [appState.sessionId, appState.targetUrl, startupBrowserError])

  useEffect(() => {
    const audio = new Audio('/media/audio/REACH_Stockpile.wav')
    audio.volume = 0.3

    audio.play().then(() => {
      console.log('Startup audio playing.')
    }).catch((caughtError) => {
      console.error('Audio error:', caughtError)
    })
  }, [])

  async function refreshBrowserState({ showLoading = true } = {}) {
    if (!hasBridge || !appState.sessionId) {
      return null
    }

    if (showLoading) {
      setIsBrowserLoading(true)
    }

    try {
      const result = await window.api.getPlaywrightState(appState.sessionId)

      if (!result?.success) {
        setBrowserError(result?.error ?? 'Failed to fetch the latest Playwright browser state.')
        return null
      }

      setBrowserState(result.state ?? null)
      setBrowserError('')
      return result.state ?? null
    } catch (caughtError) {
      setBrowserError(caughtError instanceof Error ? caughtError.message : 'Failed to fetch the latest Playwright browser state.')
      return null
    } finally {
      if (showLoading) {
        setIsBrowserLoading(false)
      }
    }
  }

  async function handleNavigateTarget() {
    if (!hasBridge || !appState.targetUrl) {
      return
    }

    setIsBrowserLoading(true)

    try {
      const result = await window.api.navigatePlaywrightSession(appState.sessionId, appState.targetUrl)

      if (!result?.success) {
        setBrowserError(result?.error ?? 'Failed to navigate the Playwright session.')
        return
      }

      setBrowserState(result.state ?? null)
      setBrowserError('')
    } catch (caughtError) {
      setBrowserError(caughtError instanceof Error ? caughtError.message : 'Failed to navigate the Playwright session.')
    } finally {
      setIsBrowserLoading(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!hasBridge) {
      setError('The Electron preload bridge is unavailable. Start the desktop shell with npm run dev or npm start.')
      setResponse('')
      return
    }

    const cleanPrompt = prompt.trim()

    if (!cleanPrompt) {
      setError('Prompt is required.')
      setResponse('')
      return
    }

    setIsLoading(true)
    setError('')
    setBrowserError('')

    try {
      const result = await window.api.runPlaywrightAgentTurn(appState.sessionId, cleanPrompt, appState.selectedModel)

      if (result?.state) {
        setBrowserState(result.state)
      }

      if (result?.warning) {
        setBrowserError(result.warning)
      }

      if (!result?.success) {
        setError(result?.error ?? 'Ollama did not return a response.')
        setResponse(result?.reply ?? '')
        return
      }

      const nextResponseSections = []

      if (result.action) {
        nextResponseSections.push(`Executed action: ${formatActionSummary(result.action)}`)
      }

      if (result.reply) {
        nextResponseSections.push(result.reply)
      }

      if (result.warning) {
        nextResponseSections.push(`Warning: ${result.warning}`)
      }

      setResponse(nextResponseSections.filter(Boolean).join('\n\n'))
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unexpected error reaching the Playwright agent turn handler.')
      setResponse('')
    } finally {
      setIsLoading(false)
    }
  }

  function handleReset() {
    setPrompt(starterPrompt)
    setResponse('')
    setError('')
  }

  return (
    <div className="shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Local AI CTF Workspace</p>
          <h1>Stockpile</h1>
        </div>

        <aside className="hero-status">
          <span className={`status-pill ${hasBridge ? 'ready' : 'missing'}`}>
            {hasBridge ? 'Electron bridge online' : 'Electron bridge missing'}
          </span>
          <p>Model target: {appState.selectedModel || 'none'}</p>
          <p>Target URL: {appState.targetUrl || 'not set'}</p>
          <p>Session ID: {appState.sessionId || 'not set'}</p>
          <p>Browser status: {browserState?.browserActive ? 'active' : isBrowserLoading ? 'starting' : 'idle'}</p>
          <p>Ollama Net Socket: 127.0.0.1:11434</p>
        </aside>
      </header>

      <main className="workspace">
        <section className="panel">
          <div className="panel-heading">
            <h2>Prompt Console</h2>
            <p>Use this shell while the gate, session, and MCP-driven workflows are rebuilt in React.</p>
          </div>

          <form className="composer" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="prompt">
              Prompt
            </label>
            <textarea
              id="prompt"
              name="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={10}
              spellCheck="false"
              placeholder="Ask the local model to inspect a page, explain a finding, or suggest a next step."
            />

            <div className="actions">
              <button className="primary" type="submit" disabled={isLoading || !hasBridge}>
                {isLoading ? 'Querying Ollama...' : 'Send Prompt'}
              </button>
              <button className="secondary" type="button" onClick={handleReset} disabled={isLoading}>
                Reset
              </button>
            </div>
          </form>
        </section>

        <section className="panel output-panel">
          <div className="panel-heading">
            <h2>Browser State</h2>
            <p>Inspect the live Playwright CLI session before routing prompts into the model.</p>
          </div>

          <div className="actions browser-toolbar">
            <button className="secondary" type="button" onClick={() => refreshBrowserState()} disabled={isBrowserLoading || !hasBridge}>
              {isBrowserLoading ? 'Refreshing Browser...' : 'Refresh Browser State'}
            </button>
            <button
              className="secondary"
              type="button"
              onClick={handleNavigateTarget}
              disabled={isBrowserLoading || !hasBridge || !appState.targetUrl}
            >
              Re-open Target URL
            </button>
          </div>

          {startupBrowserError || browserError ? (
            <div className="message error">
              <h3>Browser session failed</h3>
              <p>{startupBrowserError || browserError}</p>
            </div>
          ) : null}

          <div className="message browser-meta">
            <p><strong>Page title:</strong> {browserState?.pageTitle || 'unknown'}</p>
            <p><strong>Page URL:</strong> {browserState?.pageUrl || appState.targetUrl || 'unknown'}</p>
            <p><strong>Last CLI command:</strong> {browserState?.lastCommand || 'none yet'}</p>
            <p><strong>Last update:</strong> {browserState?.lastUpdatedAt || 'not yet captured'}</p>
          </div>

          {browserState?.snapshot ? (
            <pre className="response browser-snapshot">{browserState.snapshot}</pre>
          ) : (
            <div className="message empty">
              <h3>No browser snapshot yet</h3>
              <p>Start or refresh the Playwright CLI session to capture the current page structure.</p>
            </div>
          )}

          <div className="panel-heading response-heading">
            <h2>Response</h2>
            <p>Replies from the agent turn handler appear here after the model plans and optionally executes one allowlisted browser action.</p>
          </div>

          {error ? (
            <div className="message error">
              <h3>Request failed</h3>
              <p>{error}</p>
            </div>
          ) : null}

          {response ? (
            <pre className="response">{response}</pre>
          ) : (
            <div className="message empty">
              <h3>No response yet</h3>
              <p>Send a prompt from the left panel to confirm the restored Electron bridge is talking to Ollama and can include current browser context.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default SessionPage