#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load working credentials
const credentialsPath = path.join(__dirname, 'working-credentials.json');
if (!fs.existsSync(credentialsPath)) {
  console.error('No working-credentials.json found. Please run get-refresh-token.js first.');
  process.exit(1);
}

const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

// Set up environment with credentials
const env = {
  ...process.env,
  GMAIL_ACCESS_TOKEN: credentials.access_token,
  GMAIL_REFRESH_TOKEN: credentials.refresh_token,
  GMAIL_CLIENT_ID: credentials.client_id,
  GMAIL_CLIENT_SECRET: credentials.client_secret,
  GMAIL_TOKEN_EXPIRY: credentials.expiry_date
};

// Start the server with environment variables
const serverProcess = spawn('node', [path.join(__dirname, 'src', 'index.js')], {
  env,
  stdio: 'inherit'
});

serverProcess.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Forward SIGINT to the child process
process.on('SIGINT', () => {
  serverProcess.kill('SIGINT');
});

// Exit the parent process when the child exits
serverProcess.on('exit', (code) => {
  process.exit(code);
});