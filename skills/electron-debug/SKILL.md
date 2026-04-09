---
name: electron-debug
description: |
  Electron 应用调试技能，调试 Electron 应用的完整 CDP (Chrome DevTools Protocol) 工具。
  Use this skill whenever the user wants to:
  - Debug an Electron application
  - Inspect DOM elements, console logs, or network requests in Electron
  - Click elements or execute JavaScript in an Electron renderer
  - Take screenshots of an Electron window
  - Diagnose issues with Electron apps (button clicks not working, page loads slowly, data not displaying)
  - Connect to a running Electron app via Chrome DevTools Protocol
  - Test Electron app interactions programmatically

  This skill is NOT for debugging web pages in regular browsers — use Chrome DevTools directly for that.

  Trigger phrases include: "debug Electron", "Electron button click", "Electron console", "Electron network", "Electron screenshot", "test Electron", "Electron diagnose"
---

# electron-debug

Electron 应用调试技能，支持 Chrome DevTools Protocol (CDP) 完整调试能力。

## 中文入口

**什么时候用这个技能？**
- 调试 Electron 应用
- 帮朋友/自己排查"按钮点了没反应"的问题
- 看控制台有没有报错
- 抓包看网络请求
- 自动点页面上的按钮/输入框
- 截图看看页面长什么样
- AI 自动诊断问题

**一句话使用流程：**
1. 先启动 Electron： `electron . --remote-debugging-port=9333`
2. 连接：`/electron-debug connect --electron-port 9333`
3. 开始调试
4. 断连：`/electron-debug disconnect`

**常用场景：**
- "debug Electron" → 自动连接调试
- "Electron 按钮没反应" → 自动点击+诊断
- "Electron 控制台报错" → 查看 console 错误
- "Electron 网络请求" → 抓包分析
- "Electron 截图" → 看看页面啥样
- "测试 Electron" → 自动化操作测试

## 连接管理

```bash
# 启动 daemon 并连接到 Electron (推荐)
/electron-debug connect --electron-port 9333

# 查看连接状态
/electron-debug status

# 断开连接并停止 daemon
/electron-debug disconnect
```

## Daemon 管理

```bash
# 启动 daemon 并连接
/electron-debug daemon start --electron-port 9333

# 查看 daemon 状态
/electron-debug daemon status

# 停止 daemon
/electron-debug daemon stop
```

## 页面操作

```bash
# 列出所有可调试页面
/electron-debug list-pages

# 切换到其他页面
/electron-debug switch-page --id <pageId>

# 截图 (显示 base64)
/electron-debug screenshot

# 截图并保存到文件
/electron-debug screenshot --path ./screenshot.png

# 全页面截图
/electron-debug screenshot --full
```

## 元素交互

```bash
# 点击元素 (CSS 选择器)
/electron-debug click "#btn1"
/electron-debug click ".button-class"
/electron-debug click "button[type='submit']"
/electron-debug click "ul > li:first-child"
```

## 执行 JavaScript

```bash
# 执行表达式
/electron-debug eval "document.title"
/electron-debug eval "navigator.userAgent"

/# 调用函数
/electron-debug eval "Math.random()"

/# 多行表达式
/electron-debug eval "(() => { return document.querySelector('#output').textContent; })()"
```

## DOM 查询

```bash
# 查询元素
/electron-debug dom --selector "#my-element"
/electron-debug dom --selector ".class-name"

/# 查看元素属性
/electron-debug dom --selector "#my-input" --props "id,value,disabled"
```

## 控制台 (Console)

```bash
# 查看控制台日志
/electron-debug console

# 过滤日志类型
/electron-debug console --type log
/electron-debug console --type warn
/electron-debug console --type error
/electron-debug console --type info

# 监听新的控制台消息
/electron-debug console --watch

# 清除控制台缓存
/electron-debug console --clear
```

## 网络 (Network)

```bash
# 查看最近的网络请求
/electron-debug network

# 查看特定请求详情
/electron-debug network --request <requestId>

# 监听新的网络请求
/electron-debug network --watch

# 暂停/恢复网络监控
/electron-debug network --pause
/electron-debug network --resume
```

## 调试器 (Debugger)

```bash
# 设置断点
/electron-debug breakpoint --url <file> --line <num>

# 列出所有断点
/electron-debug breakpoint --list

# 单步执行
/electron-debug step --action next
/electron-debug step --action in
/electron-debug step --action out
```

## 主进程调试

```bash
# 连接主进程调试器 (需要 --inspect 启动)
/electron-debug main-connect --port 9229

# 查看主进程日志
/electron-debug main-logs
```

## AI 辅助诊断

```bash
# 描述问题，自动收集调试信息
/electron-debug diagnose "按钮点击没反应"
/electron-debug diagnose "页面加载很慢"
/electron-debug diagnose "数据显示不正确"
/electron-debug diagnose "表单提交失败"
```

## 使用示例

### 完整调试流程

```bash
# 1. 连接 Electron
/electron-debug connect --electron-port 9333

# 2. 查看页面信息
/electron-debug list-pages
/electron-debug screenshot

# 3. 点击按钮并检查结果
/electron-debug click "#btn1"
/electron-debug eval "document.querySelector('#output').textContent"
/electron-debug console

# 4. AI 诊断问题
/electron-debug diagnose "点击按钮1后输出区域没有更新"

# 5. 断开连接
/electron-debug disconnect
```

### 连续操作测试

```bash
# 连接
/electron-debug connect --electron-port 9333

# 点击按钮1
/electron-debug click "#btn1"
/electron-debug screenshot --path step1.png
/electron-debug eval "document.querySelector('#counter').textContent"

# 点击按钮2
/electron-debug click "#btn2"
/electron-debug screenshot --path step2.png
/electron-debug eval "document.querySelector('#counter').textContent"

# 点击按钮3
/electron-debug click "#btn3"
/electron-debug screenshot --path step3.png

# 查看所有控制台输出
/electron-debug console

# 断开
/electron-debug disconnect
```

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

### 场景6：自动化测试 - 连续点10个商品加入购物车

```
/electron-debug connect --electron-port 9333
/electron-debug click ".product:nth-child(1) .add-cart"
/electron-debug screenshot --path cart1.png
/electron-debug click ".product:nth-child(2) .add-cart"
/electron-debug screenshot --path cart2.png
/electron-debug click ".product:nth-child(3) .add-cart"
/electron-debug screenshot --path cart3.png
/electron-debug eval "document.querySelector('.cart-badge').textContent"
# 断开
/electron-debug disconnect
```
