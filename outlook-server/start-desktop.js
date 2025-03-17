#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// Environment variables for the server
process.env.NODE_ENV = 'production';
process.env.MCP_SERVER_TYPE = 'desktop';
process.env.MCP_SERVER_PORT = '0';
process.env.MCP_SERVER_HOST = '127.0.0.1';

// Start the server
const serverProcess = spawn('node', [path.join(__dirname, 'src', 'index.js')], {
  stdio: ['pipe', 'pipe', 'pipe'],
  detached: false,
  env: {
    ...process.env,
    FORCE_COLOR: '1'
  }
});

// Handle server output
serverProcess.stdout.on('data', (data) => {
  process.stdout.write(data);
});

serverProcess.stderr.on('data', (data) => {
  process.stderr.write(data);
});

serverProcess.on('close', (code) => {
  if (code !== 0 && process.env.MCP_SERVER_TYPE === 'desktop') {
    console.log('Server crashed, restarting...');
    setTimeout(() => {
      spawn(process.argv[0], process.argv.slice(1), {
        stdio: 'inherit',
        detached: false
      });
    }, 1000);
  }
});

// Handle process signals
process.on('SIGINT', () => {
  serverProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  serverProcess.kill();
  process.exit(0);
});

// Keep the process running
process.stdin.resume();