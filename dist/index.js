#!/usr/bin/env node
import { spawn } from 'child_process';
import { CDPClient } from './CDPClient.js';
import http from 'http';
// Global state
let client = null;
let currentTargetId = null;
let consoleWatcher = false;
let networkWatcher = false;
let connectionHost = '127.0.0.1';
let connectionPort = 9222;
let daemonProcess = null;
const DAEMON_PORT = 9229;
// Daemon helper functions
async function daemonRequest(endpoint, method, body) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: DAEMON_PORT,
            path: endpoint,
            method,
            headers: { 'Content-Type': 'application/json' },
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.success)
                        resolve(json.data);
                    else
                        reject(new Error(json.error ?? 'Unknown error'));
                }
                catch {
                    reject(new Error(data));
                }
            });
        });
        req.on('error', reject);
        if (body)
            req.write(JSON.stringify(body));
        req.end();
    });
}
async function daemonCheck() {
    return new Promise((resolve) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: DAEMON_PORT,
            path: '/status',
            method: 'GET',
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.success && json.data?.running === true);
                }
                catch {
                    resolve(false);
                }
            });
        });
        req.on('error', () => resolve(false));
        req.end();
    });
}
async function daemonStatus() {
    return new Promise((resolve) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: DAEMON_PORT,
            path: '/status',
            method: 'GET',
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.success && json.data)
                        resolve(json.data);
                    else
                        resolve({ running: false, connected: false });
                }
                catch {
                    resolve({ running: false, connected: false });
                }
            });
        });
        req.on('error', () => resolve({ running: false, connected: false }));
        req.end();
    });
}

/**
 * 自动管理 daemon 连接
 * 如果 daemon 未运行，自动启动
 * 如果 daemon 未连接，自动连接
 * 返回 daemonStatus 信息
 */
async function ensureDaemon(args) {
    const electronPort = Number(args.electronPort) || Number(args.port) || 9222;
    const electronHost = args.host ? String(args.host) : '127.0.0.1';

    // 如果是 connect 或 daemon 命令，不需要自动连接
    const command = args._ && Array.isArray(args._) ? args._[0] : '';
    if (command === 'connect' || command === 'daemon') {
        return { started: false, running: false, connected: false };
    }

    // 检查 daemon 是否运行
    const isRunning = await daemonCheck();
    if (!isRunning) {
        // 自动启动 daemon
        console.log('Daemon not running, starting...');
        await cmdDaemonStart({ electronPort, electronHost });
    }

    // 检查是否已连接
    const status = await daemonStatus();
    if (!status.connected) {
        console.log('Not connected to Electron, connecting...');
        await daemonRequest('/connect', 'POST', { host: electronHost, port: electronPort });
    }

    return { started: !isRunning, running: true, connected: true };
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
    return status;
}

