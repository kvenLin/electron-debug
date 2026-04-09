# Screenshot Path Design

## Summary

Improve screenshot command so that running without `--path` automatically saves to the current working directory with a timestamp, instead of outputting base64 to the terminal.

## Problem

Current behavior:
- `screenshot` → outputs base64 to terminal (hard to use)
- `screenshot --path /path/to/file.png` → saves to specified path

Users want: run `screenshot` without any args and have it Just Work™.

## Solution

When `--path` is not provided, automatically save to current working directory:

```
screenshot-{YYYYMMDD}-{HHMMSS}.png
```

Example: `screenshot-20260409-153042.png`

## Implementation

In `dist/index.js` `cmdScreenshot()` function:

1. If `args.path` is empty, generate path using `Date.now()` formatted string
2. Save to `process.cwd() + '/' + generatedFilename`
3. Print the saved path to console

## Files to Change

- `dist/index.js` - Update `cmdScreenshot()` function
- `bin/cli.js` - No changes needed
- `bin/daemon.js` - No changes needed

## Backward Compatibility

- `screenshot --path /specific/path.png` → still works exactly as before
- `screenshot` with no args → now auto-saves instead of outputting base64
