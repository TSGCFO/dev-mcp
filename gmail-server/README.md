# Gmail MCP Server

This MCP server provides tools to interact with Gmail, allowing you to read emails and send responses directly through the MCP interface.

## Features

- Read latest unread emails
- Send new emails
- Reply to existing emails

## Setup

1. The server is already configured with Gmail API credentials and OAuth2 refresh token in the MCP settings file.

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm run start-server
```

## Available Tools

### read_latest_emails
Reads the latest unread emails from your Gmail inbox.
```json
{
  "maxResults": 5 // Optional, defaults to 5
}
```

### send_email
Sends a new email.
```json
{
  "to": "recipient@example.com",
  "subject": "Email Subject",
  "body": "Email content here"
}
```

### reply_to_email
Replies to an existing email.
```json
{
  "messageId": "message-id-from-read-latest-emails",
  "body": "Reply content here"
}
```

## Configuration

The server uses the following environment variables (already configured in MCP settings):
- GMAIL_CLIENT_ID
- GMAIL_CLIENT_SECRET
- GMAIL_REFRESH_TOKEN

## Project Structure

```
gmail-server/
├── src/
│   └── index.js         # Main server implementation
├── credentials.json     # Gmail API credentials
├── package.json        # Project dependencies
├── start-server.js     # Server startup script
└── README.md          # This file
```

## Example Usage

Once the server is running, you can use it through the MCP interface to:
1. Read your latest unread emails
2. Send new emails to any recipient
3. Reply to existing email threads

The server handles all Gmail API authentication and email operations automatically.