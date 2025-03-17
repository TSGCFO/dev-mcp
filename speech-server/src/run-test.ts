#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

// Read MCP settings
const settingsPath = path.join(
  process.env.APPDATA || '',
  'Code',
  'User',
  'globalStorage',
  'rooveterinaryinc.roo-cline',
  'settings',
  'cline_mcp_settings.json'
);

console.log('Reading MCP settings from:', settingsPath);

try {
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const speechServerEnv = settings.mcpServers['speech-server'].env;

  console.log('Found speech server environment variables:', {
    AZURE_SPEECH_KEY: speechServerEnv.AZURE_SPEECH_KEY ? '***' : undefined,
    AZURE_SPEECH_REGION: speechServerEnv.AZURE_SPEECH_REGION,
    AZURE_SPEECH_ENDPOINT: speechServerEnv.AZURE_SPEECH_ENDPOINT
  });

  // Run the test script with environment variables
  const testProcess = spawn('node', ['build/test-credentials.js'], {
    env: {
      ...process.env,
      ...speechServerEnv
    },
    stdio: 'inherit'
  });

  testProcess.on('close', (code) => {
    process.exit(code || 0);
  });

} catch (error) {
  console.error('Error reading MCP settings:', error);
  process.exit(1);
}