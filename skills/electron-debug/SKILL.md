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

**使用流程：**
1. 先启动 Electron： `electron . --remote-debugging-port=9333`
2. 首次连接：`/electron-debug connect --electron-port 9333`
3. 后续所有命令直接使用，无需重复连接
4. 调试完成后断开：`/electron-debug disconnect`

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

### 场景1：调试按钮点击无反应

**用户问 Claude：**
> "我点了 Electron App 里的提交按钮，但是页面啥反应都没有，帮我看看是咋回事"

**Claude 会自动调度 skill 工具：**
1. 连接 Electron：`/electron-debug connect --electron-port 9333`
2. 截图看页面状态
3. 点击那个按钮
4. 截图对比点击前后
5. 查看控制台有没有报错
6. 检查 DOM 看看按钮状态
7. AI 诊断可能的原因

---

### 场景2：排查白屏问题

**用户问 Claude：**
> "Electron 应用打开后页面是白的，什么都没显示，帮我排查一下"

**Claude 会自动调度 skill 工具：**
1. 连接 Electron
2. 截图确认白屏
3. 执行 JS 查看 `document.body.innerHTML` 看看 DOM 树
4. 查看控制台错误
5. 检查网络请求是否成功
6. 给出诊断结果

---

### 场景3：分析页面加载性能

**用户问 Claude：**
> "这个 Electron 页面加载好慢，帮我看看是哪一步卡住了"

**Claude 会自动调度 skill 工具：**
1. 连接 Electron
2. 开启网络监控：`/electron-debug network --watch`
3. 刷新页面
4. 分析每个请求的耗时
5. 找出最慢的请求
6. 给出优化建议

---

### 场景4：检查表单验证问题

**用户问 Claude：**
> "表单填完了点提交没反应，是不是前端验证有问题？帮我看看"

**Claude 会自动调度 skill 工具：**
1. 连接 Electron
2. 执行 `form.checkValidity()` 检查表单验证状态
3. 查看每个 input 的 validity 详情
4. 查看控制台有没有验证错误日志
5. 告诉你是哪个字段验证失败了

---

### 场景5：抓包看登录请求

**用户问 Claude：**
> "我想看看这个 Electron 应用登录的时候发了什么请求，帮我抓个包"

**Claude 会自动调度 skill 工具：**
1. 连接 Electron
2. 开启网络监控
3. 用户在页面上操作登录
4. 分析捕获的请求
5. 显示登录 API 的请求参数和响应

---

### 场景6：自动化 UI 测试

**用户问 Claude：**
> "帮我测试一下购物车功能：连续把前5个商品都加入购物车，然后截图看看购物车页面"

**Claude 会自动调度 skill 工具：**
1. 连接 Electron
2. 点击第一个商品的"加入购物车"按钮
3. 截图
4. 点击第二个商品...
5. 直到第五个
6. 截图购物车页面
7. 查看购物车数量 badge
8. 断开连接
