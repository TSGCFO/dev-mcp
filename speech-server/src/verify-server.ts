#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';

async function verifyServer() {
  console.log('Verifying Speech Server Configuration...');
  console.log('----------------------------------------');

  // Check MCP settings file
  const settingsPath = path.join(
    process.env.APPDATA || '',
    'Code',
    'User',
    'globalStorage',
    'rooveterinaryinc.roo-cline',
    'settings',
    'cline_mcp_settings.json'
  );

  console.log('Checking MCP settings file:', settingsPath);
  
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const speechServer = settings.mcpServers['speech-server'];

    if (!speechServer) {
      console.error('❌ Speech server not found in MCP settings');
      return false;
    }

    console.log('✅ Found speech server configuration');
    console.log('Server details:');
    console.log('- Command:', speechServer.command);
    console.log('- Args:', speechServer.args);
    console.log('- Environment variables:');
    console.log('  • AZURE_SPEECH_KEY:', speechServer.env.AZURE_SPEECH_KEY ? '***' : 'undefined');
    console.log('  • AZURE_SPEECH_REGION:', speechServer.env.AZURE_SPEECH_REGION);
    console.log('  • AZURE_SPEECH_ENDPOINT:', speechServer.env.AZURE_SPEECH_ENDPOINT);
    console.log('- Disabled:', speechServer.disabled);
    console.log('- Always Allow:', speechServer.alwaysAllow);
    console.log('- Startup Timeout:', speechServer.startupTimeout);
    console.log('- Request Timeout:', speechServer.requestTimeout);

    // Check server executable
    const serverPath = speechServer.args[0];
    console.log('\nChecking server executable:', serverPath);

    if (!fs.existsSync(serverPath)) {
      console.error('❌ Server executable not found');
      return false;
    }

    console.log('✅ Server executable exists');

    // Check required files
    const requiredFiles = [
      'src/index.ts',
      'src/tts/engine.ts',
      'src/tts/voices.ts',
      'src/parsers/document.ts',
      'src/export/audio.ts',
      'src/accessibility/manager.ts'
    ];

    console.log('\nChecking required source files:');
    const serverDir = path.dirname(serverPath);
    const srcDir = path.join(serverDir, '..', 'src');

    for (const file of requiredFiles) {
      const filePath = path.join(srcDir, file);
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Missing file: ${file}`);
        return false;
      }
      console.log(`✅ Found ${file}`);
    }

    // Check node_modules
    console.log('\nChecking dependencies:');
    const packageJsonPath = path.join(serverDir, '..', 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.error('❌ package.json not found');
      return false;
    }

    const nodeModulesPath = path.join(serverDir, '..', 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      console.error('❌ node_modules not found');
      return false;
    }

    console.log('✅ Dependencies installed');

    console.log('\n✅ All checks passed successfully');
    console.log('\nNext steps:');
    console.log('1. Restart VSCode');
    console.log('2. The speech server should be automatically registered');
    console.log('3. You can then use the speech server tools through the MCP interface');
    
    return true;
  } catch (error) {
    console.error('Error during verification:', error);
    return false;
  }
}

verifyServer().then(success => {
  process.exit(success ? 0 : 1);
});