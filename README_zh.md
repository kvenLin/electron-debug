# electron-debug

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![skills.sh](https://img.shields.io/badge/skills.sh-electron--debug-33aadd)](https://skills.sh)

> Claude Code Skill - 使用 Chrome DevTools Protocol (CDP) 调试 Electron 应用

[**English**](README.md) | [中文文档](README_zh.md)

## 特性

- **Daemon 模式** - 后台进程保持 CDP 连接，支持持续测试
- **完整 CDP 支持** - Console、Network、DOM、截图、元素点击等
- **AI 辅助诊断** - 描述问题即可自动收集调试信息
- **灵活端口配置** - 支持自定义调试端口

## 环境要求

- Node.js 18+
- Claude Code

## 安装

### 方式一：通过 skills.sh 安装（推荐）

```bash
npx skills add kvenLin/electron-debug@electron-debug
```

### 方式二：手动安装

```bash
# 克隆仓库
git clone https://github.com/kvenLin/electron-debug.git
cd electron-debug

# 安装依赖
npm install
```

### 方式三：开发调试（符号链接）

```bash
ln -s ~/path/to/electron-debug ~/.claude/skills/electron-debug
/reload-plugins
```

## 快速开始

### 1. 启动 Electron 应用（开启调试端口）

```bash
cd your-electron-app
electron . --remote-debugging-port=9333
```

或在 `package.json` 中配置：

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

### 2. 连接调试

```
/electron-debug connect --electron-port 9333
```

### 3. 开始调试

```bash
# 查看页面列表
/electron-debug list-pages

# 截图
/electron-debug screenshot

# 点击元素
/electron-debug click "#my-button"

# 执行 JavaScript
/electron-debug eval "document.title"

# 查看控制台
/electron-debug console

# AI 诊断
/electron-debug diagnose "按钮点击没反应"
```

### 4. 断开连接

```
/electron-debug disconnect
```

## 命令参考

### 连接管理

| 命令 | 说明 |
|------|------|
| `connect --electron-port <端口>` | 启动 daemon 并连接 |
| `disconnect` | 断开连接并停止 daemon |
| `status` | 查看连接状态 |

### Daemon 管理

| 命令 | 说明 |
|------|------|
| `daemon start --electron-port <端口>` | 启动 daemon |
| `daemon stop` | 停止 daemon |
| `daemon status` | 查看 daemon 状态 |

### 页面操作

| 命令 | 说明 |
|------|------|
| `list-pages` | 列出所有可调试页面 |
| `switch-page --id <id>` | 切换到其他页面 |
| `screenshot` | 截图（显示 base64） |
| `screenshot --path ./screenshot.png` | 截图并保存到文件 |

### 元素交互

| 命令 | 说明 |
|------|------|
| `click "#选择器"` | 点击元素 |
| `eval "javascript"` | 执行 JavaScript 表达式 |
| `dom --selector "#选择器"` | 查询 DOM 元素 |

### 监控

| 命令 | 说明 |
|------|------|
| `console` | 查看控制台日志 |
| `console --watch` | 监听控制台消息 |
| `network --watch` | 监听网络请求 |

### 诊断

| 命令 | 说明 |
|------|------|
| `diagnose "<问题描述>"` | AI 辅助诊断 |

## Daemon 模式

electron-debug 使用后台 daemon 进程保持 CDP 连接。

### 架构

```
┌─────────────────────────────────────────────────────────────┐
│  electron-debug-daemon (后台进程, localhost:9229)            │
│  - 维护到 Electron 的 WebSocket CDP 连接                    │
│  - 管理当前活动目标/页面                                     │
└─────────────────────────────────────────────────────────────┘
          ↑ HTTP (localhost:9229)
          │
┌─────────────────────────────────────────────────────────────┐
│  electron-debug CLI / Skill                                 │
│  - 命令行客户端，发送 HTTP 请求到 daemon                    │
└─────────────────────────────────────────────────────────────┘
```

### 端口说明

| 端口 | 用途 |
|------|------|
| 9229 | Daemon HTTP 服务器（默认） |
| 9333 | Electron CDP 端口（可配置） |

## CLI 直接使用

```bash
# 启动 daemon
node bin/daemon.js --electron-port 9333

# API 调用
curl http://127.0.0.1:9229/status
curl -X POST http://127.0.0.1:9229/eval -d '{"expression":"document.title"}'
curl -X POST http://127.0.0.1:9229/click -d '{"selector":"#btn1"}'
curl http://127.0.0.1:9229/screenshot -o screenshot.png

# 停止 daemon
curl -X DELETE http://127.0.0.1:9229/
```

## HTTP API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/status` | 获取连接状态 |
| GET | `/targets` | 列出所有页面 |
| POST | `/connect` | 连接到 Electron |
| POST | `/switch-target` | 切换页面 |
| POST | `/eval` | 执行 JavaScript |
| GET | `/screenshot` | 获取截图（PNG） |
| POST | `/screenshot` | 获取截图（JSON） |
| POST | `/click` | 点击元素 |
| GET | `/console` | 获取控制台消息 |
| POST | `/disconnect` | 断开连接 |
| DELETE | `/` | 停止 daemon |

## 与 chrome-devtools-mcp 对比

| 特性 | chrome-devtools-mcp | electron-debug |
|------|---------------------|---------------|
| 类型 | MCP Server | Claude Code Skill |
| 状态连接 | 不支持 | 支持 Daemon 模式 |
| 端口配置 | 固定 9222 | 可配置 |
| 元素点击 | 不支持 | 支持 |
| 主进程调试 | 不支持 | 支持 |
| AI 诊断 | 无 | AI 辅助 |

## 项目结构

```
electron-debug/
├── bin/
│   ├── cli.js        # CLI 客户端入口
│   └── daemon.js     # Daemon 服务入口
├── dist/             # 编译后的 JavaScript
├── skills/
│   └── electron-debug/
│       └── SKILL.md  # Claude Code Skill 定义
├── node_modules/     # 依赖
├── package.json
├── README.md         # 英文文档
└── README_zh.md      # 中文文档
```

## 故障排除

### 连接失败？

确保 Electron 已开启远程调试：

```bash
electron . --remote-debugging-port=9333
```

### Daemon 端口被占用？

```bash
# 检查端口
lsof -i :9229

# 终止进程
kill <PID>
```

### 截图返回 JSON 而非图片？

使用 `GET /screenshot` 而不是 `POST /screenshot`。

### 安装后找不到 Skill？

```bash
# 查看已安装的 skills
npx skills list

# 重新加载插件
/reload-plugins
```

### npm install 权限问题？

```bash
sudo npm install
# 或
npm install --prefix ~/.local
```

## 快速参考

| 任务 | 命令 |
|------|------|
| 连接 | `/electron-debug connect --electron-port 9333` |
| 截图 | `/electron-debug screenshot` |
| 点击 | `/electron-debug click "#btn"` |
| 控制台 | `/electron-debug console` |
| 诊断 | `/electron-debug diagnose "问题描述"` |
| 断开 | `/electron-debug disconnect` |

## 日常使用示例（白话版）

### 场景1：朋友说"我点了按钮没反应"

```
/electron-debug connect --electron-port 9333
/electron-debug screenshot
/electron-debug click "#那个按钮"
/electron-debug screenshot
/electron-debug eval "document.querySelector('#output').textContent"
/electron-debug console --type error
/electron-debug disconnect
```

### 场景2：页面加载完白屏了

```
/electron-debug connect --electron-port 9333
/electron-debug screenshot
/electron-debug eval "document.body.innerHTML"
/electron-debug console
/electron-debug disconnect
```

### 场景3：想看看页面加载慢到底是哪里慢

```
/electron-debug connect --electron-port 9333
/electron-debug network --watch
# 刷新页面
/electron-debug disconnect
```

### 场景4：表单填了提交不了，想看看到底验证过了没

```
/electron-debug connect --electron-port 9333
/electron-debug eval "document.querySelector('form').checkValidity()"
/electron-debug eval "document.querySelector('input').validity"
/electron-debug console
/electron-debug disconnect
```

### 场景5：想偷看人家网站登录请求发了啥

```
/electron-debug connect --electron-port 9333
/electron-debug network --watch
# 在页面上操作登录
/electron-debug disconnect
```

### 场景6：自动化测试 - 连续点商品加入购物车

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

## 贡献

欢迎提交 Issue 或 Pull Request！

## 许可证

MIT
