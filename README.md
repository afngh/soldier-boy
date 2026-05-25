# 🚀 soldier-boy

> A high-performance, developer-grade **Unified AI Backend API** powering an advanced, **local terminal-based coding agent CLI** (similar to Claude Code and Antigravity) linked directly to your local filesystem.

---

## 📖 The Vision

**soldier-boy** is built to solve one major issue in AI engineering: **the friction between model providers, hosted code bases, and local terminal execution.** 

Instead of writing complex, custom API integrations and authorization wrappers for every single project, **soldier-boy** establishes a unified, production-ready backend layer. This backend handles model routing, token-by-token SSE streaming, and auth, and serves as the single foundation for a highly capable, local command-line development agent that can read and write files on your computer.

```text
                               ┌─────────────────────────┐
                               │   AI Model Providers    │
                               │  (Groq, Gemini, OpenR)  │
                               └────────────┬────────────┘
                                            │
                                            ▼
                               ┌─────────────────────────┐
                               │  Unified Express API    │  ◄── [Hosted on Cloud]
                               │  (Streaming, Auth, Val) │
                               └────────────┬────────────┘
                                            │
                                            ▼
                               ┌─────────────────────────┐
                               │  Developer JS SDK (@)   │
                               └────────────┬────────────┘
                                            │
                                            ▼
                               ┌─────────────────────────┐
                               │ soldier-boy Coding Agent │  ◄── [Runs Local Terminal]
                               │ (filesystemTool, exec)  │
                               └─────────────────────────┘
```

---

## 🛠️ Key Architectural Features

### ⚡ Real-Time SSE Streaming
Supports the native `{ "stream": true }` payload. The API handles incoming model chunks, processes them, and pipes Server-Sent Events (SSE) directly to your client terminal to ensure zero-lag typing effects.

### 🛡️ Production-Grade Middleware
- **Request Logging**: Color-coded CLI terminal logs with millisecond high-resolution processing duration counters.
- **Authorization**: Secure `Bearer <API_KEY>` authorization shielding endpoint security.
- **Global Error Interceptor**: Intercepts syntax errors, rate limits, and missing credential exceptions gracefully without server shell crashes.
- **Input Validation**: Strictly validates messages structural arrays, roles (`user`, `assistant`, `system`), and empty parameters.

### 🧠 Intelligent Task Routing & Persona Presets
- **Task Routing**: Routes simple queries automatically to fast-tier models (`llama-3.1-8b-instant`) and advanced software engineering prompts to reasoning models (`llama-3.3-70b-versatile`).
- **Dynamic Prompts**: Pre-configured system instruction templates (`coder.txt`, `planner.txt`, `reviewer.txt`) loaded dynamically from the `prompts/` folder.

### 📦 Local Tool Registry (Agent Foundation)
Contains system execution registries (`filesystemTool`, `terminalTool`, `searchTool`) defining structured parameters, allowing the coding agent CLI to eventually list directories, read/edit files, and run local test pipelines.

---

## 🚀 Beginner-Friendly Installation & Setup

If you are new to Node.js, follow this step-by-step setup guide to get up and running:

### 1. Prerequisites
Make sure you have **Node.js** installed on your computer. You can verify this by running:
```bash
node -v
npm -v
```

### 2. Clone the Repository
Clone the codebase and navigate into your workspace folder:
```bash
git clone https://github.com/afngh/to-do.git soldier-boy
cd soldier-boy
```

### 3. Install Dependencies
Install all package dependencies for the backend, JavaScript SDK, and CLI tools:
```bash
# Install core backend dependencies
npm install

# Install JS SDK dependencies
npm install --prefix packages/sdk-js

# Install CLI dependencies
npm install --prefix packages/cli
```

### 4. Configure Environment Variables
Create a file named `.env` in the root folder of the project:
```bash
touch .env
```
Open the `.env` file and paste your credentials:
```env
# Port the local server will run on
PORT=3000

# Secret authorization key used to guard your public API backend
API_KEY=soldier-boy-secret-key

# Your Groq API Cloud key (Get one for free at console.groq.com)
GROQ_API_KEY=your_groq_api_key_here

# (Optional) Google Gemini Integration Key
GEMINI_API_KEY=your_gemini_api_key_here
```

### 5. Launch the API Server
Start the local development server with automatic file hot-reloads:
```bash
npm run dev
```
You should see the startup banner:
```text
=========================================
  🚀 Server is running on port 3000
  👉 Health check: http://localhost:3000/health
  Mode: development
=========================================
```

---

## 💻 How to Use the local CLI Coding Agent

Our CLI acts as your command-line companion. You can run it directly using Node.

### 💬 Start an Interactive Chat
Commence a real-time, streaming conversation in your console:
```bash
node packages/cli/bin/cli.js chat
```
Type your question (e.g. `How does recursion work?`), and watch the AI write the answer token-by-token instantly! Type `exit` to close.

### 📂 Analyze and Explain Local Code Files
Link the CLI directly to your system's codebase context. Pass a target file to get a deep architectural explanation:
```bash
node packages/cli/bin/cli.js explain src/server.js
```
The CLI will read your local `src/server.js`, mount it into a prompt, send it to your backend, and stream a comprehensive analysis of its purpose, logic, and structure in your terminal.

---

## 🔌 Using the JavaScript SDK (`@soldier-boy/sdk`)

If you want to integrate this unified API into your other apps, utilize our lightweight JS SDK:

```javascript
import { SoldierBoyAI } from './packages/sdk-js/index.js';

// Initialize SDK client
const ai = new SoldierBoyAI({
  apiKey: 'soldier-boy-secret-key',
  baseUrl: 'http://localhost:3000'
});

// 1. Standard completion
const response = await ai.chat([
  { role: 'user', content: 'Design a simple Express health route' }
], { persona: 'coder' });

console.log(response.message.content);

// 2. Real-time stream completions
await ai.stream(
  [{ role: 'user', content: 'Write a JavaScript quicksort function' }],
  { persona: 'coder' },
  (chunk) => {
    process.stdout.write(chunk); // Streams the code directly!
  }
);
```

---

## 📂 Codebase Directory Layout

```text
soldier-boy/
 ├── packages/
 │    ├── cli/                  # Commander coding agent CLI utility
 │    └── sdk-js/               # Lightweight developer JS connection SDK
 ├── prompts/                   # Persona system templates (coder, planner, reviewer)
 ├── src/
 │    ├── controllers/          # Request validation and streaming piping controllers
 │    ├── middleware/           # Auth validation, request logs, and global error handlers
 │    ├── providers/            # AI Platform adapters (Groq, Gemini, OpenRouter)
 │    ├── routes/               # API endpoint routing registration
 │    ├── services/             # Dynamic prompt template loaders & tool registries
 │    └── server.js             # Core Express server initialization
 ├── test_stream.js             # Verification test suite for SSE streaming
 └── README.md                  # This handbook!
```

---

## 🤝 Contributing to Open Source

This is an **open-source project**! We welcome developers of all skill levels to join in, fix bugs, optimize logic, or introduce advanced coding agent features.

### How to Contribute:
1. **Fork the Repository** on GitHub.
2. **Create a Feature Branch** (`git checkout -b feature/amazing-agent-tool`).
3. **Commit your Changes** (`git commit -m "feat: add automatic git-commit tool to CLI"`).
4. **Push to the Branch** (`git push origin feature/amazing-agent-tool`).
5. **Open a Pull Request**!

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.
