import { app, BrowserWindow, ipcMain } from 'electron'
import ollama from 'ollama'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  win.loadFile('src/index.html')
}

ipcMain.handle('ask-ollama', async (_event, prompt) => {
  try {
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return { success: false, error: 'Prompt is required.' }
    }

    const response = await ollama.chat({
      model: 'mannix/llama3.1-8b-abliterated',
      messages: [{ role: 'user', content: prompt }]
    })

    return { success: true, text: response.message.content }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})