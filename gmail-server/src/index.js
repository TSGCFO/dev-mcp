#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} = require('@modelcontextprotocol/sdk/types.js');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GmailServer {
  constructor() {
    this.server = new Server(
      {
        name: 'gmail',
        version: '0.1.0',
        description: 'Gmail integration for sending emails with attachments'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Load credentials
    const credentialsPath = path.join(__dirname, '..', 'working-credentials.json');
    if (!fs.existsSync(credentialsPath)) {
      throw new Error('No working-credentials.json found. Please run get-refresh-token.js first.');
    }

    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    
    // Create OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret
    );

    this.oauth2Client.setCredentials({
      refresh_token: credentials.refresh_token
    });

    this.setupToolHandlers();
    
    this.server.onerror = (error) => {
      process.stderr.write(`[MCP Error] ${error}\n`);
    };
  }

  async createTransporter() {
    try {
      const accessToken = await this.oauth2Client.getAccessToken();
      
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: await this.oauth2Client.getTokenInfo(accessToken.token),
          clientId: this.oauth2Client._clientId,
          clientSecret: this.oauth2Client._clientSecret,
          refreshToken: this.oauth2Client.credentials.refresh_token,
          accessToken: accessToken.token
        }
      });
    } catch (error) {
      throw new Error(`Failed to create transporter: ${error.message}`);
    }
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'send_email',
          description: 'Send an email with optional attachments',
          inputSchema: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Recipient email' },
              subject: { type: 'string', description: 'Email subject' },
              body: { type: 'string', description: 'Email content' },
              isHtml: { 
                type: 'boolean', 
                description: 'Is content HTML formatted',
                default: false
              },
              attachments: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    path: { type: 'string', description: 'Path to attachment file' },
                    filename: { type: 'string', description: 'Name of the file' }
                  },
                  required: ['path', 'filename']
                }
              }
            },
            required: ['to', 'subject', 'body']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'send_email') {
        try {
          const { to, subject, body, isHtml = false, attachments = [] } = request.params.arguments;
          
          const transporter = await this.createTransporter();
          
          const mailOptions = {
            to,
            subject,
            [isHtml ? 'html' : 'text']: body,
            attachments: attachments.map(att => ({
              filename: att.filename,
              path: att.path
            }))
          };

          await transporter.sendMail(mailOptions);

          return {
            content: [
              {
                type: 'text',
                text: 'Email sent successfully'
              }
            ]
          };
        } catch (error) {
          throw new McpError(ErrorCode.InternalError, `Failed to send email: ${error.message}`);
        }
      }
      
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    });
  }

  async run() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      process.stderr.write('Gmail MCP server running on stdio\n');
    } catch (error) {
      process.stderr.write(`Failed to start server: ${error}\n`);
      process.exit(1);
    }
  }
}

const server = new GmailServer();
server.run().catch(error => {
  process.stderr.write(`Server error: ${error}\n`);
  process.exit(1);
});
