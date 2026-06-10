// src/pages/SessionPage.jsx
import { useState } from 'react'
import { dom, networking } from '../util'

networking.isOllamaPresent().then((result) => {
  console.log('RESULT =', result)
})


const starterPrompt = [
  'You are assisting with a capture-the-flag practice session.',
  'Confirm that you are online and ready to inspect page structure, controls, and suspicious DOM behavior.',
].join(' ')

function SessionPage() {
  const [prompt, setPrompt] = useState(starterPrompt)
  const [response, setResponse] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const hasBridge =
    typeof window !== 'undefined' && typeof window.api?.askOllama === 'function'

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

  try {
    const result = await window.api.askOllama(cleanPrompt)

    if (!result?.success) {
      setError(result?.error ?? 'Ollama did not return a response.')
      setResponse('')
      return
    }

    setResponse(result.text ?? '')
  } catch (caughtError) {
    setError(caughtError instanceof Error ? caughtError.message : 'Unexpected error reaching Ollama.')
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
          <p className="lede">
            The Electron codebase is restored around a React renderer, with the existing Ollama IPC bridge ready for prompt-driven workflows.
          </p>
        </div>

        <aside className="hero-status">
          <span className={`status-pill ${hasBridge ? 'ready' : 'missing'}`}>
            {hasBridge ? 'Electron bridge online' : 'Electron bridge missing'}
          </span>
          <p>Model target: mannix/llama3.1-8b-abliterated</p>
          <p>Ollama host: 127.0.0.1:11434</p>
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
            <h2>Response</h2>
            <p>Replies from the main-process Ollama handler appear here.</p>
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
              <p>Send a prompt from the left panel to confirm the restored Electron bridge is talking to Ollama.</p>
            </div>
          )}
        </section>
      </main>
    </div>// paste the current JSX here
  )
}

export default SessionPage