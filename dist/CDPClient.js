import WebSocket from 'ws';
export class CDPClient {
    ws = null;
    messageId = 0;
    pendingRequests = new Map();
    eventHandlers = new Map();
    options;
    constructor(options) {
        this.options = { host: '127.0.0.1', secure: false, ...options };
    }
    async connect() {
        const { host, port, secure } = this.options;
        const protocol = secure ? 'wss' : 'ws';
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(`${protocol}://${host}:${port}`);
            this.ws.on('open', () => resolve());
            this.ws.on('error', reject);
            this.ws.on('message', (data) => this.handleMessage(data.toString()));
        });
    }
    // Connect directly to a target using its WebSocket URL
    async connectToTarget(wsUrl) {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(wsUrl);
            this.ws.on('open', () => resolve());
            this.ws.on('error', reject);
            this.ws.on('message', (data) => this.handleMessage(data.toString()));
        });
    }
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.pendingRequests.clear();
    }
    isConnected() {
        return this.ws?.readyState === WebSocket.OPEN;
    }
    async sendCommand(method, params) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket not connected');
        }
        const id = ++this.messageId;
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, {
                resolve: (value) => resolve(value),
                reject,
            });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(handler);
    }
    off(event, handler) {
        this.eventHandlers.get(event)?.delete(handler);
    }
    handleMessage(data) {
        const message = JSON.parse(data);
        // Handle response
        if ('id' in message) {
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                this.pendingRequests.delete(message.id);
                if (message.error) {
                    pending.reject(new Error(`${message.error.code}: ${message.error.message}`));
                }
                else {
                    pending.resolve(message.result);
                }
            }
            return;
        }
        // Handle event
        if ('method' in message) {
            // Capture console messages for later retrieval
            if (message.method === 'Console.messageAdded') {
                // Console.messageAdded has nested "message" object: { message: { level, text, ... } }
                const params = message.params;
                this.consoleMessages.push({
                    type: (params.message?.level ?? params.message?.type ?? 'log'),
                    text: params.message?.text ?? '',
                    timestamp: Date.now(),
                });
            }
            // Runtime.consoleAPICalled has direct params: { type, args: [{type, value}], ... }
            if (message.method === 'Runtime.consoleAPICalled') {
                const params = message.params;
                const text = params.args
                    ?.map((a) => a.value ?? a.description ?? String(a))
                    .join(' ') ?? '';
                this.consoleMessages.push({
                    type: (params.type ?? 'log'),
                    text,
                    timestamp: params.timestamp ?? Date.now(),
                });
            }
            const handlers = this.eventHandlers.get(message.method);
            if (handlers) {
                handlers.forEach((handler) => handler(message.params));
            }
        }
    }
    // Target/Page management
    async getTargets() {
        const result = await this.sendCommand('Target.getTargets');
        return result.targetInfos;
    }
    async attachToTarget(targetId) {
        const result = await this.sendCommand('Target.attachToTarget', { targetId });
        return result.sessionId;
    }
    // Page operations
    async navigate(url) {
        await this.sendCommand('Page.navigate', { url });
    }
    async captureScreenshot(format = 'png', quality) {
        const result = await this.sendCommand('Page.captureScreenshot', {
            format,
            quality,
        });
        return { data: result.data, timestamp: Date.now() };
    }
    async captureFullScreenshot() {
        const { data } = await this.sendCommand('Page.captureSnapshot');
        return { data, timestamp: Date.now() };
    }
    async getPageInfo() {
        const result = await this.sendCommand('Page.getLayoutMetrics');
        return {
            title: '',
            url: '',
            dimensions: {
                width: result.contentSize?.width ?? 0,
                height: result.contentSize?.height ?? 0,
            },
        };
    }
    // Console - store messages locally from events
    consoleMessages = [];
    async enableConsole() {
        // Clear previous messages
        this.consoleMessages = [];
        await this.sendCommand('Console.enable');
    }
    async getConsoleMessages() {
        return this.consoleMessages;
    }
    // Call this to retrieve buffered console messages (used internally after events)
    addConsoleMessage(msg) {
        this.consoleMessages.push(msg);
    }
    async enableRuntimeConsole() {
        // Enable Runtime to capture console API calls
        await this.sendCommand('Runtime.enable');
    }
    // Network
    async enableNetwork() {
        await this.sendCommand('Network.enable');
    }
    async disableNetwork() {
        await this.sendCommand('Network.disable');
    }
    async getNetworkRequests() {
        const result = await this.sendCommand('Network.getRequests');
        const requests = new Map();
        result.records.forEach((r) => requests.set(r.requestId, r));
        return { requests, responses: new Map() };
    }
    async getResponseBody(requestId) {
        const result = await this.sendCommand('Network.getResponseBody', { requestId });
        return result.base64Encoded ? Buffer.from(result.body, 'base64').toString() : result.body;
    }
    // DOM
    async getDocument() {
        const result = await this.sendCommand('DOM.getDocument');
        return result.root;
    }
    async querySelector(nodeId, selector) {
        const result = await this.sendCommand('DOM.querySelector', {
            nodeId,
            selector,
        });
        return result ? result.nodeId : null;
    }
    async getOuterHTML(nodeId) {
        const result = await this.sendCommand('DOM.getOuterHTML', { nodeId });
        return result.outerHTML;
    }
    async getAttributes(nodeId) {
        const result = await this.sendCommand('DOM.getAttributes', {
            nodeId,
        });
        return result.attributes;
    }
    async resolveNode(nodeId) {
        return this.sendCommand('DOM.resolveNode', { nodeId });
    }
    // Runtime
    async evaluate(expression, returnByValue = true) {
        const result = await this.sendCommand('Runtime.evaluate', {
            expression,
            returnByValue,
            generatePreview: true,
        });
        return result.result.value ?? result.result;
    }
    async callFunctionOn(functionDeclaration, objectId) {
        const result = await this.sendCommand('Runtime.callFunctionOn', {
            functionDeclaration,
            objectId,
        });
        return result.result.value;
    }
    async getProperties(objectId) {
        const result = await this.sendCommand('Runtime.getProperties', { objectId });
        return result.result.map((p) => ({ name: p.name, value: p.value.value }));
    }
    // Debugger
    async enableDebugger() {
        await this.sendCommand('Debugger.enable');
    }
    async setBreakpoint(url, lineNumber, columnNumber) {
        const result = await this.sendCommand('Debugger.setBreakpointByUrl', {
            lineNumber,
            columnNumber,
            url,
        });
        return result.breakpointId;
    }
    async listBreakpoints() {
        const result = await this.sendCommand('Debugger.getBreakpoints');
        return result.breakpoints;
    }
    async stepNext() {
        await this.sendCommand('Debugger.stepNext');
    }
    async stepInto() {
        await this.sendCommand('Debugger.stepInto');
    }
    async stepOut() {
        await this.sendCommand('Debugger.stepOut');
    }
    async resume() {
        await this.sendCommand('Debugger.resume');
    }
    // Log
    async enableLog() {
        await this.sendCommand('Log.enable');
    }
    async getLogEntries() {
        return this.sendCommand('Log.getEntries');
    }
}
