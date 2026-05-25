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

program
  .name('soldier')
  .description('Vought AI\'s Soldier Boy - Autonomous Local Coding Agent')
  .version('1.0.0');

// Generates the system prompt based on current active workspace folder and mode
function getSystemPrompt(mode) {
  if (mode === 'build') {
    return `You are Vought AI's "soldier-boy" running in [BUILD MODE]. Your primary mission is to perform active filesystem modifications, read source files, and execute terminal commands locally in the user's active workspace: "${process.cwd()}".

### Available Tools:
1. **write_file**: Create or overwrite a local file with complete source code content.
   Format: {{call:write_file, {"path": "relative/file/path.py", "content": "source code content here"} }}

2. **read_file**: Read complete source code content from an existing local file.
   Format: {{call:read_file, {"path": "relative/file/path.py"} }}

3. **list_dir**: List folders and files inside a relative directory path.
   Format: {{call:list_dir, {"path": "relative/directory/path"} }}

4. **execute_command**: Execute a terminal shell command locally on the system.
   Format: {{call:execute_command, {"command": "shell command here"} }}

### Operating Guidelines:
- If you call a tool, you MUST end your response chunk immediately after the }} tag. Do not output anything else.
- I will execute the tool locally on your behalf and feed the output results back to you.
- Once you receive the tool results, continue your analysis, correct errors, and proceed to the next step or output another tool call if required.
- Provide clean, professional code. Explain what you are doing before executing any tool call.`;
  }

  return `You are Vought AI's "soldier-boy" running in [THINK MODE]. Your primary mission is to answer questions, analyze architectures, chat, and help the user plan without modifying the filesystem.

### Strict Guidelines:
- DO NOT use or output any tool calls (no {{call:...}} formatting).
- Focus purely on conceptual explanations, code architectures, plans, and chat responses.
- Be concise, professional, and helpful.`;
}

// Iconic ASCII Art Logo of Soldier Boy (Vought / The Boys style)
const LOGO = `
 ███████╗ ██████╗ ██╗     ██████╗ ██╗███████╗██████╗     ██████╗  ██████╗ ██╗   ██╗
 ██╔════╝██╔═══██╗██║     ██╔══██╗██║██╔════╝██╔══██╗    ██╔══██╗██╔═══██╗╚██╗ ██╔╝
 ███████╗██║   ██║██║     ██║  ██║██║█████╗  ██████╔╝    ██████╔╝██║   ██║ ╚████╔╝ 
 ╚════██║██║   ██║██║     ██║  ██║██║██╔══╝  ██╔══██╗    ██╔══██╗██║   ██║  ╚██╔╝  
 ███████║╚██████╔╝███████╗██████╔╝██║███████╗██║  ██║    ██████╔╝╚██████╔╝   ██║   
 ╚══════╝ ╚═════╝ ╚══════╝╚═════╝ ╚═╝╚══════╝╚═╝  ╚═╝    ╚═════╝  ╚═════╝    ╚═╝   
`;

/**
 * Helper: Recursive Autonomous Agent Execution Loop
 */
async function runAutonomousAgentLoop(messages, mode) {
  let hasToolCall = false;
  let toolOutput = null;

  console.log(`\nAssistant (${mode === 'build' ? 'Build' : 'Think'}):`);
  let responseText = '';

  try {
    responseText = await sdk.stream(
      messages,
      {}, // Standard parameters
      (chunk) => {
        // Stream plain white text delta live (clean, minimal Claude-Code style)
        process.stdout.write(chunk);
      }
    );
    console.log(); // Newline
  } catch (err) {
    console.error(`\n[API Error]: ${err.message}`);
    return;
  }

  // Only intercept tool calls if we are in BUILD mode!
  if (mode === 'build') {
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
              const target = path.resolve(process.cwd(), params.path);
              fs.mkdirSync(path.dirname(target), { recursive: true });
              fs.writeFileSync(target, params.content, 'utf-8');
              toolOutput = `Success: File written successfully to ${params.path} (${params.content.length} bytes).`;
              console.log(`[Tool Success]: Written to "${params.path}".`);
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
              console.log(`\n[Local Terminal]: Running command: "${params.command}"`);
              
              try {
                const output = execSync(params.command, { encoding: 'utf-8', timeout: 60000 });
                toolOutput = `Success: Command executed successfully.\n[Stdout/Stderr]:\n${output}`;
                console.log(`[Tool Success]: Execution completed.`);
              } catch (error) {
                toolOutput = `Error: Command execution failed.\n[Stderr]:\n${error.stderr || error.message}`;
                console.log(`[Tool Error]: Execution failed.`);
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

  // Record history
  messages.push({ role: 'assistant', content: responseText });

  if (hasToolCall && toolOutput && mode === 'build') {
    messages.push({
      role: 'user',
      content: `[TOOL_RESULT]:\n${toolOutput}\n\nPlease analyze this tool output and continue with the next step or output a final response.`
    });

    // Recursively continue execution autonomously
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
    let activeMode = 'think'; // default to thinking mode

    // Display beautiful ASCII Art Logo (Clean, no emojis)
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

    // Store absolute chat conversation history persistently across N slash switches!
    const chatHistory = [];

    const askQuestion = () => {
      const modeLabel = activeMode === 'build' ? '[build]' : '[think]';
      rl.question(`soldier ${modeLabel} > `, async (input) => {
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
