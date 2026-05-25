import axios from 'axios';

class SoldierBoyAI {
  /**
   * Initialize the developer AI SDK client.
   * @param {Object} config - Connection configurations
   * @param {string} config.apiKey - Authorization API key
   * @param {string} config.baseUrl - Server URL endpoint
   */
  constructor({ apiKey, baseUrl } = {}) {
    this.apiKey = apiKey || process.env.API_KEY || 'bn_live_4f3c8a9e2d6b1a0f7e5d3c2b1a0f9e8d';
    this.baseUrl = baseUrl || 'http://localhost:3000';
  }

  /**
   * Helper to set headers for requests.
   */
  _getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Send a standard blocking chat completions request.
   * @param {Array} messages - Message objects [{role: 'user', content: '...'}]
   * @param {Object} options - Custom parameters (model, provider, task, persona)
   * @returns {Promise<Object>} - Clean response payload
   */
  async chat(messages, options = {}) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/chat/completions`,
        {
          messages,
          stream: false,
          ...options
        },
        {
          headers: this._getHeaders(),
          timeout: 20000 // 20s timeout
        }
      );
      return response.data;
    } catch (error) {
      const errMsg = error.response?.data?.error?.message || error.message;
      throw new Error(`[SoldierBoyAI SDK Error] ${errMsg}`);
    }
  }

  /**
   * Request a real-time Server-Sent Events (SSE) streaming completions.
   * @param {Array} messages - Message history [{role: 'user', content: '...'}]
   * @param {Object} options - Custom parameters (model, provider, task, persona)
   * @param {Function} onChunk - Callback executed with each new text delta chunk
   * @returns {Promise<string>} - Resolves with the fully assembled text string
   */
  async stream(messages, options = {}, onChunk = () => {}) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/chat/completions`,
        {
          messages,
          stream: true,
          ...options
        },
        {
          headers: this._getHeaders(),
          responseType: 'stream',
          timeout: 20000
        }
      );

      return new Promise((resolve, reject) => {
        const stream = response.data;
        let fullContent = '';
        let buffer = '';

        stream.on('data', (chunk) => {
          buffer += chunk.toString('utf-8');
          const lines = buffer.split('\n');
          
          // Save the last partial line back to the buffer
          buffer = lines.pop();

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed === 'data: [DONE]') continue;

            if (trimmed.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                
                // Parse standard OpenAI-like delta format
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                  onChunk(delta);
                }
              } catch (err) {
                // Ignore incomplete or parsing errors on headers
              }
            }
          }
        });

        stream.on('end', () => {
          // Flush any remaining data in the buffer
          if (buffer && buffer.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(buffer.slice(6));
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                onChunk(delta);
              }
            } catch (err) {
              // Ignore
            }
          }
          resolve(fullContent);
        });

        stream.on('error', (err) => {
          reject(new Error(`[SoldierBoyAI SDK Stream Error] ${err.message}`));
        });
      });
    } catch (error) {
      const errMsg = error.response?.data?.error?.message || error.message;
      throw new Error(`[SoldierBoyAI SDK Error] ${errMsg}`);
    }
  }
}

export default SoldierBoyAI;
export { SoldierBoyAI };
