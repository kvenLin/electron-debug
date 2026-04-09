# Screenshot Auto-Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `screenshot` is run without `--path`, auto-save to `process.cwd()/screenshot-{YYYYMMDD}-{HHMMSS}.png`

**Architecture:** Simple change - generate timestamped filename when no path provided, save to current working directory instead of printing base64.

**Tech Stack:** Node.js, pure JavaScript (no external deps for this change)

---

## Files

- Modify: `dist/index.js` (line ~507-547, `cmdScreenshot` function)

---

## Task 1: Update cmdScreenshot to auto-save with timestamp

**Files:**
- Modify: `dist/index.js:507-547`

- [ ] **Step 1: Read current cmdScreenshot implementation**

Run: `sed -n '507,547p' dist/index.js`

- [ ] **Step 2: Update daemon mode branch (lines 509-526)**

Replace lines 510-526 with:

```javascript
async function cmdScreenshot(args) {
    const isDaemonRunning = await daemonCheck();
    if (isDaemonRunning) {
        const specifiedPath = String(args.path || '');
        try {
            const result = await daemonRequest('/screenshot', 'GET');
            let savePath = specifiedPath;
            if (!savePath) {
                const now = new Date();
                const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
                savePath = `${process.cwd()}/screenshot-${timestamp}.png`;
            }
            const fs = await import('fs/promises');
            const buffer = Buffer.from(result.data, 'base64');
            await fs.writeFile(savePath, buffer);
            console.log(`Screenshot saved to: ${savePath}`);
        } catch (err) {
            console.error('Error:', err.message);
        }
        return;
    }
```

- [ ] **Step 3: Update direct mode branch (lines 528-546)**

Replace lines 528-546 with:

```javascript
    if (!client || !client.isConnected()) {
        console.log('Not connected. Use "daemon start" or "connect" first.');
        return;
    }
    const specifiedPath = String(args.path || '');
    const format = args.jpeg ? 'jpeg' : 'png';
    const quality = args.jpeg ? 80 : undefined;
    const result = await client.captureScreenshot(format, quality);
    let savePath = specifiedPath;
    if (!savePath) {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
        savePath = `${process.cwd()}/screenshot-${timestamp}.png`;
    }
    const fs = await import('fs/promises');
    const buffer = Buffer.from(result.data, 'base64');
    await fs.writeFile(savePath, buffer);
    console.log(`Screenshot saved to: ${savePath}`);
}
```

- [ ] **Step 4: Verify the change compiles**

Run: `node --check dist/index.js`
Expected: No output (success)

- [ ] **Step 5: Test screenshot with auto-path**

Run:
```bash
cd /tmp
electron-debug screenshot
ls -la screenshot-*.png
```
Expected: Screenshot file created in /tmp with timestamp name

- [ ] **Step 6: Test screenshot with explicit path still works**

Run:
```bash
electron-debug screenshot --path /tmp/test-explicit.png
ls -la /tmp/test-explicit.png
```
Expected: Screenshot file created at specified path

- [ ] **Step 7: Commit**

```bash
git add dist/index.js
git commit -m "feat: auto-save screenshot to cwd with timestamp when no path specified"
```

---

## Verification

After implementation:
1. `electron-debug screenshot` in any directory → creates `screenshot-{timestamp}.png` in that directory
2. `electron-debug screenshot --path /tmp/custom.png` → creates file at `/tmp/custom.png` (unchanged behavior)
