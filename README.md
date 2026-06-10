# Stockpile

Stockpile is an Electron app for guided CTF practice sessions. The current stack uses Electron for the desktop shell, React and Vite for the renderer, Ollama for the local model bridge, and Playwright for browser automation experiments.

## Development

- `npm run dev` starts Vite and Electron together for day-to-day development.
- `npm run build` builds the React renderer into `dist`.
- `npm start` launches Electron against the built renderer.
- `npm run test:e2e` runs the Playwright suite.
