#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} = require('@modelcontextprotocol/sdk/types.js');
const { PublicClientApplication } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');
const {
  markdownToHtml,
  formatEmailThread,
  buildSearchQuery,
  formatEmailForSending,
  getFolderId,
  getCategoryId
} = require('./utils');
require('isomorphic-fetch');

class OutlookServer {
  constructor() {
    this.server = new Server(
      {
        name: 'outlook',
        version: '0.1.0',
        description: 'Microsoft 365/Outlook integration with enhanced email features'
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
    this.credentials = credentials;

    // Initialize MSAL
    this.pca = new PublicClientApplication({
      auth: {
        clientId: credentials.clientId,
        authority: 'https://login.microsoftonline.com/common'
      }
    });

    // Initialize Graph client with token provider
    this.graphClient = Client.init({
      authProvider: async (done) => {
        try {
          // Check if token is expired
          if (this.credentials.expiresOn && new Date(this.credentials.expiresOn) <= new Date()) {
            // Refresh token
            const account = {
              homeAccountId: '',
              environment: 'login.microsoftonline.com',
              username: '',
              localAccountId: '',
              tenantId: ''
            };

            const silentRequest = {
              account,
              scopes: this.credentials.scope.split(' '),
              forceRefresh: true
            };

            const response = await this.pca.acquireTokenSilent(silentRequest);
            this.credentials.accessToken = response.accessToken;
            this.credentials.expiresOn = response.expiresOn;

            // Save updated credentials
            fs.writeFileSync(credentialsPath, JSON.stringify(this.credentials, null, 2));
          }

          done(null, this.credentials.accessToken);
        } catch (error) {
          done(error, null);
        }
      }
    });

    this.scheduledEmails = new Map();

    this.setupToolHandlers();
    
    this.server.onerror = (error) => {
      process.stderr.write(`[MCP Error] ${error}\n`);
    };
    
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_emails',
          description: 'Search Outlook emails by various criteria',
          inputSchema: {
            type: 'object',
            properties: {
              subject: { type: 'string', description: 'Search in subject' },
              from: { type: 'string', description: 'Search by sender' },
              to: { type: 'string', description: 'Search by recipient' },
              after: { type: 'string', description: 'Search after date (YYYY-MM-DD)' },
              before: { type: 'string', description: 'Search before date (YYYY-MM-DD)' },
              hasAttachment: { type: 'boolean', description: 'Has attachments' },
              folder: { type: 'string', description: 'Search in specific folder' },
              category: { type: 'string', description: 'Search by category' },
              isUnread: { type: 'boolean', description: 'Search unread emails' },
              keywords: { type: 'string', description: 'Search by keywords' }
            }
          }
        },
        {
          name: 'send_email',
          description: 'Send an email',
          inputSchema: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Recipient email' },
              subject: { type: 'string', description: 'Email subject' },
              body: { type: 'string', description: 'Email content' },
              isHtml: { type: 'boolean', description: 'Is content HTML formatted' }
            },
            required: ['to', 'subject', 'body']
          }
        },
        {
          name: 'send_html_email',
          description: 'Send HTML formatted email',
          inputSchema: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Recipient email' },
              subject: { type: 'string', description: 'Email subject' },
              markdown: { type: 'string', description: 'Email content in markdown format' },
              attachments: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    filename: { type: 'string' },
                    path: { type: 'string' },
                    contentType: { type: 'string' }
                  }
                }
              }
            },
            required: ['to', 'subject', 'markdown']
          }
        },
        {
          name: 'schedule_email',
          description: 'Schedule an email for later',
          inputSchema: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Recipient email' },
              subject: { type: 'string', description: 'Email subject' },
              body: { type: 'string', description: 'Email content' },
              sendAt: { type: 'string', description: 'When to send (ISO date string)' },
              isHtml: { type: 'boolean', description: 'Is content HTML formatted' }
            },
            required: ['to', 'subject', 'body', 'sendAt']
          }
        },
        {
          name: 'get_thread',
          description: 'Get all messages in an email thread',
          inputSchema: {
            type: 'object',
            properties: {
              threadId: { type: 'string', description: 'Thread ID to fetch' }
            },
            required: ['threadId']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'search_emails':
            return await this.searchEmails(request.params.arguments);
          case 'send_email':
            return await this.sendEmail(request.params.arguments);
          case 'send_html_email':
            return await this.sendHtmlEmail(request.params.arguments);
          case 'schedule_email':
            return await this.scheduleEmail(request.params.arguments);
          case 'get_thread':
            return await this.getThread(request.params.arguments.threadId);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        process.stderr.write(`Tool execution error: ${error}\n`);
        throw new McpError(ErrorCode.InternalError, `Failed to execute ${request.params.name}: ${error.message}`);
      }
    });
  }

  async searchEmails(criteria) {
    const query = buildSearchQuery(criteria);
    const response = await this.graphClient.api('/me/messages')
      .search(query)
      .top(20)
      .get();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(formatEmailThread(response.value), null, 2)
        }
      ]
    };
  }

  async sendEmail({ to, subject, body, isHtml = false }) {
    const message = {
      subject,
      body: {
        contentType: isHtml ? 'HTML' : 'Text',
        content: body
      },
      toRecipients: [
        {
          emailAddress: {
            address: to
          }
        }
      ]
    };

    await this.graphClient.api('/me/sendMail')
      .post({ message });

    return {
      content: [
        {
          type: 'text',
          text: 'Email sent successfully'
        }
      ]
    };
  }

  async sendHtmlEmail({ to, subject, markdown, attachments = [] }) {
    const html = markdownToHtml(markdown);
    const message = {
      subject,
      body: {
        contentType: 'HTML',
        content: html
      },
      toRecipients: [
        {
          emailAddress: {
            address: to
          }
        }
      ]
    };

    if (attachments.length > 0) {
      message.attachments = await Promise.all(attachments.map(async (attachment) => {
        const content = await fs.promises.readFile(attachment.path, { encoding: 'base64' });
        return {
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: attachment.filename,
          contentType: attachment.contentType,
          contentBytes: content
        };
      }));
    }

    await this.graphClient.api('/me/sendMail')
      .post({ message });

    return {
      content: [
        {
          type: 'text',
          text: 'HTML email sent successfully'
        }
      ]
    };
  }

  async scheduleEmail({ to, subject, body, sendAt, isHtml = false }) {
    const jobId = `email_${Date.now()}`;
    const date = new Date(sendAt);

    const job = schedule.scheduleJob(date, async () => {
      try {
        await this.sendEmail({ to, subject, body, isHtml });
        this.scheduledEmails.delete(jobId);
      } catch (error) {
        process.stderr.write(`Failed to send scheduled email: ${error}\n`);
      }
    });

    this.scheduledEmails.set(jobId, job);

    return {
      content: [
        {
          type: 'text',
          text: `Email scheduled to be sent at ${date.toISOString()}`
        }
      ]
    };
  }

  async getThread(threadId) {
    const response = await this.graphClient.api(`/me/messages`)
      .filter(`conversationId eq '${threadId}'`)
      .orderby('receivedDateTime')
      .get();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(formatEmailThread(response.value), null, 2)
        }
      ]
    };
  }

  async run() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      process.stderr.write('Outlook MCP server running on stdio\n');
    } catch (error) {
      process.stderr.write(`Failed to start server: ${error}\n`);
      process.exit(1);
    }
  }
}

const server = new OutlookServer();
server.run().catch(error => {
  process.stderr.write(`Server error: ${error}\n`);
  process.exit(1);
});