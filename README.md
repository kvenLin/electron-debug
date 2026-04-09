# electron-debug

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![skills.sh](https://img.shields.io/badge/skills.sh-electron--debug-33aadd)](https://skills.sh)

> Claude Code Skill for debugging Electron applications using Chrome DevTools Protocol (CDP)

[**中文文档**](README_zh.md) | [English](README.md)

## Features

- **Daemon Mode** - Background process maintains CDP connection for continuous testing
- **Full CDP Support** - Console, Network, DOM, Screenshot, Element Click, etc.
- **AI-Assisted Diagnosis** - Auto-collect debugging info when describing issues
- **Flexible Port Configuration** - Custom debugging port support

## Requirements

- Node.js 18+
- Claude Code

## Installation

### Option 1: via skills.sh (Recommended)

```bash
npx skills add kvenLin/electron-debug@electron-debug
```

### Option 2: Manual Install

```bash
# Clone the repo
git clone https://github.com/kvenLin/electron-debug.git
cd electron-debug

# Install dependencies
npm install
```

### Option 3: Development (Symlink)

```bash
ln -s ~/path/to/electron-debug ~/.claude/skills/electron-debug
/reload-plugins
```

## Quick Start

### 1. Start Electron App with Debug Port

```bash
cd your-electron-app
electron . --remote-debugging-port=9333
```

Or add to `package.json`:

```json
{
  "scripts": {
    "debug": "electron . --remote-debugging-port=9333"
  }
}
```

```bash
npm run debug
```

### 2. Connect

```
/electron-debug connect --electron-port 9333
```

### 3. Debug

```bash
# List pages
/electron-debug list-pages

# Screenshot
/electron-debug screenshot

# Click element
/electron-debug click "#my-button"

# Execute JavaScript
/electron-debug eval "document.title"

# View console
/electron-debug console

# AI diagnosis
/electron-debug diagnose "button click not working"
```

### 4. Disconnect

```
/electron-debug disconnect
```

## Command Reference

### Connection Management

| Command | Description |
|---------|-------------|
| `connect --electron-port <port>` | Start daemon and connect |
| `disconnect` | Disconnect and stop daemon |
| `status` | View connection status |

### Daemon Management

| Command | Description |
|---------|-------------|
| `daemon start --electron-port <port>` | Start daemon |
| `daemon stop` | Stop daemon |
| `daemon status` | View daemon status |

### Page Operations

| Command | Description |
|---------|-------------|
| `list-pages` | List all debuggable pages |
| `switch-page --id <id>` | Switch to another page |
| `screenshot` | Take screenshot (base64) |
| `screenshot --path ./screenshot.png` | Save screenshot to file |

### Element Interaction

| Command | Description |
|---------|-------------|
| `click "#selector"` | Click element |
| `eval "javascript"` | Execute JavaScript expression |
| `dom --selector "#selector"` | Query DOM element |

### Monitoring

| Command | Description |
|---------|-------------|
| `console` | View console logs |
| `console --watch` | Watch console messages |
| `network --watch` | Watch network requests |

### Diagnosis

| Command | Description |
|---------|-------------|
| `diagnose "<problem>"` | AI-assisted diagnosis |

## Daemon Mode

electron-debug uses a background daemon process to maintain CDP connection.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  electron-debug-daemon (background, localhost:9229)          │
│  - Maintains WebSocket CDP connection to Electron           │
│  - Manages current active target/page                       │
└─────────────────────────────────────────────────────────────┘
          ↑ HTTP (localhost:9229)
          │
┌─────────────────────────────────────────────────────────────┐
│  electron-debug CLI / Skill                                 │
│  - Command line client, sends HTTP requests to daemon      │
└─────────────────────────────────────────────────────────────┘
```

### Port Reference

| Port | Purpose |
|------|---------|
| 9229 | Daemon HTTP server (default) |
| 9333 | Electron CDP port (configurable) |

## CLI Direct Usage

```bash
# Start daemon
node bin/daemon.js --electron-port 9333

# API calls
curl http://127.0.0.1:9229/status
curl -X POST http://127.0.0.1:9229/eval -d '{"expression":"document.title"}'
curl -X POST http://127.0.0.1:9229/click -d '{"selector":"#btn1"}'
curl http://127.0.0.1:9229/screenshot -o screenshot.png

# Stop daemon
curl -X DELETE http://127.0.0.1:9229/
```

## HTTP API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/status` | Get connection status |
| GET | `/targets` | List all pages |
| POST | `/connect` | Connect to Electron |
| POST | `/switch-target` | Switch page |
| POST | `/eval` | Execute JavaScript |
| GET | `/screenshot` | Get screenshot (PNG) |
| POST | `/screenshot` | Get screenshot (JSON) |
| POST | `/click` | Click element |
| GET | `/console` | Get console messages |
| POST | `/disconnect` | Disconnect |
| DELETE | `/` | Stop daemon |

## Comparison with chrome-devtools-mcp

| Feature | chrome-devtools-mcp | electron-debug |
|---------|---------------------|----------------|
| Type | MCP Server | Claude Code Skill |
| Stateful Connection | Not supported | Daemon mode supported |
| Port Configuration | Fixed 9222 | Configurable |
| Element Click | Not supported | Supported |
| Main Process Debugging | Not supported | Supported |
| AI Diagnosis | None | AI-assisted |

## Project Structure

```
electron-debug/
├── bin/
│   ├── cli.js        # CLI client entry
│   └── daemon.js     # Daemon service entry
├── dist/             # Compiled JavaScript
├── skills/
│   └── electron-debug/
│       └── SKILL.md  # Claude Code Skill definition
├── node_modules/     # Dependencies
├── package.json
├── README.md         # English documentation
└── README_zh.md      # Chinese documentation
```

## Troubleshooting

### Connection Failed?

Make sure Electron is started with remote debugging:

```bash
electron . --remote-debugging-port=9333
```

### Daemon Port Occupied?

```bash
# Check port
lsof -i :9229

# Kill process
kill <PID>
```

### Screenshot Returns JSON Instead of Image?

Use `GET /screenshot` instead of `POST /screenshot`.

### Cannot Find Skill After Install?

```bash
# Check installed skills
npx skills list

# Reload plugins
/reload-plugins
```

### Permission Denied (npm install)?

```bash
sudo npm install
# or
npm install --prefix ~/.local
```

## Quick Reference

| Task | Command |
|------|---------|
| Connect | `/electron-debug connect --electron-port 9333` |
| Screenshot | `/electron-debug screenshot` |
| Click | `/electron-debug click "#btn"` |
| Console | `/electron-debug console` |
| Diagnose | `/electron-debug diagnose "issue description"` |
| Disconnect | `/electron-debug disconnect` |

## Everyday Examples (Colloquial)

### Scenario 1: Friend says "I clicked the button but nothing happened"

```
/electron-debug connect --electron-port 9333
/electron-debug screenshot
/electron-debug click "#that-button"
/electron-debug screenshot
/electron-debug eval "document.querySelector('#output').textContent"
/electron-debug console --type error
/electron-debug disconnect
```

### Scenario 2: Page loaded as a white screen

```
/electron-debug connect --electron-port 9333
/electron-debug screenshot
/electron-debug eval "document.body.innerHTML"
/electron-debug console
/electron-debug disconnect
```

### Scenario 3: Want to see why the page loads slowly

```
/electron-debug connect --electron-port 9333
/electron-debug network --watch
# Refresh the page
/electron-debug disconnect
```

### Scenario 4: Form filled but can't submit, want to check validation

```
/electron-debug connect --electron-port 9333
/electron-debug eval "document.querySelector('form').checkValidity()"
/electron-debug eval "document.querySelector('input').validity"
/electron-debug console
/electron-debug disconnect
```

### Scenario 5: Want to peek at login request details

```
/electron-debug connect --electron-port 9333
/electron-debug network --watch
# Do login operation on the page
/electron-debug disconnect
```

### Scenario 6: Automated test - click 10 products to add to cart

```
/electron-debug connect --electron-port 9333
/electron-debug click ".product:nth-child(1) .add-cart"
/electron-debug screenshot --path cart1.png
/electron-debug click ".product:nth-child(2) .add-cart"
/electron-debug screenshot --path cart2.png
/electron-debug click ".product:nth-child(3) .add-cart"
/electron-debug screenshot --path cart3.png
/electron-debug eval "document.querySelector('.cart-badge').textContent"
/electron-debug disconnect
```

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT
