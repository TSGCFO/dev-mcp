# MCP Servers - System Patterns

## How the System is Built
The MCP (Model Context Protocol) servers are built using a standardized protocol that allows AI systems to communicate with external services and resources. Each server follows a common pattern:

1. **Server Definition**: Each server implements the MCP protocol specification
2. **Tools & Resources**: Servers expose capabilities as either tools (functions) or resources (data)
3. **Connection Handling**: Servers use standard I/O (stdio) for communication with the AI system
4. **Configuration**: Servers use environment variables and settings files for configuration

## Key Technical Decisions
- **Language-specific Implementations**: Different servers use appropriate languages (Node.js, Python) based on their requirements
- **Server Isolation**: Each server runs as a separate process for security and stability
- **Central Configuration**: All servers are configured in a single JSON file for easier management
- **Authentication**: Credentials are stored in environment variables rather than hardcoded
- **Error Handling**: Standardized error responses and logging for easier debugging

## Architecture Patterns
- **Tool-based Actions**: Server capabilities that perform actions are exposed as tools
- **Resource-based Data**: Read-only data or content is exposed as resources
- **Singleton Pattern**: Server instances are generally singletons to manage resources efficiently
- **MVC-like Separation**: Logic is separated into modules for better organization (client, handlers, validators)
- **Safety Controls**: Some servers implement safety controls to prevent harmful operations (e.g., read-only mode)