# electron-debug Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 CLI 自动连接管理，所有命令通过 daemon 执行，实现"一次连接，后续直接使用"

**Architecture:** CLI 添加自动连接管理逻辑，检测 daemon 运行状态，未运行则自动启动。所有命令优先使用 daemon HTTP API，daemon 保持与 Electron 的 CDP 连接。

**Tech Stack:** Node.js 18+, ws (WebSocket), ES Modules

---

## 文件结构

```
dist/
├── index.js      # CLI 入口，修改：添加自动连接逻辑
├── daemon.js     # Daemon 服务，已存在
├── CDPClient.js  # WebSocket 客户端，已存在
└── types.js     # 类型定义，已存在
skills/electron-debug/
└── SKILL.md     # 更新文档
```

---

## Task 1: 添加 autoConnect 辅助函数

**Files:**
- Modify: `dist/index.js:1-95`

- [ ] **Step 1: 在 parseArgs 函数前添加 autoConnect 函数**

在 `dist/index.js` 的 `parseArgs` 函数之前添加以下代码：

```javascript
/**
 * 自动管理 daemon 连接
 * 如果 daemon 未运行，自动启动
 * 返回 daemonStatus 信息
 */
async function ensureDaemon(args) {
    const isRunning = await daemonCheck();
    if (isRunning) {
        return { started: false, running: true };
    }

    // Daemon 未运行，需要启动
    const electronPort = Number(args.electronPort) || Number(args.port) || 9222;

    // 如果是 connect 或 daemon start 命令，不需要再启动
    const command = args._ && Array.isArray(args._) ? args._[0] : '';
    if (command === 'connect' || command === 'daemon') {
        return { started: false, running: false };
    }

    // 自动启动 daemon
    console.log('Daemon not running, starting...');
    await cmdDaemonStart({ electronPort });
    return { started: true, running: true };
}

/**
 * 便捷函数：确保已连接 Electron
 * 用于需要 CDP 连接的命令
 */
async function ensureConnected() {
    const status = await daemonStatus();
    if (!status.running) {
        throw new Error('Daemon not running. Use "connect --electron-port <port>" first.');
    }
    if (!status.connected) {
        throw new Error('Not connected to Electron. Use "connect --electron-port <port>" first.');
    }
    return status;
}
```

- [ ] **Step 2: 修改 runCommand 函数，在每个命令执行前调用 ensureDaemon**

找到 `runCommand` 函数（约在 120 行），在 switch 语句之前添加：

```javascript
async function runCommand(cli) {
    const { command, args } = cli;

    // 自动管理 daemon（connect 和 daemon 命令不需要）
    if (command !== 'connect' && command !== 'daemon' && command !== 'status') {
        await ensureDaemon(args);
    }

    switch (command) {
        case 'connect':
            await cmdConnect(args);
            break;
        // ... rest of switch
    }
}
```

- [ ] **Step 3: 验证自动连接逻辑**

```bash
# 先确保 daemon 未运行
node bin/cli.js daemon stop 2>&1

# 运行一个命令，应该自动启动 daemon
node bin/cli.js status 2>&1

# 预期输出：
# Daemon not running, starting...
# Starting daemon with electron-port 9222...
# Daemon started successfully.
# Not connected to Electron...
```

- [ ] **Step 4: Commit**

```bash
git add dist/index.js
git commit -m "feat: add autoConnect logic to CLI"
```

---

## Task 2: 修复所有命令使用 daemon HTTP API

**Files:**
- Modify: `dist/index.js` 多处

当前问题：很多命令（如 screenshot、console、eval 等）检查的是 `client` 直接连接，而不是 daemon。

- [ ] **Step 1: 修改 cmdScreenshot 函数使用 daemon**

找到 `cmdScreenshot` 函数（约在 383 行），更新为：

