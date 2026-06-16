import { dom, networking } from '../util'
import { useEffect } from 'react'

function GatePage({ onContinue }) {
    useEffect(() => {
        async function checkOllama() {
            const [present, modelsResult] = await Promise.all([
                networking.isOllamaPresent(),
                networking.NET_getLocalModels(),
            ])

            if (!present) {
                alert(`Ollama is not present and this app has it as a dependency.\nFollow the following instructions to get it up and running:\n\n1. Close this application completely. \n2. Download and install Ollama from https://ollama.com/\n3. Run the command 'ollama run ollama/ollama' in your terminal to start the Ollama server.\n4. restart this application after completing the above steps.`)
                return
            }
            else if (!modelsResult.online) {
                alert(`Ollama is present but has no models available.\nyou can download models from https://ollama.com/models\n\nRun this command in CMD to get setup quickly:\nollama pull mannix/llama3.1-8b-abliterated`)
                return
            }

            onContinue?.()
        }

        checkOllama()
    }, [onContinue])

    return (
        <div className="flex flex-col items-center justify-center h-screen gap-4">
            <img src="../../media/visual/gate.png" className="w-2/6 mx-auto text-amber-200 h-2/6"></img>
        </div>
    )
}

export default GatePage