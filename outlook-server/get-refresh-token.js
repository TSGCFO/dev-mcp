#!/usr/bin/env node
const { PublicClientApplication } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
const express = require('express');
const open = require('open');
const fs = require('fs');
const path = require('path');

// MSAL configuration
const config = {
  auth: {
    clientId: '7545f065-b9ff-468b-855f-616f9af684c1',
    authority: 'https://login.microsoftonline.com/bbdc9ce9-b8de-4618-87a8-b001b17f7572',
    redirectUri: 'http://localhost:3001/auth/callback'  // Changed port to 3001
  }
};

const scopes = [
  'User.Read',
  'Mail.Read',
  'Mail.ReadWrite',
  'Mail.Send'
];

async function getToken() {
  const app = express();
  let server;

  try {
    // Create MSAL application object
    const pca = new PublicClientApplication(config);

    // Set up the auth callback route before starting the server
    app.get('/auth/callback', async (req, res) => {
      try {
        if (req.query.error) {
          throw new Error(`Authentication failed: ${req.query.error_description}`);
        }

        if (!req.query.code) {
          throw new Error('No code received in callback');
        }

        const code = req.query.code;
        const tokenResponse = await pca.acquireTokenByCode({
          code,
          scopes,
          redirectUri: config.auth.redirectUri
        });

        // Save tokens
        const tokens = {
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken,
          expiresOn: tokenResponse.expiresOn,
          scope: tokenResponse.scopes.join(' '),
          tenantId: config.auth.authority.split('/').pop()
        };

        fs.writeFileSync(
          path.join(__dirname, 'working-credentials.json'),
          JSON.stringify({
            ...tokens,
            clientId: config.auth.clientId
          }, null, 2)
        );

        // Test the connection
        const client = Client.init({
          authProvider: (done) => {
            done(null, tokens.accessToken);
          }
        });

        const user = await client.api('/me').get();
        console.log('\nAuthentication successful!');
        console.log('Connected as:', user.displayName);
        console.log('Email:', user.mail);
        console.log('\nTokens have been saved to working-credentials.json');
        console.log('You can now use the Outlook server.');

        res.send('Authentication successful! You can close this window.');
        server.close();
        process.exit(0);
      } catch (error) {
        console.error('Error in callback:', error);
        res.status(500).send(`Authentication failed: ${error.message}`);
        server.close();
        process.exit(1);
      }
    });

    // Start the server
    server = app.listen(3001, async () => {  // Changed port to 3001
      console.log('Waiting for authentication...');

      // Create auth URL
      const authCodeUrlParameters = {
        scopes,
        redirectUri: config.auth.redirectUri,
        prompt: 'select_account'
      };

      const authUrl = await pca.getAuthCodeUrl(authCodeUrlParameters);
      
      // Open browser for user to sign in
      console.log('Opening browser for authentication...');
      await open(authUrl);
    });

    // Handle server errors
    server.on('error', (error) => {
      console.error('Server error:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('Authentication failed:', error);
    if (server) {
      server.close();
    }
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nProcess terminated by user');
  process.exit(0);
});

getToken().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});