function parseArgs(argv) {
    const command = argv[2] || 'status';
    const args = {};

    // Parse all arguments starting from index 3
    for (let i = 3; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith('--')) {
            let key = arg.slice(2);
            // Convert hyphenated keys to camelCase (e.g., electron-port -> electronPort)
            key = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
            const next = argv[i + 1];
            if (next && !next.startsWith('--')) {
                // Try to parse as number
                const num = Number(next);
                args[key] = isNaN(num) ? next : num;
                i++;
            }
            else {
                args[key] = true;
            }
        }
        else if (!args._) {
            // First non-flag argument is the subcommand for daemon
            args._ = [arg];
        }
    }

    // If no command was set, default to status
    if (command === 'daemon' && !args._[0]) {
        args._ = [''];
    }

    return { command, args };
}
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
        case 'disconnect':
            cmdDisconnect();
            break;
        case 'status':
            await cmdStatus();
            break;
        case 'list-pages':
            await cmdListPages(args);
            break;
        case 'switch-page':
            await cmdSwitchPage(args);
            break;
        case 'console':
            await cmdConsole(args);
            break;
        case 'network':
            await cmdNetwork(args);
            break;
        case 'screenshot':
            await cmdScreenshot(args);
            break;
        case 'dom':
            await cmdDom(args);
            break;
        case 'eval':
            await cmdEval(args);
            break;
        case 'call':
            await cmdEval(args); // call is similar to eval
            break;
        case 'breakpoint':
            await cmdBreakpoint(args);
            break;
        case 'step':
            await cmdStep(args);
            break;
        case 'main-connect':
            await cmdMainConnect(args);
            break;
        case 'main-logs':
            await cmdMainLogs();
            break;
        case 'diagnose':
            await cmdDiagnose(args);
            break;
        case 'page':
            await cmdPage(args);
            break;
        case 'click':
            await cmdClick(args);
            break;
        case 'daemon':
            await cmdDaemon(args);
            break;
        default:
            console.log(`Unknown command: ${command}`);
            console.log('Use --help to see available commands');
    }
}
// Command implementations
async function cmdConnect(args) {
    const electronPort = Number(args.electronPort) || Number(args.port) || 9222;
    const electronHost = args.host ? String(args.host) : '127.0.0.1';

    // Check if daemon is running
    const isRunning = await daemonCheck();
    if (!isRunning) {
        // Start daemon first
        console.log('Starting daemon...');
        await cmdDaemonStart({ electronPort, electronHost });
    }

    // Ask daemon to connect to Electron
    try {
        const result = await daemonRequest('/connect', 'POST', { host: electronHost, port: electronPort });
        console.log(`Connected to ${electronHost}:${electronPort}`);
        if (result.target) {
            console.log(`Attached to: ${result.target.title} (${result.target.url})`);
        }
    } catch (err) {
        console.error('Failed to connect:', err.message);
    }
}
async function cmdDisconnect() {
    // Check if daemon is running
    const isRunning = await daemonCheck();
    if (!isRunning) {
        console.log('Not connected');
        return;
    }

    // Tell daemon to disconnect
    try {
        await daemonRequest('/disconnect', 'POST', {});
        console.log('Disconnected from Electron');
    } catch (err) {
        console.error('Error:', err.message);
    }
}
async function cmdStatus() {
    // Check daemon status
    const status = await daemonStatus();
    if (!status.running) {
        console.log('Daemon: Not running');
        console.log('Use "connect --electron-port <port>" to start');
        return;
    }
    console.log('Daemon: Running');
    console.log(`Connected to Electron: ${status.connected ? 'Yes' : 'No'}`);
    if (status.electronPort) {
        console.log(`Electron port: ${status.electronPort}`);
    }
    if (status.targetTitle) {
        console.log(`Target: ${status.targetTitle}`);
    }
}
async function cmdListPages(args) {
    // Use daemon API
    const isDaemonRunning = await daemonCheck();
    if (isDaemonRunning) {
        try {
            const targets = await daemonRequest('/targets', 'GET');
            console.log('\nAvailable Pages:');
            console.log('─'.repeat(60));
            (targets || [])
                .filter((t) => t.type === 'page')
                .forEach((t, i) => {
                const marker = t.id === currentTargetId ? '→ ' : '  ';
                console.log(`${marker}[${i + 1}] ${t.title}`);
                console.log(`     URL: ${t.url}`);
                console.log(`     ID: ${t.id}`);
                console.log('');
            });
        }
        catch (err) {
            console.error('Error:', err.message);
        }
        return;
    }
    // Fallback to direct connection
    const port = Number(args.port) || connectionPort;
    const host = args.host ? String(args.host) : connectionHost;
    const http = await import('http');
    const targetsJson = await new Promise((resolve, reject) => {
        http.get(`http://${host}:${port}/json`, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resolve(data));
            res.on('error', reject);
        }).on('error', reject);
    });
    const targets = JSON.parse(targetsJson);
    console.log('\nAvailable Pages:');
    console.log('─'.repeat(60));
    targets
        .filter((t) => t.type === 'page')
        .forEach((t, i) => {
        const marker = t.id === currentTargetId ? '→ ' : '  ';
        console.log(`${marker}[${i + 1}] ${t.title}`);
        console.log(`     URL: ${t.url}`);
        console.log(`     ID: ${t.id}`);
        console.log('');
    });
}
async function cmdSwitchPage(args) {
    if (!client) {
        console.log('Not connected.');
        return;
    }
    const targetId = String(args.id);
    // Fetch targets via HTTP to get WebSocket URL
    const http = await import('http');
    const targetsJson = await new Promise((resolve, reject) => {
        http.get(`http://${connectionHost}:${connectionPort}/json`, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resolve(data));
            res.on('error', reject);
        }).on('error', reject);
    });
    const targets = JSON.parse(targetsJson);
    const target = targets.find((t) => t.id === targetId);
    if (!target) {
        console.log(`Target not found: ${targetId}`);
        return;
    }
    client.disconnect();
    await client.connectToTarget(target.webSocketDebuggerUrl);
    currentTargetId = targetId;
    console.log(`Switched to: ${target.title}`);
}
async function cmdConsole(args) {
    // Try daemon mode first
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
    // Direct mode
    if (!client) {
        console.log('Not connected.');
        return;
    }
    if (args.watch) {
        consoleWatcher = true;
        await client.enableConsole();
        console.log('Watching console... (Ctrl+C to stop)');
        client.on('Console.messageAdded', (params) => {
            const msg = params;
            const time = msg.timestamp ? new Date(msg.timestamp).toISOString() : '';
            console.log(`[${time}] [${msg.type}] ${msg.text}`);
        });
        return;
    }
    if (args.clear) {
        console.log('Console cleared');
        return;
    }
    const messages = await client.getConsoleMessages();
    const filterType = String(args.type || 'all');
    console.log('\nConsole Messages:');
    console.log('─'.repeat(60));
    messages
        .filter((m) => filterType === 'all' || m.type === filterType)
        .forEach((m) => {
        console.log(`[${m.type}] ${m.text}`);
        if (m.args?.length) {
            console.log('  Args:', m.args);
        }
    });
}
async function cmdNetwork(args) {
    // Try daemon mode first (for non-watch modes)
    if (!args.watch && !args.pause && !args.resume && !args.request) {
        const isDaemonRunning = await daemonCheck();
        if (isDaemonRunning) {
            try {
                const result = await daemonRequest('/network', 'GET');
                if (result.requests && result.requests.length > 0) {
                    console.log('\nNetwork Requests:');
                    console.log('─'.repeat(60));
                    result.requests.forEach((req) => {
                        console.log(`→ ${req.method} ${req.url}`);
                    });
                }
                else {
                    console.log('No network requests recorded.');
                }
                if (result.responses && result.responses.length > 0) {
                    console.log('\nNetwork Responses:');
                    console.log('─'.repeat(60));
                    result.responses.forEach((resp) => {
                        console.log(`← [${resp.status}] ${resp.url}`);
                    });
                }
            } catch (err) {
                console.error('Error:', err.message);
            }
            return;
        }
    }
    // Direct mode (or watch mode)
    if (!client) {
        console.log('Not connected.');
        return;
    }
    if (args.watch) {
        networkWatcher = true;
        await client.enableNetwork();
        console.log('Watching network... (Ctrl+C to stop)');
        client.on('Network.requestWillBeSent', (params) => {
            const req = params;
            console.log(`→ ${req.request.method} ${req.request.url}`);
        });
        client.on('Network.responseReceived', (params) => {
            const resp = params;
            console.log(`← [${resp.response.status}] ${resp.response.url}`);
        });
        return;
    }
    if (args.pause) {
        await client.disableNetwork();
        console.log('Network monitoring paused');
        return;
    }
    if (args.resume) {
        await client.enableNetwork();
        console.log('Network monitoring resumed');
        return;
    }
    if (args.request) {
        const body = await client.getResponseBody(String(args.request));
        console.log('\nResponse Body:');
        console.log('─'.repeat(60));
        console.log(body);
        return;
    }
    // Default: show recent requests
    await client.enableNetwork();
    console.log('Network monitoring enabled (use --watch to stream)');
}
async function cmdScreenshot(args) {
    // Try daemon mode first
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
    // Direct mode
    if (!client || !client.isConnected()) {
        console.log('Not connected. Use "daemon start" or "connect" first.');
        return;
    }
    const path = String(args.path || '');
    const format = args.jpeg ? 'jpeg' : 'png';
    const quality = args.jpeg ? 80 : undefined;
    const result = await client.captureScreenshot(format, quality);
    if (path) {
        const fs = await import('fs/promises');
        const buffer = Buffer.from(result.data, 'base64');
        await fs.writeFile(path, buffer);
        console.log(`Screenshot saved to: ${path}`);
    }
    else {
        console.log(`Screenshot captured (${result.data.length} bytes, base64)`);
        console.log(`Preview: data:image/${format};base64,${result.data.slice(0, 100)}...`);
    }
}
async function cmdDom(args) {
    // Try daemon mode first
    const isDaemonRunning = await daemonCheck();
    if (isDaemonRunning) {
        const selector = String(args.selector || 'body');
        const props = String(args.props || '');
        try {
            const result = await daemonRequest('/dom', 'POST', { selector, props });
            console.log(`\nElement: ${selector}`);
            console.log('─'.repeat(60));
            console.log('HTML:', (result.html || '').slice(0, 500));
            if (result.attrs && props) {
                console.log('\nAttributes:');
                result.attrs
                    .filter(([name]) => props.split(',').map((p) => p.trim()).includes(name))
                    .forEach(([name, value]) => {
                    console.log(`  ${name}="${value}"`);
                });
            }
        } catch (err) {
            console.error('Error:', err.message);
        }
        return;
    }
    // Direct mode
    if (!client) {
        console.log('Not connected.');
        return;
    }
    const selector = String(args.selector || 'body');
    const props = String(args.props || '');
    const doc = await client.getDocument();
    const nodeId = await client.querySelector(doc.nodeId, selector);
    if (!nodeId) {
        console.log(`Element not found: ${selector}`);
        return;
    }
    console.log(`\nElement: ${selector}`);
    console.log('─'.repeat(60));
    const html = await client.getOuterHTML(nodeId);
    console.log('HTML:', html.slice(0, 500));
    if (props) {
        const attrs = await client.getAttributes(nodeId);
        console.log('\nAttributes:');
        attrs
            .filter(([name]) => props.split(',').map((p) => p.trim()).includes(name))
            .forEach(([name, value]) => {
            console.log(`  ${name}="${value}"`);
        });
    }
}
async function cmdEval(args) {
    // Try daemon mode first
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
            }
            else {
                console.log(result);
            }
        } catch (err) {
            console.error('Error:', err.message);
        }
        return;
    }
    // Direct mode
    if (!client) {
        console.log('Not connected.');
        return;
    }
    const expr = String((args._ && Array.isArray(args._) && args._[0]) || args.expression || ''); // Handle positional arg
    if (!expr) {
        console.log('No expression provided. Usage: eval "document.title"');
        return;
    }
    const result = await client.evaluate(expr);
    if (typeof result === 'object') {
        console.log(JSON.stringify(result, null, 2));
    }
    else {
        console.log(result);
    }
}
async function cmdBreakpoint(args) {
    if (!client) {
        console.log('Not connected.');
        return;
    }
    await client.enableDebugger();
    if (args.list) {
        const breakpoints = await client.listBreakpoints();
        console.log('\nBreakpoints:');
        console.log('─'.repeat(60));
        breakpoints.forEach((bp, i) => {
            console.log(`[${i + 1}] ${bp.location.url}:${bp.location.lineNumber}`);
        });
        return;
    }
    const url = String(args.url || '');
    const line = Number(args.line) || 0;
    if (!url || !line) {
        console.log('Usage: breakpoint --url <file> --line <num>');
        return;
    }
    const id = await client.setBreakpoint(url, line);
    console.log(`Breakpoint set: ${id}`);
}
async function cmdStep(args) {
    if (!client) {
        console.log('Not connected.');
        return;
    }
    const action = String(args.action || 'next');
    switch (action) {
        case 'next':
            await client.stepNext();
            break;
        case 'in':
            await client.stepInto();
            break;
        case 'out':
            await client.stepOut();
            break;
        default:
            await client.resume();
    }
    console.log(`Step: ${action}`);
}
async function cmdMainConnect(args) {
    // Main process uses different debugging protocol (V8 Inspector Protocol)
    const port = Number(args.port) || 9229;
    const http = await import('http');
    return new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/json`, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    const targets = JSON.parse(data);
                    console.log('Main Process Debugger');
                    console.log('─'.repeat(60));
                    console.log(`WebSocket URL: ${targets[0]?.webSocketDebuggerUrl}`);
                    console.log('\nConnect using:');
                    console.log(`  /electron-debug main-connect --port ${port}`);
                }
                catch {
                    console.log('Failed to parse debug info');
                }
                resolve();
            });
        });
        req.on('error', reject);
    });
}
async function cmdMainLogs() {
    if (!client) {
        console.log('Not connected.');
        return;
    }
    await client.enableLog();
    const entries = await client.getLogEntries();
    console.log('\nBrowser Logs:');
    console.log('─'.repeat(60));
    entries.entries.forEach((e) => {
        console.log(`[${e.level}] ${e.text}`);
    });
}
async function cmdDiagnose(args) {
    if (!client) {
        console.log('Not connected. Run "connect" first.');
        return;
    }
    const problem = String((args._ && Array.isArray(args._) && args._[0]) || args.problem || ''); // positional or --problem
    if (!problem) {
        console.log('Usage: /electron-debug diagnose "<问题描述>"');
        return;
    }
    console.log(`\n🔍 Diagnosing: "${problem}"`);
    console.log('─'.repeat(60));
    const findings = [];
    // Step 1: Check console for errors
    try {
        const messages = await client.getConsoleMessages();
        const errors = messages.filter((m) => m.type === 'error');
        if (errors.length > 0) {
            findings.push({
                type: 'error',
                message: `Found ${errors.length} console error(s)`,
                details: { errors: errors.map((e) => e.text) },
            });
        }
    }
    catch {
        // Console might not be enabled
    }
    // Step 2: Check network for failed requests
    try {
        await client.enableNetwork();
    }
    catch {
        // ignore
    }
    // Step 3: Try to get page info
    try {
        await client.enableConsole();
        const title = await client.evaluate('document.title');
        findings.push({
            type: 'info',
            message: `Page title: "${title}"`,
        });
    }
    catch {
        findings.push({
            type: 'warning',
            message: 'Could not evaluate page title',
        });
    }
    // Step 4: Check for common issues based on problem text
    const problemLower = problem.toLowerCase();
    if (problemLower.includes('点击') || problemLower.includes('click')) {
        findings.push({
            type: 'info',
            message: 'Tip: Check if click handlers are properly attached',
            details: { suggestion: 'Use Runtime.evaluate to check element.click() directly' },
        });
    }
    if (problemLower.includes('加载') || problemLower.includes('load')) {
        findings.push({
            type: 'info',
            message: 'Tip: Check Network panel for slow/failed requests',
            details: { suggestion: 'Use --watch to monitor network activity' },
        });
    }
    // Output findings
    console.log('\n📋 Findings:');
    findings.forEach((f, i) => {
        const icon = f.type === 'error' ? '❌' : f.type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`  ${icon} ${f.message}`);
        if (f.details) {
            console.log(`     → ${JSON.stringify(f.details)}`);
        }
    });
    // Suggestions
    console.log('\n💡 Next Steps:');
    console.log('  1. Check /electron-debug console --watch for real-time errors');
    console.log('  2. Run /electron-debug network --watch to monitor requests');
    console.log('  3. Try /electron-debug eval "<js expression>" to test behavior');
}
async function cmdPage(args) {
    if (!client) {
        console.log('Not connected.');
        return;
    }
    if (args.info) {
        try {
            const doc = await client.getDocument();
            console.log('\n📄 Page Info:');
            console.log('─'.repeat(60));
            console.log(`Root node ID: ${doc.nodeId}`);
            console.log(`Document URL: ${doc.documentURL || 'N/A'}`);
        }
        catch {
            console.log('Could not get page info');
        }
    }
}
async function cmdClick(args) {
    // Try daemon mode first
    const isDaemonRunning = await daemonCheck();
    if (isDaemonRunning) {
        const selector = String((args._ && Array.isArray(args._) && args._[0]) || args.selector || '');
        if (!selector) {
            console.log('Usage: click "#selector" or click --selector "#selector"');
            return;
        }
        try {
            const result = await daemonRequest('/click', 'POST', { selector });
            console.log(`Clicked: ${result.selector} (nodeId: ${result.nodeId})`);
        }
        catch (err) {
            console.error('Error:', err.message);
        }
        return;
    }
    // Direct mode
    if (!client || !client.isConnected()) {
        console.log('Not connected. Use "daemon start" or "connect" first.');
        return;
    }
    const selector = String((args._ && Array.isArray(args._) && args._[0]) || args.selector || '');
    if (!selector) {
        console.log('Usage: click "#selector" or click --selector "#selector"');
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
    console.log(`Clicked: ${selector} (nodeId: ${nodeId})`);
}
async function cmdDaemon(args) {
    const subCommand = (args._ && Array.isArray(args._) && args._[0]) || '';
    switch (subCommand) {
        case 'start':
            await cmdDaemonStart(args);
            break;
        case 'stop':
            await cmdDaemonStop();
            break;
        case 'status':
            await cmdDaemonStatus();
            break;
        default:
            console.log('Daemon commands:');
            console.log('  daemon start --electron-port <port>  Start daemon and connect to Electron');
            console.log('  daemon stop                          Stop the daemon');
            console.log('  daemon status                        Check daemon status');
    }
}
async function cmdDaemonStart(args) {
    const electronPort = Number(args.electronPort) || 9222;
    // Check if already running
    const isRunning = await daemonCheck();
    if (isRunning) {
        console.log('Daemon is already running. Use "daemon stop" first.');
        return;
    }
    console.log(`Starting daemon with electron-port ${electronPort}...`);
    // Spawn daemon process
    daemonProcess = spawn('node', ['dist/daemon.js', '--port', String(DAEMON_PORT), '--electron-port', String(electronPort)], {
        detached: true,
        stdio: 'ignore',
    });
    daemonProcess.unref();
    // Wait for daemon to start
    let attempts = 0;
    const maxAttempts = 20;
    while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const running = await daemonCheck();
        if (running) {
            console.log('Daemon started successfully.');
            // Auto-connect to Electron
            try {
                await daemonRequest('/connect', 'POST', {});
                console.log('Connected to Electron.');
            }
            catch (err) {
                console.log('Daemon started but could not connect to Electron:', err.message);
            }
            return;
        }
        attempts++;
    }
    console.error('Failed to start daemon: timeout waiting for it to become ready');
}
async function cmdDaemonStop() {
    const isRunning = await daemonCheck();
    if (!isRunning) {
        console.log('Daemon is not running.');
        return;
    }
    console.log('Stopping daemon...');
    try {
        await daemonRequest('/', 'DELETE', {});
        // Wait for daemon to stop
        await new Promise((resolve) => setTimeout(resolve, 500));
        console.log('Daemon stopped.');
    }
    catch (err) {
        console.error('Error stopping daemon:', err.message);
    }
}
async function cmdDaemonStatus() {
    const status = await daemonStatus();
    if (status.running) {
        console.log('Daemon: Running');
        console.log(`  Connected to Electron: ${status.connected ? 'Yes' : 'No'}`);
        if (status.electronPort) {
            console.log(`  Electron port: ${status.electronPort}`);
        }
    }
    else {
        console.log('Daemon: Not running');
        console.log('Use "daemon start --electron-port <port>" to start.');
    }
}
// Main
const argv = process.argv;
runCommand(parseArgs(argv)).catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
