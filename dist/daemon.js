import http from 'http';
import { CDPClient } from './CDPClient.js';
export class ElectronDebugDaemon {
    server;
    client = null;
    options;
    consoleMessages = [];
    networkRequests = [];
    networkResponses = [];
    currentTarget = null;
    running = false;
    constructor(options = {}) {
        this.options = {
            port: options.port ?? 9229,
            electronPort: options.electronPort ?? 9222,
            electronHost: options.electronHost ?? '127.0.0.1',
        };
        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res).catch((err) => {
                console.error('Request handler error:', err);
                this.sendJson(res, { success: false, error: String(err) });
            });
        });
    }
    async start() {
        if (this.running) {
            return;
        }
        return new Promise((resolve) => {
            this.server.listen(this.options.port, () => {
                this.running = true;
                console.log(`Daemon listening on http://localhost:${this.options.port}`);
                resolve();
            });
        });
    }
    stop() {
        if (this.client) {
            this.client.disconnect();
            this.client = null;
        }
        this.server.close();
        this.running = false;
    }
    isRunning() {
        return this.running;
    }
    async handleRequest(req, res) {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const pathname = url.pathname;
        const method = req.method?.toUpperCase() || 'GET';
        // Set CORS headers
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        // Parse request body for POST requests
        let body = {};
        if (method === 'POST') {
            const rawBody = await this.readBody(req);
            try {
                body = JSON.parse(rawBody);
            }
            catch {
                // Ignore parse errors
            }
        }
        // Route requests
        try {
            if (method === 'GET' && pathname === '/status') {
                await this.handleStatus(res);
            }
            else if (method === 'GET' && pathname === '/targets') {
                await this.handleTargets(res);
            }
            else if (method === 'GET' && pathname === '/console') {
                await this.handleConsole(res);
            }
            else if (method === 'GET' && pathname === '/screenshot') {
                await this.handleScreenshot(res);
            }
            else if (method === 'POST' && pathname === '/connect') {
                await this.handleConnect(res);
            }
            else if (method === 'POST' && pathname === '/switch-target') {
                await this.handleSwitchTarget(res, body);
            }
            else if (method === 'POST' && pathname === '/eval') {
                await this.handleEval(res, body);
            }
            else if (method === 'POST' && pathname === '/screenshot') {
                await this.handleScreenshot(res);
            }
            else if (method === 'POST' && pathname === '/click') {
                await this.handleClick(res, body);
            }
            else if (method === 'POST' && pathname === '/disconnect') {
                await this.handleDisconnect(res);
            }
            else if (method === 'DELETE' && pathname === '/') {
                await this.handleShutdown(res);
            }
            else {
                this.sendJson(res, { success: false, error: `Unknown route: ${method} ${pathname}` });
            }
        }
        catch (err) {
            this.sendJson(res, { success: false, error: String(err) });
        }
    }
    sendJson(res, data) {
        res.end(JSON.stringify(data));
    }
    readBody(req) {
        return new Promise((resolve) => {
            const chunks = [];
            req.on('data', (chunk) => chunks.push(chunk.toString()));
            req.on('end', () => resolve(chunks.join('')));
        });
    }
    // GET /status
    async handleStatus(res) {
        const status = {
            running: this.running,
            connected: this.client?.isConnected() ?? false,
            electronPort: this.options.electronPort,
            electronHost: this.options.electronHost,
        };
        if (this.currentTarget) {
            status.targetId = this.currentTarget.id;
            status.targetTitle = this.currentTarget.title;
        }
        this.sendJson(res, { success: true, data: status });
    }
    // GET /targets
    async handleTargets(res) {
        if (!this.client || !this.client.isConnected()) {
            this.sendJson(res, { success: false, error: 'Not connected to Electron' });
            return;
        }
        try {
            const targets = await this.client.getTargets();
            this.sendJson(res, { success: true, data: targets });
        }
        catch (err) {
            this.sendJson(res, { success: false, error: String(err) });
        }
    }
    // POST /connect
    async handleConnect(res) {
        try {
            // Get Electron targets via HTTP /json endpoint
            const httpRes = await fetch(`http://${this.options.electronHost}:${this.options.electronPort}/json`);
            if (!httpRes.ok) {
                throw new Error(`Failed to get targets: ${httpRes.status} ${httpRes.statusText}`);
            }
            const targets = await httpRes.json();
            // Find first page target
            const pageTarget = targets.find((t) => t.type === 'page');
            if (!pageTarget) {
                throw new Error('No page target found');
            }
            // Disconnect existing client
            if (this.client) {
                this.client.disconnect();
            }
            // Create new client and connect to target
            this.client = new CDPClient({
                host: this.options.electronHost,
                port: this.options.electronPort,
            });
            await this.client.connectToTarget(pageTarget.webSocketDebuggerUrl);
            // Store current target info
            this.currentTarget = {
                id: pageTarget.id,
                type: pageTarget.type,
                title: pageTarget.title,
                url: pageTarget.url,
                attached: true,
            };
            // Enable console and network events
            await this.client.enableConsole();
            await this.client.enableRuntimeConsole();
            await this.client.enableNetwork();
            // Set up event listeners for console and network
            this.client.on('Console.messageAdded', (params) => {
                const p = params;
                this.consoleMessages.push({
                    type: (p.message?.level ?? 'log'),
                    text: p.message?.text ?? '',
                    timestamp: Date.now(),
                });
            });
            this.client.on('Runtime.consoleAPICalled', (params) => {
                const p = params;
                const text = p.args
                    ?.map((a) => a.value ?? a.description ?? String(a))
                    .join(' ') ?? '';
                this.consoleMessages.push({
                    type: (p.type ?? 'log'),
                    text,
                    timestamp: p.timestamp ?? Date.now(),
                });
            });
            this.client.on('Network.requestWillBeSent', (params) => {
                const p = params;
                this.networkRequests.push({
                    requestId: p.requestId,
                    url: p.request.url,
                    method: p.request.method,
                    headers: p.request.headers,
                    documentURL: p.documentURL,
                });
            });
            this.client.on('Network.responseReceived', (params) => {
                const p = params;
                this.networkResponses.push({
                    requestId: p.requestId,
                    url: p.response.url,
                    status: p.response.status,
                    statusText: p.response.statusText,
                    headers: p.response.headers,
                });
            });
            this.sendJson(res, {
                success: true,
                data: { target: this.currentTarget, wsUrl: pageTarget.webSocketDebuggerUrl },
            });
        }
        catch (err) {
            this.sendJson(res, { success: false, error: String(err) });
        }
    }
    // POST /switch-target
    async handleSwitchTarget(res, body) {
        const targetId = body.targetId;
        if (!targetId) {
            this.sendJson(res, { success: false, error: 'Missing targetId' });
            return;
        }
        if (!this.client || !this.client.isConnected()) {
            this.sendJson(res, { success: false, error: 'Not connected to Electron' });
            return;
        }
        try {
            // Get fresh targets
            const httpRes = await fetch(`http://${this.options.electronHost}:${this.options.electronPort}/json`);
            const targets = await httpRes.json();
            const target = targets.find((t) => t.id === targetId);
            if (!target) {
                throw new Error(`Target not found: ${targetId}`);
            }
            // Disconnect from current target
            this.client.disconnect();
            // Connect to new target
            await this.client.connectToTarget(target.webSocketDebuggerUrl);
            // Update current target
            this.currentTarget = {
                id: target.id,
                type: target.type,
                title: target.title,
                url: target.url,
                attached: true,
            };
            // Re-enable events
            await this.client.enableConsole();
            await this.client.enableRuntimeConsole();
            await this.client.enableNetwork();
            this.sendJson(res, { success: true, data: this.currentTarget });
        }
        catch (err) {
            this.sendJson(res, { success: false, error: String(err) });
        }
    }
    // POST /eval
    async handleEval(res, body) {
        const expression = body.expression;
        if (!expression) {
            this.sendJson(res, { success: false, error: 'Missing expression' });
            return;
        }
        if (!this.client || !this.client.isConnected()) {
            this.sendJson(res, { success: false, error: 'Not connected to Electron' });
            return;
        }
        try {
            const result = await this.client.evaluate(expression);
            this.sendJson(res, { success: true, data: result });
        }
        catch (err) {
            this.sendJson(res, { success: false, error: String(err) });
        }
    }
    // GET/POST /screenshot
    async handleScreenshot(res) {
        if (!this.client || !this.client.isConnected()) {
            this.sendJson(res, { success: false, error: 'Not connected to Electron' });
            return;
        }
        try {
            const screenshot = await this.client.captureScreenshot('png');
            // For GET requests, return raw PNG (base64 decoded)
            // For POST requests, return JSON with base64
            const acceptHeader = res.req.headers.accept || '';
            if (acceptHeader.includes('image/png') || res.req.method === 'GET') {
                // Return raw PNG binary
                res.setHeader('Content-Type', 'image/png');
                const binary = Buffer.from(screenshot.data, 'base64');
                res.end(binary);
            }
            else {
                // Return JSON
                this.sendJson(res, { success: true, data: screenshot });
            }
        }
        catch (err) {
            this.sendJson(res, { success: false, error: String(err) });
        }
    }
    // POST /click
    async handleClick(res, body) {
        const selector = body.selector;
        if (!selector) {
            this.sendJson(res, { success: false, error: 'Missing selector' });
            return;
        }
        if (!this.client || !this.client.isConnected()) {
            this.sendJson(res, { success: false, error: 'Not connected to Electron' });
            return;
        }
        try {
            // Get document root
            const root = await this.client.getDocument();
            const nodeId = await this.client.querySelector(root.nodeId, selector);
            if (!nodeId) {
                this.sendJson(res, { success: false, error: `Element not found: ${selector}` });
                return;
            }
            // Simulate click using JavaScript
            await this.client.evaluate(`(function() {
          const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (el) {
            el.click();
            return true;
          }
          return false;
        })()`);
            this.sendJson(res, { success: true, data: { selector, nodeId } });
        }
        catch (err) {
            this.sendJson(res, { success: false, error: String(err) });
        }
    }
    // GET /console
    async handleConsole(res) {
        if (!this.client || !this.client.isConnected()) {
            this.sendJson(res, { success: false, error: 'Not connected to Electron' });
            return;
        }
        try {
            const messages = await this.client.getConsoleMessages();
            this.sendJson(res, { success: true, data: messages });
        }
        catch (err) {
            this.sendJson(res, { success: false, error: String(err) });
        }
    }
    // POST /disconnect
    async handleDisconnect(res) {
        if (this.client) {
            this.client.disconnect();
            this.client = null;
        }
        this.currentTarget = null;
        this.consoleMessages = [];
        this.networkRequests = [];
        this.networkResponses = [];
        this.sendJson(res, { success: true, data: { disconnected: true } });
    }
    // DELETE / (shutdown)
    async handleShutdown(res) {
        this.sendJson(res, { success: true, data: { shutdown: true } });
        // Give time for response to be sent
        setTimeout(() => {
            this.stop();
            process.exit(0);
        }, 100);
    }
}
// Allow running as standalone script
// Parse command-line arguments
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && i + 1 < args.length) {
        options.port = parseInt(args[i + 1], 10);
        i++;
    }
    else if (args[i] === '--electron-port' && i + 1 < args.length) {
        options.electronPort = parseInt(args[i + 1], 10);
        i++;
    }
    else if (args[i] === '--electron-host' && i + 1 < args.length) {
        options.electronHost = args[i + 1];
        i++;
    }
}
const daemon = new ElectronDebugDaemon(options);
daemon.start().catch(console.error);
process.on('SIGINT', () => {
    daemon.stop();
    process.exit(0);
});