```javascript
async function cmdScreenshot(args) {
    // 优先使用 daemon
    const isDaemonRunning = await daemonCheck();
    if (isDaemonRunning) {
        const path = String(args.path || '');
        try {
            const result = await daemonRequest('/screenshot', 'GET');
            if (path) {
                const fs = await import('fs/promises');
                const buffer = Buffer.from(result.data, 'base64');
                await fs.writeFile(path, buffer);
                console.log(`Screenshot saved to: ${path}`);
            } else {
                console.log(`Screenshot captured (${result.data.length} bytes, base64)`);
                console.log(`Preview: data:image/${result.format || 'png'};base64,${result.data.slice(0, 100)}...`);
            }
        } catch (err) {
            console.error('Error:', err.message);
        }
        return;
    }
    // 回退到直接连接（如果需要）
    if (!client || !client.isConnected()) {
        console.log('Not connected. Use "connect --electron-port <port>" first.');
        return;
    }
    const path = String(args.path || '');
    const format = args.jpeg ? 'jpeg' : 'png';
    const result = await client.captureScreenshot(format);
    if (path) {
        const fs = await import('fs/promises');
        const buffer = Buffer.from(result.data, 'base64');
        await fs.writeFile(path, buffer);
        console.log(`Screenshot saved to: ${path}`);
    } else {
        console.log(`Screenshot captured (${result.data.length} bytes, base64)`);
        console.log(`Preview: data:image/${format};base64,${result.data.slice(0, 100)}...`);
    }
}
```

- [ ] **Step 2: 修改 cmdConsole 函数使用 daemon**

找到 `cmdConsole` 函数（约在 310 行），更新为：

```javascript
async function cmdConsole(args) {
    // 优先使用 daemon
    const isDaemonRunning = await daemonCheck();
    if (isDaemonRunning) {
        try {
            const messages = await daemonRequest('/console', 'GET');
            const filterType = String(args.type || 'all');
            console.log('\nConsole Messages:');
            console.log('─'.repeat(60));
            (messages || [])
                .filter((m) => filterType === 'all' || m.type === filterType)
                .forEach((m) => {
                console.log(`[${m.type}] ${m.text}`);
            });
        } catch (err) {
            console.error('Error:', err.message);
        }
        return;
    }
    // 回退到直接连接
    if (!client) {
        console.log('Not connected. Use "connect --electron-port <port>" first.');
        return;
    }
    // ... 直接连接逻辑保持不变
}
```

- [ ] **Step 3: 修改 cmdEval 函数使用 daemon**

找到 `cmdEval` 函数（约在 470 行），更新为：

```javascript
async function cmdEval(args) {
    // 优先使用 daemon
    const isDaemonRunning = await daemonCheck();
    if (isDaemonRunning) {
        const expr = String((args._ && Array.isArray(args._) && args._[0]) || args.expression || '');
        if (!expr) {
            console.log('No expression provided. Usage: eval "document.title"');
            return;
        }
        try {
            const result = await daemonRequest('/eval', 'POST', { expression: expr });
            if (typeof result === 'object') {
                console.log(JSON.stringify(result, null, 2));
            } else {
                console.log(result);
            }
        } catch (err) {
            console.error('Error:', err.message);
        }
        return;
    }
    // 回退到直接连接
    if (!client) {
        console.log('Not connected. Use "connect --electron-port <port>" first.');
        return;
    }
    const expr = String((args._ && Array.isArray(args._) && args._[0]) || args.expression || '');
    if (!expr) {
        console.log('No expression provided. Usage: eval "document.title"');
        return;
    }
    const result = await client.evaluate(expr);
    if (typeof result === 'object') {
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.log(result);
    }
}
```

- [ ] **Step 4: 修改 cmdClick 函数使用 daemon**

找到 `cmdClick` 函数（约在 631 行），更新为：

```javascript
async function cmdClick(args) {
    // 优先使用 daemon
    const isDaemonRunning = await daemonCheck();
    if (isDaemonRunning) {
        const selector = String((args._ && Array.isArray(args._) && args._[0]) || args.selector || '');
        if (!selector) {
            console.log('Usage: click "#selector"');
            return;
        }
        try {
            const result = await daemonRequest('/click', 'POST', { selector });
            console.log(`Clicked: ${selector}`);
        } catch (err) {
            console.error('Error:', err.message);
        }
        return;
    }
    // 回退到直接连接
    if (!client || !client.isConnected()) {
        console.log('Not connected. Use "connect --electron-port <port>" first.');
        return;
    }
    const selector = String((args._ && Array.isArray(args._) && args._[0]) || args.selector || '');
    if (!selector) {
        console.log('Usage: click "#selector"');
        return;
    }
    const doc = await client.getDocument();
    const nodeId = await client.querySelector(doc.nodeId, selector);
    if (!nodeId) {
        console.log(`Element not found: ${selector}`);
        return;
    }
    await client.evaluate(`(function() {
      const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
      if (el) { el.click(); return true; }
      return false;
    })()`);
    console.log(`Clicked: ${selector}`);
}
```

