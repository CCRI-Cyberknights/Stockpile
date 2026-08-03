import { app, BrowserWindow, ipcMain } from 'electron'
import ollama from 'ollama'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)
const execFileAsync = promisify(execFile)
const repoRoot = path.join(__dirname, '..')
const playwrightCliEntry = require.resolve('@playwright/cli/playwright-cli.js')
const playwrightCliRuntime = process.env.STOCKPILE_NODE_EXECUTABLE || process.env.npm_node_execpath || 'node'
const playwrightSessions = new Map()

let isClosingPlaywrightSessions = false

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

function normalizeTargetUrl(value) {
  if (typeof value !== 'string') {
    return null
  }

  try {
    const parsedUrl = new URL(value)

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return null
    }

    return parsedUrl.toString()
  } catch {
    return null
  }
}

function getPlaywrightOpenArgs(targetUrl) {
  const args = ['open', targetUrl, '--headed']

  if (process.platform === 'win32') {
    args.push('--browser', 'msedge')
  }

  return args
}

function createPlaywrightSessionRecord(sessionId, targetUrl = '') {
  return {
    sessionId,
    targetUrl,
    browserActive: false,
    pageUrl: '',
    pageTitle: '',
    snapshot: '',
    lastCommand: '',
    lastOutput: '',
    lastError: '',
    lastUpdatedAt: null,
    commandChain: Promise.resolve(),
  }
}

function getOrCreatePlaywrightSession(sessionId, targetUrl = '') {
  let session = playwrightSessions.get(sessionId)

  if (!session) {
    session = createPlaywrightSessionRecord(sessionId, targetUrl)
    playwrightSessions.set(sessionId, session)
  }

  if (targetUrl) {
    session.targetUrl = targetUrl
  }

  return session
}

function serializePlaywrightSession(session) {
  return {
    sessionId: session.sessionId,
    targetUrl: session.targetUrl,
    browserActive: session.browserActive,
    pageUrl: session.pageUrl,
    pageTitle: session.pageTitle,
    snapshot: session.snapshot,
    lastCommand: session.lastCommand,
    lastOutput: session.lastOutput,
    lastError: session.lastError,
    lastUpdatedAt: session.lastUpdatedAt,
  }
}

function extractPlaywrightState(output) {
  const safeOutput = typeof output === 'string' ? output.trim() : ''
  const pageUrl = safeOutput.match(/^\s*-\s*Page URL:\s*(.+)$/m)?.[1]?.trim() ?? ''
  const pageTitle = safeOutput.match(/^\s*-\s*Page Title:\s*(.+)$/m)?.[1]?.trim() ?? ''

  return {
    snapshot: safeOutput,
    pageUrl,
    pageTitle,
  }
}

function queuePlaywrightCommand(session, task) {
  const nextTask = session.commandChain.then(task, task)
  session.commandChain = nextTask.catch(() => undefined)
  return nextTask
}

async function invokePlaywrightCli(session, commandArgs) {
  session.lastCommand = `playwright-cli -s=${session.sessionId} ${commandArgs.join(' ')}`

  try {
    const childEnv = {
      ...process.env,
    }

    delete childEnv.ELECTRON_RUN_AS_NODE

    const { stdout, stderr } = await execFileAsync(
      playwrightCliRuntime,
      [playwrightCliEntry, `-s=${session.sessionId}`, ...commandArgs],
      {
        cwd: repoRoot,
        env: childEnv,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      },
    )

    const output = [stdout, stderr].filter(Boolean).join('\n').trim()
    const stateUpdate = extractPlaywrightState(output)

    session.browserActive = true
    session.lastError = ''
    session.lastOutput = output
    session.snapshot = stateUpdate.snapshot || session.snapshot
    session.pageUrl = stateUpdate.pageUrl || session.pageUrl
    session.pageTitle = stateUpdate.pageTitle || session.pageTitle
    session.lastUpdatedAt = new Date().toISOString()

    return {
      success: true,
      output,
      state: serializePlaywrightSession(session),
    }
  } catch (error) {
    const output = [error?.stdout, error?.stderr].filter(Boolean).join('\n').trim()
    const errorMessage = error?.code === 'ENOENT'
      ? `Unable to locate a Node.js runtime for Playwright CLI. Tried ${playwrightCliRuntime}.`
      : output || (error instanceof Error ? error.message : 'Unknown Playwright CLI error.')

    session.lastError = errorMessage
    session.lastOutput = output
    session.lastUpdatedAt = new Date().toISOString()

    return {
      success: false,
      error: errorMessage,
      state: serializePlaywrightSession(session),
    }
  }
}

