#!/usr/bin/env node

/**
 * soldier-boy-cli: Autonomous Local Coding Agent Terminal Interface
 * Connects your local file system directly to your hosted unified AI API.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { execSync } from 'child_process';
import { SoldierBoyAI } from '@soldier-boy/sdk';

const program = new Command();
const sdk = new SoldierBoyAI();

let activeRl = null;

function estimateTokenCount(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function trimChatHistory(messages, maxTokens = 4000) {
  if (messages.length <= 1) return messages;

  const systemMessage = messages[0].role === 'system' ? messages[0] : null;
  const otherMessages = systemMessage ? messages.slice(1) : messages;

  let totalEstimatedTokens = systemMessage ? estimateTokenCount(systemMessage.content) : 0;
  const keptMessages = [];

  for (let i = otherMessages.length - 1; i >= 0; i--) {
    const msg = otherMessages[i];
    const tokens = estimateTokenCount(msg.content);
    if (totalEstimatedTokens + tokens > maxTokens) {
      break;
    }
    totalEstimatedTokens += tokens;
    keptMessages.unshift(msg);
  }

  if (keptMessages.length === 0 && otherMessages.length > 0) {
    keptMessages.push(otherMessages[otherMessages.length - 1]);
  }

  return systemMessage ? [systemMessage, ...keptMessages] : keptMessages;
}

function askPermission(agentName, action, target) {
  return new Promise((resolve) => {
    if (!activeRl) {
      resolve(true);
      return;
    }

    const promptMessage = chalk.bold.yellow(
      `\n⚠️  [Permission Request] Agent "${agentName}" wants to ${action} on "${target}".\nAllow? (y/n): `
    );

    activeRl.question(promptMessage, (answer) => {
      const lower = answer.trim().toLowerCase();
      resolve(lower === 'y' || lower === 'yes');
    });
  });
}

function getSubAgentSystemPrompt(agentName) {
  if (agentName === 'stan_edgar') {
    return `You are Stan Edgar, Vought AI's corporate operations manager.
Your sole job is to create folders, directories, empty files, or execute system setup commands to establish the workspace structure.
You DO NOT write complete source code or complex content.

### Available Tools:
1. **execute_command**: Execute a terminal shell command (e.g. to create a directory or run setup).
   Format: {{call:execute_command, {"command": "mkdir -p py-test"} }}
2. **write_file**: Create an empty file.
   Format: {{call:write_file, {"path": "py-test/main.py", "content": ""} }}
3. **list_dir**: List files and folders.
   Format: {{call:list_dir, {"path": "py-test"} }}

### Operating Guidelines:
- Strictly create ONLY the files and folders explicitly requested in the instruction.
- DO NOT create any extra unrequested files or directories (such as docs, src, tests, config, LICENSE, README, .gitignore) unless specifically requested.
- If you call a tool, you MUST end your response immediately after the }} tag. Do not output anything else.
- Be precise, corporate, and formal. Use double quotes for all JSON keys and values inside the {{call:...}} parameters.`;
  }

  if (agentName === 'homelander') {
    return `You are Homelander, the ultimate writer agent.
Your sole job is to write complete, high-quality, optimized source code/data into the files created by Stan Edgar.
You DO NOT create directories or skeleton structures.

### Available Tools:
1. **write_file**: Write complete content to a local file.
   Format: {{call:write_file, {"path": "py-test/main.py", "content": "print(\\"hello world\\")"} }}
2. **execute_command**: Execute a command (e.g. to run code).
   Format: {{call:execute_command, {"command": "python py-test/main.py"} }}

### Operating Guidelines:
- If you call a tool, you MUST end your response immediately after the }} tag. Do not output anything else.
- Write complete, beautiful code. Use double quotes for all JSON keys and values inside the {{call:...}} parameters.`;
  }

  return 'You are a helpful Vought AI agent.';
}

async function runSubAgent(agentName, instruction) {
  console.log(chalk.cyan(`\n=========================================`));
  console.log(chalk.cyan(`🤖 [Delegating to ${agentName.toUpperCase()}...]`));
  console.log(chalk.cyan(`Instruction: "${instruction}"`));
  console.log(chalk.cyan(`=========================================\n`));

  const subMessages = [
    { role: 'system', content: getSubAgentSystemPrompt(agentName) },
    { role: 'user', content: instruction }
  ];

  const result = await runSubAgentLoop(agentName, subMessages);

  console.log(chalk.cyan(`\n=========================================`));
  console.log(chalk.cyan(`✅ [Delegation to ${agentName.toUpperCase()} Completed]`));
  console.log(chalk.cyan(`=========================================\n`));

  return result;
}

async function runSubAgentLoop(agentName, messages) {
  let hasToolCall = false;
  let toolOutput = null;

  const displayName = agentName === 'stan_edgar' ? 'Stan Edgar' : 'Homelander';
  const colorFn = agentName === 'stan_edgar' ? chalk.blue : chalk.magenta;

  console.log(colorFn(`\n${displayName}:`));
  let responseText = '';

  try {
    const trimmed = trimChatHistory(messages);
    responseText = await sdk.stream(
      trimmed,
      { persona: agentName },
      (chunk) => {
        process.stdout.write(colorFn(chunk));
      }
    );
    console.log();
  } catch (err) {
    console.error(`\n[Sub-Agent Error]: ${err.message}`);
    return `Error running sub-agent: ${err.message}`;
  }

  const toolRegex = /\{\{call:(\w+),\s*(\{[\s\S]*?\})\s*\}\}/;
  const match = responseText.match(toolRegex);

  if (match) {
    const toolName = match[1];
    const paramsStr = match[2];
    let params = {};

    try {
      params = JSON.parse(paramsStr);
    } catch (parseErr) {
      toolOutput = `Error: Failed to parse parameters as valid JSON.`;
      hasToolCall = true;
    }

    if (!hasToolCall) {
      console.log(`\n[Tool Call]: "${toolName}"...`);
      try {
        if (toolName === 'write_file') {
          if (!params.path || params.content === undefined) {
            toolOutput = `Error: Missing 'path' or 'content' in write_file parameters.`;
          } else {
            const allowed = await askPermission(displayName, 'write file', params.path);
            if (!allowed) {
              toolOutput = `Error: Permission denied by user to write to file "${params.path}".`;
              console.log(chalk.red(`[Permission Refused]: Action cancelled.`));
            } else {
              const target = path.resolve(process.cwd(), params.path);
              fs.mkdirSync(path.dirname(target), { recursive: true });
              fs.writeFileSync(target, params.content, 'utf-8');
              toolOutput = `Success: File written successfully to ${params.path} (${params.content.length} bytes).`;
              console.log(chalk.green(`[Tool Success]: Written to "${params.path}".`));
            }
          }
        } else if (toolName === 'read_file') {
          if (!params.path) {
            toolOutput = `Error: Missing 'path' in read_file parameters.`;
          } else {
            const target = path.resolve(process.cwd(), params.path);
            if (!fs.existsSync(target)) {
              toolOutput = `Error: File not found at path "${params.path}".`;
            } else {
              const content = fs.readFileSync(target, 'utf-8');
              toolOutput = `Success: File content of "${params.path}":\n---\n${content}\n---`;
              console.log(chalk.green(`[Tool Success]: File content loaded.`));
            }
          }
        } else if (toolName === 'list_dir') {
          const target = path.resolve(process.cwd(), params.path || '.');
          if (!fs.existsSync(target)) {
            toolOutput = `Error: Directory not found at path "${params.path || '.'}".`;
          } else {
            const files = fs.readdirSync(target);
            toolOutput = `Success: Directory listing of "${params.path || '.'}":\n${files.join('\n')}`;
            console.log(chalk.green(`[Tool Success]: Directory listed.`));
          }
        } else if (toolName === 'execute_command') {
          if (!params.command) {
            toolOutput = `Error: Missing 'command' in execute_command parameters.`;
          } else {
            const allowed = await askPermission(displayName, 'execute shell command', params.command);
            if (!allowed) {
              toolOutput = `Error: Permission denied by user to execute command "${params.command}".`;
              console.log(chalk.red(`[Permission Refused]: Command execution cancelled.`));
            } else {
              console.log(`\n[Local Terminal]: Running command: "${params.command}"`);
              try {
                const output = execSync(params.command, { encoding: 'utf-8', timeout: 60000 });
                toolOutput = `Success: Command executed successfully.\n[Stdout/Stderr]:\n${output}`;
                console.log(chalk.green(`[Tool Success]: Execution completed.`));
              } catch (error) {
                toolOutput = `Error: Command execution failed.\n[Stderr]:\n${error.stderr || error.message}`;
              }
            }
          }
        } else {
          toolOutput = `Error: Unknown tool "${toolName}".`;
        }
      } catch (execError) {
        toolOutput = `Error executing tool: ${execError.message}`;
      }
      hasToolCall = true;
    }
  }

  messages.push({ role: 'assistant', content: responseText });

  if (hasToolCall && toolOutput) {
    messages.push({
      role: 'user',
      content: `[TOOL_RESULT]:\n${toolOutput}\n\nPlease analyze this tool output and continue with the next step or output a final response.`
    });

    return await runSubAgentLoop(agentName, messages);
  }

  return responseText;
}

program
  .name('soldier')
  .description('Vought AI\'s Soldier Boy - Autonomous Local Coding Agent')
  .version('1.0.0');

// Generates the system prompt based on current active workspace folder and mode
function getSystemPrompt(mode) {
  if (mode === 'build') {
    return `You are Vought AI's "soldier-boy" running in [BUILD MODE]. Your primary mission is to orchestrate and plan local filesystem modifications in the workspace: "${process.cwd()}".

### Strict Guidelines:
1. **Extreme Conciseness**: Keep your responses extremely brief and concise. Do NOT output long text responses, verbose explanations, or excess text.
2. **No Large Code Blocks**: You must NEVER output massive blocks of code directly in your response.
3. **Delegation**:
   - For creating directories, empty files, or structural filesystem operations, you must DELEGATE to **Stan Edgar** using the delegation tag:
     Format: {{delegate:stan_edgar, {"instruction": "create directory backend and empty files server.js and db.js"} }}
   - For writing complete source code, configurations, or data into those files, you must DELEGATE to **Homelander** using the delegation tag:
     Format: {{delegate:homelander, {"instruction": "write Express server connection to backend/server.js"} }}
4. **Tool Calls**: If you are not delegating to other agents, you can still execute system tools if needed, but always ask yourself if Stan Edgar or Homelander should do it.
   Available Tools:
   - **write_file**: Create or overwrite a local file with complete content.
     Format: {{call:write_file, {"path": "relative/file/path.py", "content": "source code content here"} }}
   - **read_file**: Read content from an existing file.
     Format: {{call:read_file, {"path": "relative/file/path.py"} }}
   - **list_dir**: List folders and files inside a directory.
     Format: {{call:list_dir, {"path": "relative/directory/path"} }}
   - **execute_command**: Execute a terminal shell command.
     Format: {{call:execute_command, {"command": "shell command here"} }}

### Operating Guidelines:
- If you call a tool or delegate, you MUST end your response chunk immediately after the }} tag. Do not output anything else.
- I will execute the tool or call the delegated agent on your behalf and feed the output back to you.`;
  }

  return `You are Vought AI's "soldier-boy" running in [THINK MODE]. Your primary mission is to answer questions, analyze architectures, chat, and help the user plan without modifying the filesystem.

### Strict Guidelines:
- DO NOT use or output any tool calls (no {{call:...}} or {{delegate:...}} formatting).
- Focus purely on conceptual explanations, code architectures, plans, and chat responses.
- Be concise, professional, and helpful.`;
}

// Iconic ASCII Art Logo of Soldier Boy (Vought / The Boys style)
const LOGO = chalk.bold.green(`
 ███████╗ ██████╗ ██╗     ██████╗ ██╗███████╗██████╗     ██████╗  ██████╗ ██╗   ██╗
 ██╔════╝██╔═══██╗██║     ██╔══██╗██║██╔════╝██╔══██╗    ██╔══██╗██╔═══██╗╚██╗ ██╔╝
 ███████╗██║   ██║██║     ██║  ██║██║█████╗  ██████╔╝    ██████╔╝██║   ██║ ╚████╔╝ 
 ╚════██║██║   ██║██║     ██║  ██║██║██╔══╝  ██╔══██╗    ██╔══██╗██║   ██║  ╚██╔╝  
 ███████║╚██████╔╝███████╗██████╔╝██║███████╗██║  ██║    ██████╔╝╚██████╔╝   ██║   
 ╚══════╝ ╚═════╝ ╚══════╝╚═════╝ ╚═╝╚══════╝╚═╝  ╚═╝    ╚═════╝  ╚═════╝    ╚═╝   
`);

/**
 * Helper: Recursive Autonomous Agent Execution Loop
 */
