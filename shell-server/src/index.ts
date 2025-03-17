#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as pty from 'node-pty';
import * as os from 'os';
import * as ps from 'ps-node';
import { v4 as uuidv4 } from 'uuid';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

interface ProcessInfo {
  pid: number;
  command: string;
  startTime: Date;
  status: 'running' | 'completed' | 'error';
  exitCode?: number;
}

interface CommandHistory {
  id: string;
  command: string;
  output: string;
  exitCode: number;
  timestamp: Date;
  duration: number;
}

class ShellServer {
  private server: Server;
  private shell: string;
  private shellArgs: string[];
  private activeProcesses: Map<number, ProcessInfo>;
  private db!: sqlite3.Database;
  private envVars: Map<string, string>;
  private persistentSessions: Map<string, pty.IPty>;

  constructor() {
    this.server = new Server(
      {
        name: 'shell-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Determine shell based on OS
    if (process.platform === 'win32') {
      this.shell = 'powershell.exe';
      this.shellArgs = [];
    } else {
      this.shell = process.env.SHELL || '/bin/bash';
      this.shellArgs = [];
    }

    this.activeProcesses = new Map();
    this.envVars = new Map();
    // Initialize environment variables, filtering out undefined values
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        this.envVars.set(key, value);
      }
    }
    this.persistentSessions = new Map();

    this.initializeDatabase();
    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  private async initializeDatabase() {
    const dbPath = path.join(os.homedir(), '.shell-server.db');
    // Create SQLite database with verbose mode for better error reporting
    const { Database } = sqlite3.verbose();
    this.db = new Database(dbPath);
    
    await new Promise<void>((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS command_history (
          id TEXT PRIMARY KEY,
          command TEXT NOT NULL,
          output TEXT,
          exit_code INTEGER,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          duration INTEGER
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async cleanup() {
    // Kill all active processes
    for (const [pid] of this.activeProcesses) {
      try {
        process.kill(pid);
      } catch (error) {
        console.error(`Failed to kill process ${pid}:`, error);
      }
    }

    // Close all persistent sessions
    for (const session of this.persistentSessions.values()) {
      session.kill();
    }

    // Close database connection
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    await this.server.close();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'execute_shell',
          description: 'Execute a shell command and return its output',
          inputSchema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The command to execute',
              },
              timeout: {
                type: 'number',
                description: 'Command timeout in milliseconds (default: 30000)',
              },
              cwd: {
                type: 'string',
                description: 'Working directory for command execution',
              },
              interactive: {
                type: 'boolean',
                description: 'Run in interactive mode',
              },
              background: {
                type: 'boolean',
                description: 'Run command in background',
              },
              sessionId: {
                type: 'string',
                description: 'Persistent session ID',
              },
              env: {
                type: 'object',
                description: 'Additional environment variables',
              }
            },
            required: ['command'],
          },
        },
        {
          name: 'list_processes',
          description: 'List all running processes started by the shell server',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'kill_process',
          description: 'Kill a running process',
          inputSchema: {
            type: 'object',
            properties: {
              pid: {
                type: 'number',
                description: 'Process ID to kill',
              },
            },
            required: ['pid'],
          },
        },
        {
          name: 'get_history',
          description: 'Get command execution history',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Number of entries to return',
              },
              filter: {
                type: 'string',
                description: 'Filter commands by pattern',
              },
            },
          },
        },
        {
          name: 'create_session',
          description: 'Create a new persistent shell session',
          inputSchema: {
            type: 'object',
            properties: {
              env: {
                type: 'object',
                description: 'Environment variables for the session',
              },
            },
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'execute_shell':
            return await this.handleExecuteShell(request.params.arguments);
          case 'list_processes':
            return await this.handleListProcesses();
          case 'kill_process':
            return await this.handleKillProcess(request.params.arguments);
          case 'get_history':
            return await this.handleGetHistory(request.params.arguments);
          case 'create_session':
            return await this.handleCreateSession(request.params.arguments);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error?.message || 'Unknown error occurred'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleExecuteShell(args: any) {
    const {
      command,
      timeout = 30000,
      cwd = process.cwd(),
      interactive = false,
      background = false,
      sessionId,
      env = {},
    } = args;

    if (!command) {
      throw new McpError(ErrorCode.InvalidParams, 'Command is required');
    }

    const startTime = Date.now();
    let output = '';

    try {
      if (sessionId) {
        const session = this.persistentSessions.get(sessionId);
        if (!session) {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid session ID');
        }
        output = await this.executeInSession(session, command, timeout);
      } else if (interactive) {
        output = await this.executeInteractive(command, timeout, cwd, env);
      } else if (background) {
        const pid = await this.executeBackground(command, cwd, env);
        output = `Process started with PID: ${pid}`;
      } else {
        output = await this.executeCommand(command, timeout, cwd, env);
      }

      const duration = Date.now() - startTime;
      await this.saveToHistory(command, output, 0, duration);

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await this.saveToHistory(command, error.message, 1, duration);
      throw error;
    }
  }

  private async handleListProcesses() {
    const processes = Array.from(this.activeProcesses.values()).map(proc => ({
      pid: proc.pid,
      command: proc.command,
      startTime: proc.startTime.toISOString(),
      status: proc.status,
      exitCode: proc.exitCode,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(processes, null, 2),
        },
      ],
    };
  }

  private async handleKillProcess(args: any) {
    const { pid } = args;
    if (!this.activeProcesses.has(pid)) {
      throw new McpError(ErrorCode.InvalidParams, `No process found with PID ${pid}`);
    }

    try {
      process.kill(pid);
      this.activeProcesses.delete(pid);
      return {
        content: [
          {
            type: 'text',
            text: `Process ${pid} killed successfully`,
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Failed to kill process: ${error.message}`);
    }
  }

  private async handleGetHistory(args: any) {
    const { limit = 10, filter } = args;
    
    return new Promise<any>((resolve, reject) => {
      let query = 'SELECT * FROM command_history';
      const params: any[] = [];

      if (filter) {
        query += ' WHERE command LIKE ?';
        params.push(`%${filter}%`);
      }

      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            content: [
              {
                type: 'text',
                text: JSON.stringify(rows, null, 2),
              },
            ],
          });
        }
      });
    });
  }

  private async handleCreateSession(args: any) {
    const { env = {} } = args;
    const sessionId = uuidv4();
    const session = pty.spawn(this.shell, this.shellArgs, {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      env: { ...process.env, ...env },
    });

    this.persistentSessions.set(sessionId, session);
    return {
      content: [
        {
          type: 'text',
          text: `Session created with ID: ${sessionId}`,
        },
      ],
    };
  }

  private executeCommand(command: string, timeout: number, cwd: string, env: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';
      const term = pty.spawn(this.shell, this.shellArgs, {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: cwd,
        env: { ...process.env, ...env }
      });

      const timeoutId = setTimeout(() => {
        term.kill();
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      term.onData((data) => {
        output += data;
      });

      term.onExit(({ exitCode }) => {
        clearTimeout(timeoutId);
        if (exitCode === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with exit code ${exitCode}\n${output}`));
        }
      });

      term.write(`${command}\r`);
      term.write('exit\r');
    });
  }

  private executeInteractive(command: string, timeout: number, cwd: string, env: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';
      const term = pty.spawn(this.shell, this.shellArgs, {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: cwd,
        env: { ...process.env, ...env }
      });

      const timeoutId = setTimeout(() => {
        term.kill();
        reject(new Error(`Interactive command timed out after ${timeout}ms`));
      }, timeout);

      term.onData((data) => {
        output += data;
      });

      term.write(`${command}\r`);

      // Keep the terminal open for interactive input
      // The caller will need to manage the session and explicitly close it
      return resolve(output);
    });
  }

  private executeBackground(command: string, cwd: string, env: Record<string, string>): Promise<number> {
    return new Promise((resolve, reject) => {
      const term = pty.spawn(this.shell, this.shellArgs, {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: cwd,
        env: { ...process.env, ...env }
      });

      const processInfo: ProcessInfo = {
        pid: term.pid,
        command,
        startTime: new Date(),
        status: 'running',
      };

      this.activeProcesses.set(term.pid, processInfo);

      term.onExit(({ exitCode }) => {
        processInfo.status = exitCode === 0 ? 'completed' : 'error';
        processInfo.exitCode = exitCode;
      });

      term.write(`${command}\r`);
      resolve(term.pid);
    });
  }

  private executeInSession(session: pty.IPty, command: string, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';
      const timeoutId = setTimeout(() => {
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      const dataHandler = (data: string) => {
        output += data;
      };

      session.onData(dataHandler);
      session.write(`${command}\r`);

      // Wait for command completion (this is a simplified approach)
      setTimeout(() => {
        clearTimeout(timeoutId);
        session.onData(dataHandler); // Remove the handler by adding it again (node-pty behavior)
        resolve(output);
      }, 100);
    });
  }

  private async saveToHistory(command: string, output: string, exitCode: number, duration: number) {
    const id = uuidv4();
    return new Promise<void>((resolve, reject) => {
      this.db.run(
        'INSERT INTO command_history (id, command, output, exit_code, duration) VALUES (?, ?, ?, ?, ?)',
        [id, command, output, exitCode, duration],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Shell MCP server running on stdio');
  }
}

const server = new ShellServer();
server.run().catch(console.error);
