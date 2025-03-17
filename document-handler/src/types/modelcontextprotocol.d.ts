declare module '@modelcontextprotocol/sdk' {
  export class Server {
    constructor(info: { name: string; version: string; description?: string }, config: { capabilities: { tools: {} } });
    setRequestHandler(schema: any, handler: Function): void;
    connect(transport: any): Promise<void>;
    close(): Promise<void>;
    onerror: (error: Error) => void;
  }

  export class StdioServerTransport {
    constructor();
  }

  export const CallToolRequestSchema: unique symbol;
  export const ListToolsRequestSchema: unique symbol;

  export enum ErrorCode {
    InvalidRequest = 'InvalidRequest',
    MethodNotFound = 'MethodNotFound',
    InternalError = 'InternalError'
  }

  export class McpError extends Error {
    constructor(code: ErrorCode, message: string);
  }

  export interface ToolRequest {
    params: {
      name: string;
      arguments: any;
    };
  }
}