async function runAutonomousAgentLoop(messages, mode) {
  let hasToolCall = false;
  let toolOutput = null;

  console.log(`\nAssistant (${mode === 'build' ? 'Build' : 'Think'}):`);
  let responseText = '';

  try {
    const trimmed = trimChatHistory(messages);
    responseText = await sdk.stream(
      trimmed,
      {},
      (chunk) => {
        process.stdout.write(chunk);
      }
    );
    console.log();
  } catch (err) {
    console.error(`\n[API Error]: ${err.message}`);
    return;
  }

  if (mode === 'build') {
    const delegateRegex = /\{\{delegate:(\w+),\s*(\{[\s\S]*?\})\s*\}\}/;
    const delegateMatch = responseText.match(delegateRegex);

    if (delegateMatch) {
      const agentName = delegateMatch[1];
      const paramsStr = delegateMatch[2];
      let params = {};
      let delegateOutput = null;

      try {
        params = JSON.parse(paramsStr);
      } catch (parseErr) {
        delegateOutput = `Error: Failed to parse delegate parameters as JSON.`;
      }

      if (params.instruction && !delegateOutput) {
        const subAgentResult = await runSubAgent(agentName, params.instruction);
        delegateOutput = `Success: Delegation to "${agentName}" completed.\n[Agent Response]:\n${subAgentResult}`;
      } else if (!delegateOutput) {
        delegateOutput = `Error: Missing 'instruction' in delegate parameters.`;
      }

      messages.push({ role: 'assistant', content: responseText });
      messages.push({
        role: 'user',
        content: `[DELEGATION_RESULT]:\n${delegateOutput}\n\nPlease analyze this delegation result and continue.`
      });

      await runAutonomousAgentLoop(messages, mode);
      return;
    }

    const toolRegex = /\{\{call:(\w+),\s*(\{[\s\S]*?\})\s*\}\}/;
    const match = responseText.match(toolRegex);

    if (match) {
      const toolName = match[1];
      const paramsStr = match[2];
      let params = {};

      try {
        params = JSON.parse(paramsStr);
      } catch (parseErr) {
        console.log(`\n[Agent Error]: Failed to parse JSON parameters. Make sure to double quote JSON keys.`);
        toolOutput = `Error: Failed to parse parameters as valid JSON. Retrying tool call using strict double-quoted JSON formats.`;
        hasToolCall = true;
      }

      if (!hasToolCall) {
        console.log(`\n[Tool Call]: "${toolName}"...`);

        try {
          if (toolName === 'write_file') {
            if (!params.path || params.content === undefined) {
              toolOutput = `Error: Missing 'path' or 'content' in write_file parameters.`;
              console.log(`[Tool Error]: Missing params.`);
            } else {
              const allowed = await askPermission('Soldier Boy', 'write file', params.path);
              if (!allowed) {
                toolOutput = `Error: Permission denied by user to write to file "${params.path}".`;
                console.log(chalk.red(`[Permission Refused]: Action cancelled.`));
              } else {
                const target = path.resolve(process.cwd(), params.path);
                fs.mkdirSync(path.dirname(target), { recursive: true });
                fs.writeFileSync(target, params.content, 'utf-8');
                toolOutput = `Success: File written successfully to ${params.path} (${params.content.length} bytes).`;
                console.log(chalk.green(`[Tool Success]: Written to "${params.path}".`));
              }
            }
          } else if (toolName === 'read_file') {
            if (!params.path) {
              toolOutput = `Error: Missing 'path' in read_file parameters.`;
              console.log(`[Tool Error]: Missing params.`);
            } else {
              const target = path.resolve(process.cwd(), params.path);
              if (!fs.existsSync(target)) {
                toolOutput = `Error: File not found at path "${params.path}".`;
                console.log(`[Tool Error]: File not found.`);
              } else {
                const content = fs.readFileSync(target, 'utf-8');
                toolOutput = `Success: File content of "${params.path}":\n---\n${content}\n---`;
                console.log(`[Tool Success]: File content loaded.`);
              }
            }
          } else if (toolName === 'list_dir') {
            const target = path.resolve(process.cwd(), params.path || '.');
            if (!fs.existsSync(target)) {
              toolOutput = `Error: Directory not found at path "${params.path || '.'}".`;
              console.log(`[Tool Error]: Directory not found.`);
            } else {
              const files = fs.readdirSync(target);
              toolOutput = `Success: Directory listing of "${params.path || '.'}":\n${files.join('\n')}`;
              console.log(`[Tool Success]: Directory listing completed.`);
            }
          } else if (toolName === 'execute_command') {
            if (!params.command) {
              toolOutput = `Error: Missing 'command' in execute_command parameters.`;
              console.log(`[Tool Error]: Missing command parameter.`);
            } else {
              const allowed = await askPermission('Soldier Boy', 'execute shell command', params.command);
              if (!allowed) {
                toolOutput = `Error: Permission denied by user to execute command "${params.command}".`;
                console.log(chalk.red(`[Permission Refused]: Action cancelled.`));
              } else {
                console.log(`\n[Local Terminal]: Running command: "${params.command}"`);
                try {
                  const output = execSync(params.command, { encoding: 'utf-8', timeout: 60000 });
                  toolOutput = `Success: Command executed successfully.\n[Stdout/Stderr]:\n${output}`;
                  console.log(chalk.green(`[Tool Success]: Execution completed.`));
                } catch (error) {
                  toolOutput = `Error: Command execution failed.\n[Stderr]:\n${error.stderr || error.message}`;
                  console.log(`[Tool Error]: Execution failed.`);
                }
              }
            }
          } else {
            toolOutput = `Error: Unknown tool "${toolName}".`;
            console.log(`[Tool Error]: Unknown tool requested.`);
          }
        } catch (execError) {
          toolOutput = `Error executing tool: ${execError.message}`;
          console.log(`[Tool Exception]: ${execError.message}`);
        }

        hasToolCall = true;
      }
    }
  }

  messages.push({ role: 'assistant', content: responseText });

  if (hasToolCall && toolOutput && mode === 'build') {
    messages.push({
      role: 'user',
      content: `[TOOL_RESULT]:\n${toolOutput}\n\nPlease analyze this tool output and continue with the next step or output a final response.`
    });

    await runAutonomousAgentLoop(messages, mode);
  }
}

