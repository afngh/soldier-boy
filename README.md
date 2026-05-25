# 🦾 soldier-boy

> An open-source, installable **Terminal Coding Agent CLI** and modular **JavaScript Developer SDK client** (`@soldier-boy/sdk`) linked directly to your local filesystem to assist in developer workflows.

---

## 📖 What is soldier-boy?

**soldier-boy** is an advanced command-line development companion built to run directly on your local computer. It connects your console to your secure hosted **`black-noir`** API server backend. 

Because it runs locally, **soldier-boy** can read files in your workspace, analyze your folder structure, and stream real-time code modifications and suggestions back into your terminal.

```text
  [ Cloud Backend: black-noir API ] ◄── Hosted publicly (Railway/Render)
                 ▲
                 │ (Secure HTTPS + SSE Stream)
                 ▼
  [ Local Machine: soldier-boy CLI ] ◄── Installs globally via NPM
                 │
                 └── Reads local workspace directories & analyzes codebases
```

---

## 🛠️ Key CLI & SDK Capabilities

### 💬 Real-Time Streaming Interactive Chat
Allows you to start streaming conversations directly in your console:
```bash
soldier-boy chat
```
Watch the AI stream answers token-by-token with zero lag. Supports dynamic persona presets (e.g. `soldier-boy chat --persona reviewer`).

### 📂 Direct Filesystem Linking & Context Loading
Read and explain codebase files in real time. Pass any source file path to stream a complete structural analysis:
```bash
soldier-boy explain src/server.js
```
The CLI loads the target file, packages the context securely, sends it to your `black-noir` API backend, and streams the detailed breakdown.

### 📦 Modular JS SDK client (`@soldier-boy/sdk`)
Includes a clean connection library enabling other JavaScript and Node apps to interface with your `black-noir` API:
- `sdk.chat(messages, options)` resolving complete responses.
- `sdk.stream(messages, options, onChunk)` parsing and calling callbacks with incoming text deltas.

---

## 🚀 Beginner-Friendly Global Installation

### 1. Prerequisites
Ensure you have **Node.js** installed:
```bash
node -v
npm -v
```

### 2. Clone and Install dependencies
```bash
git clone https://github.com/afngh/soldier-boy.git
cd soldier-boy
npm install
```

### 3. Link globally
Run this command inside the CLI folder to install the `soldier-boy` executable globally on your system:
```bash
npm link --prefix packages/cli
```

### 4. Link to your hosted API
Set your hosted **`black-noir`** server address and auth key as environment variables (add this to your `~/.bashrc` or `~/.zshrc`):
```bash
export API_KEY="black-noir-secret-key"
export API_BASE_URL="http://localhost:3000" # Change to your public black-noir URL
```

---

## 🔌 Integrating `@soldier-boy/sdk` in code

```javascript
import { SoldierBoyAI } from '@soldier-boy/sdk';

const ai = new SoldierBoyAI({
  apiKey: 'black-noir-secret-key',
  baseUrl: 'http://localhost:3000'
});

// Stream real-time tokens in terminal
await ai.stream(
  [{ role: 'user', content: 'Write a JavaScript binary search function' }],
  { persona: 'coder' },
  (chunk) => {
    process.stdout.write(chunk);
  }
);
```

---

## 🧪 Verification tests
To verify your CLI/SDK is communicating perfectly with your `black-noir` Express server, run:
```bash
node test_stream.js
```

---

## 📂 Repository Directory Layout

```text
soldier-boy/
 ├── packages/
 │    ├── cli/                  # Commander terminal coding agent CLI
 │    └── sdk-js/               # Developer JS connection SDK
 ├── package.json               # Root workspaces configuration
 ├── test_stream.js             # Stream and SDK connection test suite
 └── README.md                  # This handbook!
```

---

## 🤝 Open Source Contributions
This is a public, **open-source repository**! We welcome any developers to join in and build custom coding agent tools, add Git hooks, or optimize the SDK. Fork the repo and open a Pull Request!

---

## 📜 License
Distributed under the **MIT License**.
