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
  .name('soldier-boy')
  .description('Vought AI\'s Soldier Boy - Autonomous Local Coding Agent')
  .version('1.0.0');

// System prompt for BUILD MODE (Enables tools)
const BUILD_SYSTEM_PROMPT = `You are Vought AI's "soldier-boy" running in [BUILD MODE]. Your primary mission is to perform active filesystem modifications, read source files, and execute terminal commands locally in: "${process.cwd()}".

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

// System prompt for THINK MODE (Disables tools, focus on pure chatting/planning)
const THINK_SYSTEM_PROMPT = `You are Vought AI's "soldier-boy" running in [THINK MODE]. Your primary mission is to answer questions, analyze architectures, chat, and help the user plan without modifying the filesystem.

### Strict Guidelines:
- DO NOT use or output any tool calls (no {{call:...}} formatting).
- Focus purely on conceptual explanations, code architectures, plans, and chat responses.
- Be concise, professional, and helpful.`;

/**
 * Helper: Recursive Autonomous Agent Execution Loop
 */
async function runAutonomousAgentLoop(messages, mode) {
  let hasToolCall = false;
  let toolOutput = null;

  console.log(chalk.bold.cyan(`\n🤖 Assistant (${mode === 'build' ? 'Build Mode' : 'Thinking Mode'}): `));
  let responseText = '';

  try {
    responseText = await sdk.stream(
      messages,
      {}, // Standard parameters
      (chunk) => {
        // Stream delta live to console
        process.stdout.write(chalk.green(chunk));
      }
    );
    console.log(); // Newline
  } catch (err) {
    console.error(chalk.red(`\n❌ API Error: ${err.message}`));
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
        console.log(chalk.bold.red(`\n⚠️  [Agent Error]: Failed to parse JSON parameters. Make sure to double quote JSON keys.`));
        toolOutput = `Error: Failed to parse parameters as valid JSON. Retrying tool call using strict double-quoted JSON formats.`;
        hasToolCall = true;
      }

      if (!hasToolCall) {
        console.log(chalk.bold.yellow(`\n⚙️  [Tool Call]: Intercepted local action "${toolName}"...`));

        try {
          if (toolName === 'write_file') {
            if (!params.path || params.content === undefined) {
              toolOutput = `Error: Missing 'path' or 'content' in write_file parameters.`;
              console.log(chalk.red(`❌ [Tool Error]: Missing params.`));
            } else {
              const target = path.resolve(process.cwd(), params.path);
              fs.mkdirSync(path.dirname(target), { recursive: true });
              fs.writeFileSync(target, params.content, 'utf-8');
              toolOutput = `Success: File written successfully to ${params.path} (${params.content.length} bytes).`;
              console.log(chalk.bold.green(`✅ [Tool Success]: Written to "${params.path}".`));
            }
          } else if (toolName === 'read_file') {
            if (!params.path) {
              toolOutput = `Error: Missing 'path' in read_file parameters.`;
              console.log(chalk.red(`❌ [Tool Error]: Missing params.`));
            } else {
              const target = path.resolve(process.cwd(), params.path);
              if (!fs.existsSync(target)) {
                toolOutput = `Error: File not found at path "${params.path}".`;
                console.log(chalk.bold.red(`❌ [Tool Error]: File not found.`));
              } else {
                const content = fs.readFileSync(target, 'utf-8');
                toolOutput = `Success: File content of "${params.path}":\n---\n${content}\n---`;
                console.log(chalk.bold.green(`✅ [Tool Success]: File content loaded.`));
              }
            }
          } else if (toolName === 'list_dir') {
            const target = path.resolve(process.cwd(), params.path || '.');
            if (!fs.existsSync(target)) {
              toolOutput = `Error: Directory not found at path "${params.path || '.'}".`;
              console.log(chalk.bold.red(`❌ [Tool Error]: Directory not found.`));
            } else {
              const files = fs.readdirSync(target);
              toolOutput = `Success: Directory listing of "${params.path || '.'}":\n${files.join('\n')}`;
              console.log(chalk.bold.green(`✅ [Tool Success]: Directory listing completed.`));
            }
          } else if (toolName === 'execute_command') {
            if (!params.command) {
              toolOutput = `Error: Missing 'command' in execute_command parameters.`;
              console.log(chalk.red(`❌ [Tool Error]: Missing command parameter.`));
            } else {
              console.log(chalk.bold.yellow(`\n⚙️  [Local Terminal]: Running command: "${params.command}"`));
              
              try {
                const output = execSync(params.command, { encoding: 'utf-8', timeout: 60000 });
                toolOutput = `Success: Command executed successfully.\n[Stdout/Stderr]:\n${output}`;
                console.log(chalk.bold.green(`✅ [Tool Success]: Execution completed.`));
              } catch (error) {
                toolOutput = `Error: Command execution failed.\n[Stderr]:\n${error.stderr || error.message}`;
                console.log(chalk.bold.red(`❌ [Tool Error]: Execution failed.`));
              }
            }
          } else {
            toolOutput = `Error: Unknown tool "${toolName}".`;
            console.log(chalk.bold.red(`❌ [Tool Error]: Unknown tool requested.`));
          }
        } catch (execError) {
          toolOutput = `Error executing tool: ${execError.message}`;
          console.log(chalk.bold.red(`❌ [Tool Exception]: ${execError.message}`));
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
 * COMMAND: soldier-boy chat
 * Multi-mode recursive chat loop.
 */
program
  .command('chat')
  .description('Commence a multi-mode (think/build) chat session with the AI backend')
  .action(() => {
    let activeMode = 'think'; // default to thinking mode

    console.log(chalk.bold.magenta('\n========================================='));
    console.log(chalk.bold.magenta(`  🦾 Vought AI — soldier-boy Multi-Mode Loop`));
    console.log(chalk.dim(`  Workspace: ${process.cwd()}`));
    console.log(chalk.dim(`  Default Mode: [THINK] (Conversational, tools off)`));
    console.log(chalk.dim(`  Build Mode:   [BUILD] (Filesystem read/write & exec)`));
    console.log(chalk.bold.magenta('========================================='));
    console.log(chalk.bold.yellow('  💡 Slash Commands:'));
    console.log(chalk.dim('     /think <prompt>  - Switch to Think Mode and send prompt'));
    console.log(chalk.dim('     /build <prompt>  - Switch to Build Mode and execute tools'));
    console.log(chalk.dim('     /think           - Switch active mode to Think'));
    console.log(chalk.dim('     /build           - Switch active mode to Build'));
    console.log(chalk.dim('     exit / quit      - Terminate chat loop'));
    console.log(chalk.bold.magenta('=========================================\n'));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Store absolute chat conversation history persistently across N slash switches!
    const chatHistory = [];

    const askQuestion = () => {
      // Prompt display shows active mode: e.g. "soldier-boy [think] > "
      const modeLabel = activeMode === 'build' ? chalk.bold.red('[build]') : chalk.bold.green('[think]');
      rl.question(`${chalk.cyan('soldier-boy')} ${modeLabel} ${chalk.cyan('> ')}`, async (input) => {
        let trimmed = input.trim();
        if (!trimmed) {
          askQuestion();
          return;
        }

        const lowerVal = trimmed.toLowerCase();
        if (lowerVal === 'exit' || lowerVal === 'quit') {
          console.log(chalk.dim('\nSession closed. Goodbye! 👋'));
          rl.close();
          process.exit(0);
        }

        // Parse slash commands:
        if (trimmed.startsWith('/build')) {
          activeMode = 'build';
          const prompt = trimmed.slice(6).trim();
          if (!prompt) {
            console.log(chalk.bold.red('⚙️  Switched active mode to [BUILD MODE]. Filesystem tools are now active.'));
            askQuestion();
            return;
          }
          trimmed = prompt;
        } else if (trimmed.startsWith('/think')) {
          activeMode = 'think';
          const prompt = trimmed.slice(6).trim();
          if (!prompt) {
            console.log(chalk.bold.green('⚙️  Switched active mode to [THINK MODE]. Pure conversational mode active.'));
            askQuestion();
            return;
          }
          trimmed = prompt;
        }

        // Push clean user prompt to history
        chatHistory.push({ role: 'user', content: trimmed });

        // Update / prepend the correct mode instructions at the start of history to drive mode shifts
        const cleanHistory = [
          { role: 'system', content: activeMode === 'build' ? BUILD_SYSTEM_PROMPT : THINK_SYSTEM_PROMPT },
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
 * COMMAND: soldier-boy explain <file>
 * Direct single-file context analyzer
 */
program
  .command('explain')
  .description('Read a local source file and stream a detailed AI explanation')
  .argument('<file>', 'Relative or absolute path of the target source file')
  .action(async (file) => {
    const targetPath = path.resolve(process.cwd(), file);
    
    if (!fs.existsSync(targetPath)) {
      console.error(chalk.red(`❌ Error: Local file does not exist at path "${file}"`));
      process.exit(1);
    }

    const fileContent = fs.readFileSync(targetPath, 'utf-8');
    const fileName = path.basename(targetPath);

    console.log(chalk.bold.yellow(`\n📂 Reading local file context: "${fileName}"...`));
    console.log(chalk.bold.cyan('🤖 Streaming Explanation:\n'));

    const spinner = ora(chalk.dim('Analyzing...')).start();
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
          process.stdout.write(chalk.green(chunk));
        }
      );
      console.log('\n');
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
    }
  });

program.parse(process.argv);
