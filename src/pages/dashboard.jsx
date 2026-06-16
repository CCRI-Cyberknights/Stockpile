import { dom, networking } from '../util'
import { useEffect, useState } from 'react'

function DashboardPage({ appState, setAppState, onContinue }) {
    const [selectedModel, setSelectedModel] = useState('')
    
    function handleModelChange(event) {
        let value = event.target.value

        setSelectedModel(value)
        setAppState((prev) => ({
            ...prev,
            selectedModel: appState.allModels[value],
        }))
        console.log('selectedModel = ', value)
    }

    function handleSubmit(event) {
        event.preventDefault()
        onContinue?.()
    }

    return (
        <div>
            <h1>Dashboard</h1>
            <form onSubmit={handleSubmit}>
                <label>
                    URL:
                    <input type="text" name="url" placeholder='https://www.ctfsite.com/api/data'/>
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
            </form>
        </div>
    )
}

export default DashboardPage

