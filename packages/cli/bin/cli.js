#!/usr/bin/env node

/**
 * soldier-boy-cli: Local Coding Agent Terminal Interface
 * Connects your local file system directly to your hosted unified AI API.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { SoldierBoyAI } from '@soldier-boy/sdk';

const program = new Command();
const sdk = new SoldierBoyAI();

program
  .name('soldier-boy')
  .description('Soldier Boy Local Coding Agent terminal tools')
  .version('1.0.0');

/**
 * COMMAND: soldier-boy chat
 * Interactive or single-shot streaming chat command with the unified backend.
 */
program
  .command('chat')
  .description('Commence a real-time streaming chat session with the AI backend')
  .option('-m, --message <string>', 'Single-shot prompt to send directly')
  .option('-p, --persona <string>', 'Persona profile system instructions preset to load (coder, planner, reviewer)', 'coder')
  .action(async (options) => {
    // 1. Single-shot prompt execution
    if (options.message) {
      const spinner = ora(chalk.dim('Connecting to Soldier Boy Core...')).start();
      try {
        spinner.stop();
        console.log(chalk.bold.cyan('🤖 Assistant: '));
        
        await sdk.stream(
          [{ role: 'user', content: options.message }],
          { persona: options.persona },
          (chunk) => {
            process.stdout.write(chalk.green(chunk));
          }
        );
        console.log('\n');
      } catch (err) {
        spinner.fail(chalk.red(`Failed: ${err.message}`));
      }
      return;
    }

    // 2. Interactive Session Loop
    console.log(chalk.bold.magenta('\n========================================='));
    console.log(chalk.bold.magenta(`  🚀 soldier-boy CLI Interactive Session Start`));
    console.log(chalk.dim(`  Persona Loaded: ${options.persona} | Port: 3000`));
    console.log(chalk.bold.magenta('=========================================\n'));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const messages = [];

    const askQuestion = () => {
      rl.question(chalk.bold.yellow('\n👤 You: '), async (input) => {
        const trimmed = input.trim();
        if (!trimmed) {
          askQuestion();
          return;
        }

        if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
          console.log(chalk.dim('\nSession closed. Goodbye! 👋'));
          rl.close();
          return;
        }

        messages.push({ role: 'user', content: trimmed });

        console.log(chalk.bold.cyan('\n🤖 Assistant: '));
        const spinner = ora(chalk.dim('Thinking...')).start();

        try {
          spinner.stop();
          const fullResponse = await sdk.stream(
            messages,
            { persona: options.persona },
            (chunk) => {
              process.stdout.write(chalk.green(chunk));
            }
          );
          console.log(); // print newline
          messages.push({ role: 'assistant', content: fullResponse });
        } catch (err) {
          spinner.stop();
          console.error(chalk.red(`\n❌ Error: ${err.message}`));
        }

        askQuestion();
      });
    };

    askQuestion();
  });

/**
 * COMMAND: soldier-boy explain <file>
 * Links the CLI directly to the local filesystem context.
 */
program
  .command('explain')
  .description('Read a local source file and stream a detailed AI explanation')
  .argument('<file>', 'Relative or absolute path of the target source file')
  .action(async (file) => {
    const targetPath = path.resolve(process.cwd(), file);
    
    // Check if target file exists
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
          {
            role: 'user',
            content: `Explain the purpose, architecture, and logic of this local source file named "${fileName}":\n\n\`\`\`javascript\n${fileContent}\n\`\`\``
          }
        ],
        { persona: 'coder' },
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