async function closePlaywrightSession(session) {
  if (!session.browserActive) {
    return
  }

  await invokePlaywrightCli(session, ['close'])
  session.browserActive = false
}

async function closeAllPlaywrightSessions() {
  const sessions = [...playwrightSessions.values()]

  await Promise.all(
    sessions.map((session) => queuePlaywrightCommand(session, () => closePlaywrightSession(session))),
  )

  playwrightSessions.clear()
}

function parseModelJsonContent(content) {
  const safeContent = typeof content === 'string' ? content.trim() : ''

  if (!safeContent) {
    throw new Error('The model returned an empty response.')
  }

  try {
    return JSON.parse(safeContent)
  } catch {
    const firstBraceIndex = safeContent.indexOf('{')
    const lastBraceIndex = safeContent.lastIndexOf('}')

    if (firstBraceIndex === -1 || lastBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
      throw new Error('The model did not return valid JSON.')
    }

    return JSON.parse(safeContent.slice(firstBraceIndex, lastBraceIndex + 1))
  }
}

function getActionStringField(action, key, label) {
  if (typeof action?.[key] !== 'string' || !action[key].trim()) {
    throw new Error(`${label} is required for the ${action?.type ?? 'unknown'} action.`)
  }

  return action[key].trim()
}

function normalizePlaywrightAction(action) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    throw new Error('The model returned an invalid action payload.')
  }

  const rawType = typeof action.type === 'string' ? action.type.trim().toLowerCase() : ''
  const actionType = rawType.replace(/[\s-]+/g, '_')

  switch (actionType) {
    case 'click': {
      const button = typeof action.button === 'string' ? action.button.trim().toLowerCase() : 'left'

      if (!['left', 'middle', 'right'].includes(button)) {
        throw new Error('Click actions must use the left, middle, or right mouse button.')
      }

      return {
        type: 'click',
        target: getActionStringField(action, 'target', 'A target'),
        button,
      }
    }

    case 'fill':
      return {
        type: 'fill',
        target: getActionStringField(action, 'target', 'A target'),
        text: getActionStringField(action, 'text', 'Text'),
        submit: action.submit === true,
      }

    case 'type':
      return {
        type: 'type',
        text: getActionStringField(action, 'text', 'Text'),
      }

    case 'press':
      return {
        type: 'press',
        key: getActionStringField(action, 'key', 'A key'),
      }

    case 'select':
      return {
        type: 'select',
        target: getActionStringField(action, 'target', 'A target'),
        value: getActionStringField(action, 'value', 'A value'),
      }

    case 'hover':
      return {
        type: 'hover',
        target: getActionStringField(action, 'target', 'A target'),
      }

    case 'check':
      return {
        type: 'check',
        target: getActionStringField(action, 'target', 'A target'),
      }

    case 'uncheck':
      return {
        type: 'uncheck',
        target: getActionStringField(action, 'target', 'A target'),
      }

    case 'goto': {
      const url = normalizeTargetUrl(getActionStringField(action, 'url', 'A URL'))

      if (!url) {
        throw new Error('Goto actions require a valid http or https URL.')
      }

      return {
        type: 'goto',
        url,
      }
    }

    case 'go_back':
      return { type: 'go_back' }

    case 'go_forward':
      return { type: 'go_forward' }

    case 'reload':
      return { type: 'reload' }

    case 'snapshot':
      return { type: 'snapshot' }

    default:
      throw new Error(`Unsupported Playwright action type: ${rawType || 'unknown'}.`)
  }
}

function normalizeAgentPlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error('The model did not return a valid automation plan object.')
  }

  const reply = typeof plan.reply === 'string' && plan.reply.trim()
    ? plan.reply.trim()
    : 'No assistant reply was provided.'

  return {
    reply,
    action: plan.action == null ? null : normalizePlaywrightAction(plan.action),
  }
}

