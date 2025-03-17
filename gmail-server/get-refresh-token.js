#!/usr/bin/env node
import { google } from 'googleapis';
import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// OAuth 2.0 configuration
const CLIENT_ID = "148367725558-hr8pks9f6a3j8hgbb7lgcc83cntf6k5t.apps.googleusercontent.com";
const CLIENT_SECRET = "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";

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    'http://localhost:3000/oauth2callback'
);

// Generate the url that will be used for authorization
const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.settings.basic'
    ]
});

// Create local server to receive the OAuth2 callback
const server = http.createServer(async (req, res) => {
    try {
        const queryObject = url.parse(req.url, true).query;
        
        if (queryObject.code) {
            // Get tokens from code
            const { tokens } = await oauth2Client.getToken(queryObject.code);
            
            // Save credentials to file
            const credentials = {
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                ...tokens
            };

            fs.writeFileSync(
                path.join(__dirname, 'working-credentials.json'),
                JSON.stringify(credentials, null, 2)
            );

            res.end('Authentication successful! You can close this window.');
            server.close();
        }
    } catch (error) {
        console.error('Error getting tokens:', error);
        res.end('Authentication failed! Please check the console.');
        server.close();
    }
});

// Start local server
server.listen(3000, () => {
    console.log('1. Server is running at http://localhost:3000');
    console.log('2. Opening browser for authentication...');
    open(authorizeUrl);
});
