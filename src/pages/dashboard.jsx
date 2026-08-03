import { useState } from 'react'

function DashboardPage({ appState, setAppState, onContinue }) {
    const [targetUrl, setTargetUrl] = useState(appState.targetUrl ?? '')
    const [error, setError] = useState('')
    const selectedModel = appState.selectedModel ?? ''
    
    function handleModelChange(event) {
        const value = event.target.value

        setAppState((prev) => ({
            ...prev,
            selectedModel: value,
        }))
        console.log('selectedModel = ', value)
    }

    function normalizeUrl(rawValue) {
        try {
            const parsedUrl = new URL(rawValue)

            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                return null
            }

            return parsedUrl.toString()
        } catch {
            return null
        }
    }

    function handleSubmit(event) {
        event.preventDefault()
        const normalizedUrl = normalizeUrl(targetUrl.trim())

        if (!normalizedUrl) {
            setError('Enter a valid http or https URL before starting the session.')
            return
        }

        setError('')
        setAppState((prev) => ({
            ...prev,
            targetUrl: normalizedUrl,
        }))
        onContinue?.(normalizedUrl)
    }

    return (
        <div>
            <h1>Dashboard</h1>
            <form onSubmit={handleSubmit}>
                <label>
                    URL:
                    <input
                        type="text"
                        name="url"
                        value={targetUrl}
                        onChange={(event) => setTargetUrl(event.target.value)}
                        placeholder='https://www.ctfsite.com/api/data'
                    />
                </label>
                <br />
                <label>
                    Model:
                    <select name="model" value={selectedModel} onChange={handleModelChange}>
                        {Object.keys(appState.allModels ?? {}).map((model) => (
                            <option key={model} value={model}>
                                {`${model} => ${appState.allModels[model]?.size ?? 'unknown'}`}
                            </option>
                        ))}
                    </select>
                </label>
                <br />
                <button type="submit">Submit</button>
                {error ? <p>{error}</p> : null}
            </form>
        </div>
    )
}

export default DashboardPage

