import { app, BrowserWindow, ipcMain } from 'electron'
import ollama from 'ollama'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

function createMissingRendererHtml() {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Stockpile</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #0b1318;
            color: #f0f7f4;
            font: 16px/1.5 Aptos, Segoe UI, sans-serif;
          }
          main {
            max-width: 38rem;
            padding: 2rem;
            border-radius: 20px;
            background: rgba(18, 30, 38, 0.92);
            border: 1px solid rgba(127, 240, 193, 0.18);
          }
          h1 { margin-top: 0; }
          code {
            padding: 0.15rem 0.35rem;
            border-radius: 0.4rem;
            background: rgba(127, 240, 193, 0.12);
          }
        </style>
      </head>
      <body>
        <main>
          <h1>Renderer build not found</h1>
          <p>Run <code>npm run dev</code> for live development or <code>npm run build</code> before launching Electron directly.</p>
        </main>
      </body>
    </html>
  `
}

function loadRenderer(window) {
  const rendererUrl = process.env.VITE_DEV_SERVER_URL

  if (rendererUrl) {
    window.loadURL(rendererUrl)
    return
  }

  const distEntry = path.join(__dirname, '..', 'dist', 'index.html')

  if (fs.existsSync(distEntry)) {
    window.loadFile(distEntry)
    return
  }

  window.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(createMissingRendererHtml())}`)
}

function createWindow() {
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  loadRenderer(window)
}

ipcMain.handle('ask-ollama', async (_event, prompt) => {
  try {
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return { success: false, error: 'Prompt is required.' }
    }

    const response = await ollama.chat({
      model: 'mannix/llama3.1-8b-abliterated',
      messages: [{ role: 'user', content: prompt }],
    })

    return { success: true, text: response.message.content }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown Ollama error.' }
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