const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  askOllama: (prompt, model) => ipcRenderer.invoke('ask-ollama', String(prompt ?? ''), String(model ?? '')),
  startPlaywrightBrowser: () => ipcRenderer.invoke('start-playwright-browser')
})