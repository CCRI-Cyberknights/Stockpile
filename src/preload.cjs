const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  askOllama: (prompt) => ipcRenderer.invoke('ask-ollama', String(prompt ?? '')),
})