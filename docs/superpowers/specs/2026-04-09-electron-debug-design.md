# electron-debug Skill 设计规范

## 概述

electron-debug 是一个 Claude Code Skill，用于调试 Electron 应用。它通过 Chrome DevTools Protocol (CDP) 提供完整的调试能力，包括 DOM 检查、元素点击、JavaScript 执行、截图、控制台监控和网络抓包。

## 核心设计原则

**分离关注点**：
- **Skill (SKILL.md)** — 负责判断调用时机、管理用户交互、调度工具
- **CLI** — 负责命令执行、自动连接管理
- **Daemon** — 负责保持与 Electron 的长连接

## 使用流程

### 首次连接

用户需要提供 Electron 应用的调试端口：

```bash
/electron-debug connect --electron-port 9333
```

流程：
1. CLI 检查 daemon 是否已运行
2. Daemon 未运行，启动 daemon 进程
3. Daemon 保存端口到内存，连接 Electron
4. 返回连接成功

### 后续调用

```bash
/electron-debug click "#btn"
/electron-debug screenshot
/electron-debug eval "document.title"
```

流程：
1. CLI 检查 daemon 是否运行
2. Daemon 运行中，发送 HTTP 请求到 daemon
3. Daemon 执行命令并返回结果

### 断开连接

```bash
/electron-debug disconnect
```

流程：
1. CLI 通知 daemon 停止
2. Daemon 清理连接并退出

## 技术架构

### 组件交互

```
Claude Code (对话)
    ↓ 调用 Skill
SKILL.md (连接管理 + 工具调度)
    ↓ 调用 CLI
CLI (自动连接管理)
    ↓ HTTP 请求 (localhost:9229)
Daemon (保存连接状态在内存)
    ↓ WebSocket
Electron CDP (localhost:9333)
```

### 端口分配

| 端口 | 用途 |
|------|------|
| 9229 | Daemon HTTP 服务器（默认） |
| 9333 | Electron CDP 端口（用户指定） |

### Daemon 状态管理

Daemon 在内存中保存以下状态：
- `electronPort` — Electron 调试端口
- `electronHost` — Electron 主机地址（默认 127.0.0.1）
- `client` — CDP WebSocket 客户端实例
- `connected` — 是否已连接

### CLI 自动管理逻辑

```javascript
// 伪代码
async function autoConnect(args) {
    const daemonRunning = await checkDaemon();
    if (!daemonRunning) {
        await startDaemon(args);
    }
    // 发送命令到 daemon
    await sendToDaemon(command);
}
```

## CLI 命令

| 命令 | 说明 |
|------|------|
| `connect --electron-port <port>` | 连接 Electron（启动 daemon） |
| `disconnect` | 断开连接并停止 daemon |
| `status` | 查看连接状态 |
| `list-pages` | 列出所有可调试页面 |
| `screenshot [--path <path>]` | 截图 |
| `click "<selector>"` | 点击元素 |
| `eval "<expression>"` | 执行 JavaScript |
| `dom --selector "<selector>"` | 查询 DOM |
| `console [--type <type>]` | 查看控制台 |
| `network [--watch]` | 网络监控 |

## 错误处理

| 场景 | 处理方式 |
|------|---------|
| Electron 未启动 | 提示用户启动 Electron |
| 端口错误 | 提示检查端口 |
| 连接超时 | 重试 3 次后提示失败 |
| 命令执行失败 | 返回错误信息 |

## 安装方式

```bash
npx skills add kvenLin/electron-debug@electron-debug
```

安装后 Claude Code 会自动识别 Skill，用户可通过对话调用。

## 依赖

- Node.js 18+
- ws (WebSocket 库)

## 后续优化

- [ ] 支持多个 Electron 实例
- [ ] 支持主进程调试
- [ ] AI 辅助诊断增强
