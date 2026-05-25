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

// Inject the agent system prompt directing tool calling behavior
const AGENT_SYSTEM_PROMPT = `You are Vought AI's "soldier-boy", an elite, autonomous local coding agent with direct access to local system files and shell utilities in workspace path: "${process.cwd()}".

You accomplish engineering tasks by thinking, then executing direct actions via structured tool call tags.

### Available Tools:
1. **write_file**: Create or overwrite a local file with complete source code content.
   Format: {{call:write_file, {"path": "relative/file/path.py", "content": "source code content here"} }}

2. **read_file**: Read complete source code content from an existing local file.
   Format: {{call:read_file, {"path": "relative/file/path.py"} }}

3. **list_dir**: List folders and files inside a relative directory path.
   Format: {{call:list_dir, {"path": "relative/directory/path"} }}

4. **execute_command**: Execute a terminal shell command locally on the system.
   Format: {{call:execute_command, {"command": "shell command here"} }}

### Strict Operating Guidelines:
- If you call a tool, you MUST end your response chunk immediately after the }} tag. Do not output anything else.
- I will execute the tool locally on your behalf and feed the output results back to you.
- Once you receive the tool results, continue your analysis, correct errors, and proceed to the next step or output another tool call if required.
- Provide clean, professional code. Explain what you are doing before executing any tool call.`;

/**
 * Helper: Recursive Autonomous Agent Execution Loop
 */
async function runAutonomousAgentLoop(messages) {
  let hasToolCall = false;
  let toolOutput = null;

  console.log(chalk.bold.cyan('\n🤖 Assistant (Thinking...): '));
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

  // Parse for structured tool call matches
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

  // Record history
  messages.push({ role: 'assistant', content: responseText });

  if (hasToolCall && toolOutput) {
    // Inject the execution outcome as a tool result in conversation
    messages.push({
      role: 'user',
      content: `[TOOL_RESULT]:\n${toolOutput}\n\nPlease analyze this tool output and continue with the next step or output a final response.`
    });

    // Recursively continue execution autonomously
    await runAutonomousAgentLoop(messages);
  }
}

/**
 * COMMAND: soldier-boy chat
 * Interactive tool-calling autonomous chat session.
 */
program
  .command('chat')
  .description('Commence an autonomous tool-calling chat session with the AI backend')
  .action(() => {
    // Interactive Session Loop
    console.log(chalk.bold.magenta('\n========================================='));
    console.log(chalk.bold.magenta(`  🦾 Vought AI — soldier-boy Agent Loop`));
    console.log(chalk.dim(`  Workspace: ${process.cwd()}`));
    console.log(chalk.dim(`  Tools Loaded: read_file, write_file, list_dir, execute_command`));
    console.log(chalk.bold.magenta('=========================================\n'));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Initialize messages with the agent's strict instructions
    const messages = [
      { role: 'system', content: AGENT_SYSTEM_PROMPT }
    ];

    const askQuestion = () => {
      rl.question(chalk.bold.cyan('\nsoldier-boy > '), async (input) => {
        const trimmed = input.trim();
        if (!trimmed) {
          askQuestion();
          return;
        }

        if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
          console.log(chalk.dim('\nSession closed. Goodbye! 👋'));
          rl.close();
          process.exit(0);
        }

        messages.push({ role: 'user', content: trimmed });

        // Run the autonomous loops recursively
        await runAutonomousAgentLoop(messages);

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
