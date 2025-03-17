# MCP Servers - Technical Context

## Technologies Used
- **Node.js**: Used for document-handler, outlook, gmail, shell, speech-server, taskmanager, and n8n servers
- **Python**: Used for supabase-mcp-server and fetch server
- **MCP SDK**: Core library that implements the Model Context Protocol
- **PostgreSQL**: Database used by the Supabase server
- **APIs**: Various external APIs (Gmail, Outlook, OpenWeather, etc.) are accessed through the servers

## Development Setup
- **Environment**: Windows 11 with Node.js and Python installed
- **Dependencies**: Each server has its own dependencies managed through package.json (Node.js) or pyproject.toml (Python)
- **Configuration**: 
  - Global MCP settings in `c:\Users\Hassan\AppData\Roaming\Code\User\globalStorage\rooveterinaryinc.roo-cline\settings\cline_mcp_settings.json`
  - Server-specific configuration through environment variables in the settings file

## Technical Constraints
- **Path Configuration**: Node.js and Python executables must be specified with full paths in the settings
- **Process Isolation**: Each server runs as a separate process for security and stability
- **Authentication**: API keys and credentials are stored as environment variables
- **Communication Protocol**: Communication between AI and servers is through stdio using the MCP protocol
- **Resource Usage**: Multiple concurrent servers can consume significant system resources