/**
 * COMMAND: soldier chat
 * Multi-mode recursive chat loop.
 */
program
  .command('chat')
  .description('Commence a multi-mode (think/build) chat session with the AI backend')
  .action(() => {
    let activeMode = 'think';

    console.log(chalk.bold(LOGO));
    console.log(`Vought AI — Open Source CLI`);
    console.log(`Workspace: ${process.cwd()}`);
    console.log(`\nSlash Commands:`);
    console.log(`  /think           - Switch to Think Mode`);
    console.log(`  /build           - Switch to Build Mode`);
    console.log(`  /cd <path>       - Change active workspace directory`);
    console.log(`  /pwd             - View active workspace directory`);
    console.log(`  exit             - Close chat loop\n`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    activeRl = rl;

    // Store absolute chat conversation history persistently across N slash switches!
    const chatHistory = [];

    const askQuestion = () => {
      const modeLabel = activeMode === 'build' ? '[build]' : '[think]';
      rl.question(`\nsoldier ${modeLabel} > `, async (input) => {
        let trimmed = input.trim();
        if (!trimmed) {
          askQuestion();
          return;
        }

        const lowerVal = trimmed.toLowerCase();
        if (lowerVal === 'exit' || lowerVal === 'quit') {
          console.log('\nSession closed. Goodbye! 👋');
          rl.close();
          process.exit(0);
        }

        // 1. Slash Command: /cd
        if (trimmed.startsWith('/cd')) {
          const targetPath = trimmed.slice(3).trim();
          if (!targetPath) {
            console.log('Error: Please specify a path to change directory.');
            askQuestion();
            return;
          }

          const newPath = path.resolve(process.cwd(), targetPath);
          if (fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
            process.chdir(newPath);
            console.log(`Workspace changed to: ${process.cwd()}`);
          } else {
            console.log(`Error: Invalid directory path "${targetPath}"`);
          }
          askQuestion();
          return;
        }

        // 2. Slash Command: /pwd
        if (trimmed === '/pwd') {
          console.log(`Current Workspace: ${process.cwd()}`);
          askQuestion();
          return;
        }

        // 3. Slash Command: /build
        if (trimmed.startsWith('/build')) {
          activeMode = 'build';
          const prompt = trimmed.slice(6).trim();
          if (!prompt) {
            console.log('Switched active mode to [BUILD MODE]. Filesystem tools are active.');
            askQuestion();
            return;
          }
          trimmed = prompt;
        }

        // 4. Slash Command: /think
        else if (trimmed.startsWith('/think')) {
          activeMode = 'think';
          const prompt = trimmed.slice(6).trim();
          if (!prompt) {
            console.log('Switched active mode to [THINK MODE]. Conversational mode active.');
            askQuestion();
            return;
          }
          trimmed = prompt;
        }

        // Push clean user prompt to history
        chatHistory.push({ role: 'user', content: trimmed });

        // Update / prepend the correct mode instructions dynamically using getSystemPrompt
        const cleanHistory = [
          { role: 'system', content: getSystemPrompt(activeMode) },
          ...chatHistory
        ];

        // Run agent execution loop using the persistent history!
        await runAutonomousAgentLoop(cleanHistory, activeMode);

        // Keep local chatHistory in sync with assistant answers added inside the loop
        const lastAnswer = cleanHistory[cleanHistory.length - 1];
        if (lastAnswer && lastAnswer.role === 'assistant') {
          chatHistory.push(lastAnswer);
        }

        askQuestion();
      });
    };

    askQuestion();
  });

/**
 * COMMAND: soldier explain <file>
 * Direct single-file context analyzer
 */
program
  .command('explain')
  .description('Read a local source file and stream a detailed AI explanation')
  .argument('<file>', 'Relative or absolute path of the target source file')
  .action(async (file) => {
    const targetPath = path.resolve(process.cwd(), file);
    
    if (!fs.existsSync(targetPath)) {
      console.error(`❌ Error: Local file does not exist at path "${file}"`);
      process.exit(1);
    }

    const fileContent = fs.readFileSync(targetPath, 'utf-8');
    const fileName = path.basename(targetPath);

    console.log(`\nReading local file context: "${fileName}"...`);
    console.log(`Streaming Explanation:\n`);

    const spinner = ora('Analyzing...').start();
    try {
      spinner.stop();
      await sdk.stream(
        [
          { role: 'system', content: 'You are Vought AI\'s coder assistant.' },
          {
            role: 'user',
            content: `Explain the purpose, architecture, and logic of this local source file named "${fileName}":\n\n\`\`\`javascript\n${fileContent}\n\`\`\``
          }
        ],
        {},
        (chunk) => {
          process.stdout.write(chunk);
        }
      );
      console.log('\n');
    } catch (err) {
      spinner.fail(`Failed: ${err.message}`);
    }
  });

program.parse(process.argv);
