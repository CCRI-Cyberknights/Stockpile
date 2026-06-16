import { dom, networking } from '../util'
import { useEffect } from 'react'

function GatePage({ onContinue }) {
    useEffect(() => {
        networking.isOllamaPresent().then((res) => {
            if (!res) {
                alert(`Ollama is not present and this app has it as a dependency.\nFollow the following instructions to get it up and running:\n\n1. Close this application completely. \n2. Download and install Ollama from https://ollama.com/\n3. Run the command 'ollama run ollama/ollama' in your terminal to start the Ollama server.\n4. restart this application after completing the above steps.`)
                return
            }

            onContinue?.()
        })
    }, [onContinue])

    return (
        <div className="flex flex-col items-center justify-center h-screen gap-4">
            <img src="../../media/visual/gate.png" className="w-2/6 mx-auto text-amber-200 h-2/6"></img>
        </div>
    )
}

export default GatePage