function getPlaywrightActionArgs(action) {
  switch (action.type) {
    case 'click': {
      const args = ['click', action.target]

      if (action.button !== 'left') {
        args.push(action.button)
      }

      return args
    }

    case 'fill': {
      const args = ['fill', action.target, action.text]

      if (action.submit) {
        args.push('--submit')
      }

      return args
    }

    case 'type':
      return ['type', action.text]

    case 'press':
      return ['press', action.key]

    case 'select':
      return ['select', action.target, action.value]

    case 'hover':
      return ['hover', action.target]

    case 'check':
      return ['check', action.target]

    case 'uncheck':
      return ['uncheck', action.target]

    case 'goto':
      return ['goto', action.url]

    case 'go_back':
      return ['go-back']

    case 'go_forward':
      return ['go-forward']

    case 'reload':
      return ['reload']

    case 'snapshot':
      return ['snapshot', '--depth=2']

    default:
      throw new Error(`Unsupported Playwright action type: ${action.type}.`)
  }
}

function createPlaywrightAgentPrompt(session, prompt) {
  return [
    'You are Stockpile, a browser automation planner for a safe local CTF practice session.',
    'Return JSON only with this shape:',
    '{"reply":"short user-facing explanation","action":null}',
    'or',
    '{"reply":"short user-facing explanation","action":{"type":"click","target":"e12","button":"left"}}',
    'Allowed action types: click, fill, type, press, select, hover, check, uncheck, goto, go_back, go_forward, reload, snapshot.',
    'Rules:',
    '- Return at most one action per turn.',
    '- Use the exact snapshot refs or stable selectors already visible in the snapshot.',
    '- If the request needs arbitrary JavaScript, CSS mutation, DOM editing, downloads, or other unsupported actions, explain that limitation and return action null.',
    '- If the target is ambiguous or missing from the snapshot, ask the user for a narrower request and return action null.',
    '- When you include an action, your reply should describe the intended action, not claim that it already succeeded.',
    '',
    `User request: ${prompt}`,
    `Configured target URL: ${session.targetUrl || 'unknown'}`,
    `Current page URL: ${session.pageUrl || 'unknown'}`,
    `Current page title: ${session.pageTitle || 'unknown'}`,
    'Current browser snapshot:',
    session.snapshot || '(no snapshot available)',
  ].join('\n')
}

async function planPlaywrightAgentTurn(session, prompt, model) {
  const response = await ollama.chat({
    model,
    format: 'json',
    messages: [
      {
        role: 'system',
        content: 'You are a strict JSON planning assistant for Playwright CLI browser actions.',
      },
      {
        role: 'user',
        content: createPlaywrightAgentPrompt(session, prompt),
      },
    ],
  })

  return normalizeAgentPlan(parseModelJsonContent(response?.message?.content ?? ''))
}

async function executePlaywrightAction(session, action) {
  if (action.type === 'goto') {
    session.targetUrl = action.url
  }

  const commandResult = await invokePlaywrightCli(session, getPlaywrightActionArgs(action))

  if (!commandResult.success) {
    return {
      success: false,
      action,
      error: commandResult.error ?? 'The Playwright action failed.',
      output: commandResult.output ?? '',
      state: commandResult.state,
    }
  }

  if (action.type === 'snapshot') {
    return {
      success: true,
      action,
      output: commandResult.output ?? '',
      state: commandResult.state,
    }
  }

  const snapshotResult = await invokePlaywrightCli(session, ['snapshot', '--depth=2'])

  return {
    success: true,
    action,
    output: commandResult.output ?? '',
    state: snapshotResult.success ? snapshotResult.state : commandResult.state,
    warning: snapshotResult.success ? '' : snapshotResult.error ?? 'The action ran, but the follow-up snapshot refresh failed.',
  }
}

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

ipcMain.handle('ask-ollama', async (_event, prompt, model) => {
  try {
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return { success: false, error: 'Prompt is required.' }
    }

    const response = await ollama.chat({
      model,
      messages: [{ role: 'user', content: prompt }],
    })

    return { success: true, text: response.message.content }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown Ollama error.' }
  }
})

