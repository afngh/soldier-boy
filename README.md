# 🦾 soldier-boy

> An open-source, installable **Autonomous Terminal Coding Agent CLI** and modular **JavaScript Developer SDK client** (`@soldier-boy/sdk`) linked directly to your local filesystem to assist in developer workflows.

---

## 📖 What is soldier-boy?

**soldier-boy** is an advanced command-line development companion built to run directly on your local computer. It connects your console to your secure hosted **`black-noir`** API server backend. 

Because it runs locally, **soldier-boy** can read files in your workspace, analyze your folder structure, and stream real-time code modifications and suggestions back into your terminal.

```text
  [ Cloud Backend: black-noir API ] ◄── Hosted publicly (Railway/Render)
                 ▲
                 │ (Secure HTTPS + SSE Stream)
                 ▼
  [ Local Machine: soldier CLI ]    ◄── Installs globally via NPM
                 │
                 └── Reads local workspace directories & executes scripts
```

---

## 🛠️ Key CLI & SDK Capabilities

### 💬 Multi-Mode Interactive Loop
Toggle between conversational thinking and active codebase building:
- **`[think] Mode`** (Default): Conceptual explanations, planning, and architectural reviews. (Tools are disabled for safety).
- **`[build] Mode`**: Autonomous filesystem modifications. The agent will read, write, and execute files locally.

### 🔌 Interactive Slash Commands
Control the agent's behavior directly inside the chat interface:
*   `/think` — Switches the active session mode to Think.
*   `/build` — Switches the active session mode to Build.
*   `/think <prompt>` — Sends a conversational message in Think Mode.
*   `/build <prompt>` — Starts an autonomous local file operation in Build Mode.

---

## 🚀 Easy Global System Installation

We provide an automated installer script that configures the system-wide executable and permanent cloud variables in one second!

### 1. Prerequisites
Ensure you have **Node.js** installed:
```bash
node -v
npm -v
```

### 2. Clone and Setup
```bash
git clone https://github.com/afngh/soldier-boy.git
cd soldier-boy
npm install
```

### 3. Run the Automated Installer
Execute the premium system installer to globally link the binaries and save your cloud environment variables:
```bash
./install.sh
```

### 4. Source Your Profile
Reload your shell profile to load the configurations into your active terminal tab:
```bash
source ~/.bashrc
# (or source ~/.zshrc if you use zsh)
```

---

## 🎯 Test It Anywhere!

Open **any folder** on your computer system and type the global activation command:
```bash
soldier chat
```

### Example Multi-Mode Execution:
```text
soldier [think] > hello, i am afnan
🤖 Assistant (Thinking Mode): Hello Afnan, it's nice to meet you!

soldier [think] > /build create a file hello.py defining functions and run it
🤖 Assistant (Build Mode): To create the file, I will use the write_file tool...
⚙️  [Tool Call]: Intercepted local action "write_file"...
✅ [Tool Success]: Written to "hello.py".
⚙️  [Local Terminal]: Running command: "python3 hello.py"
✅ [Tool Success]: Execution completed.

soldier [build] > /think what did we do in our last step and what is my name?
🤖 Assistant (Thinking Mode): Your name is Afnan. In our last step, we created and executed a Python script...
```

---

## 🔌 Integrating `@soldier-boy/sdk` in code

```javascript
import { SoldierBoyAI } from '@soldier-boy/sdk';

const ai = new SoldierBoyAI({
  apiKey: 'bn_live_4f3c8a9e2d6b1a0f7e5d3c2b1a0f9e8d',
  baseUrl: 'https://black-noir-production.up.railway.app'
});

// Stream real-time tokens in terminal
await ai.stream(
  [{ role: 'user', content: 'Write a JavaScript binary search function' }],
  {},
  (chunk) => {
    process.stdout.write(chunk);
  }
);
```

---

## 🤝 Open Source Contributions
This is a public, **open-source repository**! We welcome any developers to join in and build custom coding agent tools, add Git hooks, or optimize the SDK. Fork the repo and open a Pull Request!

---

## 📜 License
Distributed under the **MIT License**.
