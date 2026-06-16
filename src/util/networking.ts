export async function NET_getOllamaVersion(): Promise<{
  online: boolean
  version?: string
  error?: string
}> {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/version')

    if (!response.ok) {
      return {
        online: false,
        error: `Ollama responded with HTTP ${response.status}`,
      }
    }

    const data = (await response.json()) as { version?: string }

    return {
      online: true,
      version: data.version,
    }
  } catch (error) {
    return {
      online: false,
      error: error instanceof Error ? error.message : 'Unable to reach Ollama',
    }
  }
}

export async function isOllamaPresent() {
  try{
    const response = await fetch('http://127.0.0.1:11434/api/version')
  
    if (!response.ok) {return false;}
    return true;
  } catch (error) {
    console.error(`ERROR ${error}`)
    return false
  }
}

export async function NET_getLocalModels() {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags')

    if (!response.ok) {
      return {
        online: false,
        error: `Ollama responded with HTTP ${response.status}`,
      }
    }

    const data = await response.json()
    return {
      online: true,
      models: data.models ?? [],
    }
  } catch (error) {
    return {
      online: false,
      error: error instanceof Error ? error.message : 'Unable to reach Ollama',
    }
  }
}