ipcMain.handle('run-playwright-agent-turn', async (_event, sessionId, prompt, model) => {
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    return { success: false, error: 'A session ID is required.' }
  }

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return { success: false, error: 'Prompt is required.' }
  }

  if (typeof model !== 'string' || !model.trim()) {
    return { success: false, error: 'A model is required for agent turns.' }
  }

  const session = playwrightSessions.get(sessionId.trim())

  if (!session) {
    return { success: false, error: 'No active Playwright session was found.' }
  }

  if (!session.browserActive) {
    return { success: false, error: 'The Playwright browser is not active for this session.' }
  }

  return queuePlaywrightCommand(session, async () => {
    const snapshotResult = await invokePlaywrightCli(session, ['snapshot', '--depth=2'])

    if (!snapshotResult.success) {
      return {
        success: false,
        error: snapshotResult.error ?? 'Failed to capture the current browser snapshot before planning the turn.',
        state: snapshotResult.state,
      }
    }

    try {
      const plan = await planPlaywrightAgentTurn(session, prompt.trim(), model.trim())

      if (!plan.action) {
        return {
          success: true,
          reply: plan.reply,
          action: null,
          actionResult: null,
          state: snapshotResult.state,
        }
      }

      const actionResult = await executePlaywrightAction(session, plan.action)

      if (!actionResult.success) {
        return {
          success: false,
          error: actionResult.error ?? 'The Playwright action failed.',
          reply: plan.reply,
          action: plan.action,
          actionResult,
          state: actionResult.state,
        }
      }

      return {
        success: true,
        reply: plan.reply,
        action: plan.action,
        actionResult,
        state: actionResult.state,
        warning: actionResult.warning ?? '',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Playwright agent error.',
        state: serializePlaywrightSession(session),
      }
    }
  })
})

ipcMain.handle('start-playwright-session', async (_event, sessionId, targetUrl) => {
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    return { success: false, error: 'A session ID is required.' }
  }

  const normalizedUrl = normalizeTargetUrl(targetUrl)

  if (!normalizedUrl) {
    return { success: false, error: 'A valid http or https target URL is required.' }
  }

  const session = getOrCreatePlaywrightSession(sessionId.trim(), normalizedUrl)
  session.targetUrl = normalizedUrl

  return queuePlaywrightCommand(session, async () => {
    if (!session.browserActive) {
      const openResult = await invokePlaywrightCli(session, getPlaywrightOpenArgs(normalizedUrl))

      if (!openResult.success) {
        return openResult
      }
    } else if (session.pageUrl !== normalizedUrl) {
      const navigateResult = await invokePlaywrightCli(session, ['goto', normalizedUrl])

      if (!navigateResult.success) {
        return navigateResult
      }
    }

    return invokePlaywrightCli(session, ['snapshot', '--depth=2'])
  })
})

ipcMain.handle('navigate-playwright-session', async (_event, sessionId, targetUrl) => {
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    return { success: false, error: 'A session ID is required.' }
  }

  const normalizedUrl = normalizeTargetUrl(targetUrl)

  if (!normalizedUrl) {
    return { success: false, error: 'A valid http or https target URL is required.' }
  }

  const session = playwrightSessions.get(sessionId.trim())

  if (!session) {
    return { success: false, error: 'No active Playwright session was found.' }
  }

  session.targetUrl = normalizedUrl

  return queuePlaywrightCommand(session, async () => {
    if (!session.browserActive) {
      const openResult = await invokePlaywrightCli(session, getPlaywrightOpenArgs(normalizedUrl))

      if (!openResult.success) {
        return openResult
      }
    } else {
      const navigateResult = await invokePlaywrightCli(session, ['goto', normalizedUrl])

      if (!navigateResult.success) {
        return navigateResult
      }
    }

    return invokePlaywrightCli(session, ['snapshot', '--depth=2'])
  })
})

ipcMain.handle('get-playwright-state', async (_event, sessionId) => {
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    return { success: false, error: 'A session ID is required.' }
  }

  const session = playwrightSessions.get(sessionId.trim())

  if (!session) {
    return { success: false, error: 'No active Playwright session was found.' }
  }

  if (!session.browserActive) {
    return {
      success: true,
      state: serializePlaywrightSession(session),
    }
  }

  return queuePlaywrightCommand(session, () => invokePlaywrightCli(session, ['snapshot', '--depth=2']))
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', (event) => {
  if (isClosingPlaywrightSessions) {
    return
  }

  isClosingPlaywrightSessions = true
  event.preventDefault()

  closeAllPlaywrightSessions()
    .catch((error) => {
      console.error('Failed to close Playwright sessions cleanly:', error)
    })
    .finally(() => {
      app.quit()
    })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})