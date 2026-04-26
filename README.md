# Promptly

Promptly is an interactive, persistent streaming terminal plugin built for the DevScribe platform. It features a fully functional `xterm.js` terminal output alongside a powerful multi-block Command Scratchpad, designed to improve the developer workflow for running, saving, and managing complex shell commands.

## Features

* **Command Scratchpad:** Write, edit, and organize multiple bash commands in dedicated editor blocks.
* **Drag-and-Drop Reordering:** Intuitively organize your command blocks by dragging them up or down with visual drop indicators.
* **Interactive Terminal Stream:** Powered by `xterm.js`, providing rich ANSI color support, auto-fitting, and real-time PTY backend streaming.
* **Persistent State:** Your command blocks, active theme, and UI pane layout are automatically saved and restored when reopening the document.
* **Theme Support:** Beautiful, natively integrated Light and Dark themes that automatically style the UI and terminal palette.
* **Exportable Data:** Export your entire workspace state as a `.ds` (DevScribe) file for easy sharing and backup.
* **Resizable Layout:** Adjust the split view between the Scratchpad and Terminal dynamically.

## Installation & Setup

This plugin is designed to be run within the DevScribe Electron environment. It communicates with the DevScribe main process via the `window.pluginAPI` IPC bridge to spawn real terminal instances.

To build the plugin for release:

```bash
# Install dependencies
npm install

# Build the optimized production bundle
npm run build

# Package the plugin into a .zip for distribution
npm run package
```

The resulting `promptly-x.x.x.zip` file in the `release/` directory can be uploaded to the DevScribe Plugin Store.

## Technical Details

* **Frontend:** React, Craco, CSS Modules
* **Terminal Engine:** `xterm.js`, `xterm-addon-fit`, `xterm-addon-web-links`
* **Icons:** Remix Icons (`remixicon`)
* **Communication:** Requires `window.pluginAPI.terminal` IPC methods (`create`, `input`, `resize`, `onData`, `dispose`) to be exposed by the host environment.
