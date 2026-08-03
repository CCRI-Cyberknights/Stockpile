const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  askOllama: (prompt, model) => ipcRenderer.invoke('ask-ollama', String(prompt ?? ''), String(model ?? '')),
  runPlaywrightAgentTurn: (sessionId, prompt, model) => ipcRenderer.invoke('run-playwright-agent-turn', String(sessionId ?? ''), String(prompt ?? ''), String(model ?? '')),
  startPlaywrightSession: (sessionId, targetUrl) => ipcRenderer.invoke('start-playwright-session', String(sessionId ?? ''), String(targetUrl ?? '')),
  navigatePlaywrightSession: (sessionId, targetUrl) => ipcRenderer.invoke('navigate-playwright-session', String(sessionId ?? ''), String(targetUrl ?? '')),
  getPlaywrightState: (sessionId) => ipcRenderer.invoke('get-playwright-state', String(sessionId ?? '')),
})