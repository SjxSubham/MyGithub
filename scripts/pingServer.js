#!/usr/bin/env node

import https from 'https';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file at project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Sends a ping request to the specified URL
 * @param {string} url - URL to ping
 * @returns {Promise<object>} - Response data
 */
async function pingServer(url) {
  return new Promise((resolve, reject) => {
    console.log(`🔄 Pinging: ${url}`);

    const httpModule = url.startsWith('https') ? https : http;

    const req = httpModule.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const statusColor = res.statusCode >= 200 && res.statusCode < 300 ? '\x1b[32m' : '\x1b[31m';
        console.log(`${statusColor}📊 Status: ${res.statusCode}\x1b[0m`);

        try {
          const response = JSON.parse(data);
          console.log('📦 Response:', response);
          resolve(response);
        } catch (e) {
          console.log('📦 Raw response:', data);
          resolve({ raw: data });
        }
      });
    });

    req.on('error', (error) => {
      console.error(`❌ Error: ${error.message}`);
      reject(error);
    });

    // Set timeout to 10 seconds
    req.setTimeout(10000, () => {
      req.destroy();
      const error = new Error('Request timed out after 10 seconds');
      console.error(`⏱️ ${error.message}`);
      reject(error);
    });

    req.end();
  });
}

/**
 * Main function
 */
async function main() {
  const url = process.argv[2] || process.env.APP_URL || 'http://localhost:5000';
  const endpoint = '/api/health';
  const pingUrl = url.endsWith(endpoint) ? url : `${url}${endpoint}`;

  console.log('🚀 Starting manual ping to prevent Render from sleeping');

  try {
    const startTime = Date.now();
    await pingServer(pingUrl);
    const duration = Date.now() - startTime;
    console.log(`✅ Ping completed in ${duration}ms`);
  } catch (error) {
    console.error(`💥 Ping failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
