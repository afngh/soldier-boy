import axios from 'axios';
import { SoldierBoyAI } from './packages/sdk-js/index.js';

const BASE_URL = 'http://localhost:3000';
const VALID_KEY = 'black-noir-secret-key';

async function runStreamingTests() {
  console.log('🧪 Starting Phase 3 Developer Infrastructure Verification Tests...\n');

  // Test 1: Native Server SSE Streaming Completions
  try {
    console.log('--- Test 1: Native SSE stream:true (POST /v1/chat/completions) ---');
    const response = await axios.post(
      `${BASE_URL}/v1/chat/completions`,
      {
        model: 'llama-small', // llama-3.1-8b-instant alias
        messages: [{ role: 'user', content: 'Say "Ready" in exactly one word.' }],
        stream: true
      },
      {
        headers: { 'Authorization': `Bearer ${VALID_KEY}` },
        responseType: 'stream'
      }
    );

    await new Promise((resolve) => {
      let buffer = '';
      response.data.on('data', (chunk) => {
        buffer += chunk.toString('utf-8');
      });
      response.data.on('end', () => {
        console.log('✅ SSE Stream finished. Raw stream content snippet:\n');
        console.log(buffer.slice(0, 300) + '...\n');
        resolve();
      });
    });
  } catch (err) {
    console.error('❌ Native stream failed:', err.message);
  }

  // Test 2: JS SDK Streaming Integration
  try {
    console.log('--- Test 2: SDK stream(messages, options, onChunk) ---');
    const sdk = new SoldierBoyAI({ apiKey: VALID_KEY, baseUrl: BASE_URL });

    process.stdout.write('🤖 SDK Streaming Delta: ');
    const fullText = await sdk.stream(
      [{ role: 'user', content: 'Translate to French: "Welcome"' }],
      { persona: 'coder' },
      (chunk) => {
        process.stdout.write(chunk);
      }
    );
    console.log('\n\n✅ SDK Stream completed. Total Text:', JSON.stringify(fullText));
  } catch (err) {
    console.error('❌ SDK stream test failed:', err.message);
  }

  // Test 3: Prompt Persona Routing (coder.txt validation)
  try {
    console.log('\n--- Test 3: Prompt Persona (reviewer.txt validation) ---');
    const sdk = new SoldierBoyAI({ apiKey: VALID_KEY, baseUrl: BASE_URL });

    const response = await sdk.chat(
      [{ role: 'user', content: 'Who are you, and what is your strict mandate?' }],
      { persona: 'reviewer' }
    );
    console.log('✅ System Persona response validation:');
    console.log(response.message?.content);
  } catch (err) {
    console.error('❌ Persona routing test failed:', err.message);
  }
}

runStreamingTests();