- [ ] **Step 5: 类似修改其他命令** (dom, network, list-pages, switch-page, breakpoint, step, page)

对以下命令应用相同的模式：
- `cmdDom` - 使用 `/dom` 路由
- `cmdNetwork` - 使用 `/network` 路由
- `cmdListPages` - 使用 `/targets` 路由
- `cmdSwitchPage` - 使用 `/switch-target` 路由
- `cmdPage` - 可选
- `cmdBreakpoint`, `cmdStep` - 调试相关命令

- [ ] **Step 6: Commit**

```bash
git add dist/index.js
git commit -m "feat: update commands to use daemon HTTP API"
```

---

## Task 3: 更新 SKILL.md 文档

**Files:**
- Modify: `skills/electron-debug/SKILL.md`

- [ ] **Step 1: 更新中文入口部分**

找到 "中文入口" 部分，更新为：

```markdown
## 中文入口

**什么时候用这个技能？**
- 调试 Electron 应用
- 帮朋友/自己排查"按钮点了没反应"的问题
- 看控制台有没有报错
- 抓包看网络请求
- 自动点页面上的按钮/输入框
- 截图看看页面长什么样
- AI 自动诊断问题

**使用流程：**
1. 首次使用需要连接：`/electron-debug connect --electron-port 9333`
2. 后续所有命令直接使用，无需重复连接
3. 调试完成后断开：`/electron-debug disconnect`

**常用场景：**
- "debug Electron" → 自动连接调试
- "Electron 按钮没反应" → 自动点击+诊断
- "Electron 控制台报错" → 查看 console 错误
- "Electron 网络请求" → 抓包分析
- "Electron 截图" → 看看页面啥样
- "测试 Electron" → 自动化操作测试
```

- [ ] **Step 2: 简化命令文档**

移除所有 `--electron-port` 参数说明，因为后续调用不需要：

```markdown
## 连接管理

```bash
# 首次连接（需要指定端口）
/electron-debug connect --electron-port 9333

# 查看连接状态
/electron-debug status

# 断开连接
/electron-debug disconnect
```
```

- [ ] **Step 3: Commit**

```bash
git add skills/electron-debug/SKILL.md
git commit -m "docs: update SKILL.md with auto-connect usage"
```

---

## Task 4: 端到端测试

**Files:**
- Test: Electron app at `/Users/louye/claude-project/electron-tutorial/demos/05-cdp-debugging`

- [ ] **Step 1: 启动 Electron 测试应用**

```bash
cd /Users/louye/claude-project/electron-tutorial/demos/05-cdp-debugging
npm run debug 2>&1 &
sleep 3
echo "Electron started on port 9333"
```

- [ ] **Step 2: 测试完整流程**

```bash
# 首次连接
node bin/cli.js connect --electron-port 9333
# 预期：Connected to 127.0.0.1:9333

# 后续命令（无需指定端口）
node bin/cli.js status
node bin/cli.js screenshot
node bin/cli.js click "#btn"
node bin/cli.js eval "document.title"
node bin/cli.js console

# 断开
node bin/cli.js disconnect
```

- [ ] **Step 3: 测试自动重连**

```bash
# daemon stop
node bin/cli.js daemon stop

# 再运行命令，应该自动启动 daemon
node bin/cli.js status
# 预期：自动启动 daemon 并显示状态
```

- [ ] **Step 4: Commit 最终版本**

```bash
git add -A
git commit -m "feat: complete electron-debug implementation"
git push
```

---

## 验证清单

- [ ] `connect --electron-port 9333` 成功连接
- [ ] `status` 显示连接状态
- [ ] `screenshot` 返回截图
- [ ] `click "#selector"` 点击元素
- [ ] `eval "expression"` 执行 JS
- [ ] `console` 显示日志
- [ ] `disconnect` 断开连接
- [ ] 新命令调用自动使用已有连接
- [ ] daemon 停止后新命令自动重启 daemon
