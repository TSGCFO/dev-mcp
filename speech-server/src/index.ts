#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { TTSEngine } from './tts/engine.js';
import { DocumentParser } from './parsers/document.js';
import { VoiceManager } from './tts/voices.js';
import { AudioExporter } from './export/audio.js';
import { AccessibilityManager } from './accessibility/manager.js';

interface ReadDocumentOptions {
  path: string;
  profile?: string;
  options?: {
    highlighting: boolean;
    skipCode: boolean;
    mathMode: 'natural' | 'technical' | 'simple';
    tableStrategy: 'row-by-row' | 'cell-by-cell' | 'summary';
  };
}

export class SpeechServer {
  private server: Server;
  private ttsEngine: TTSEngine;
  private documentParser: DocumentParser;
  private voiceManager: VoiceManager;
  private audioExporter: AudioExporter;
  private accessibilityManager: AccessibilityManager;
  private isConnected: boolean = false;

  constructor() {
    console.log('Starting Speech Server...');

    // Load environment variables from MCP settings
    const settingsPath = path.join(
      process.env.APPDATA || '',
      'Code',
      'User',
      'globalStorage',
      'rooveterinaryinc.roo-cline',
      'settings',
      'cline_mcp_settings.json'
    );

    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const speechServerEnv = settings.mcpServers['speech-server'].env;

      // Set environment variables
      process.env.AZURE_SPEECH_KEY = speechServerEnv.AZURE_SPEECH_KEY;
      process.env.AZURE_SPEECH_REGION = speechServerEnv.AZURE_SPEECH_REGION;
      process.env.AZURE_SPEECH_ENDPOINT = speechServerEnv.AZURE_SPEECH_ENDPOINT;

      console.log('Environment variables loaded:', {
        AZURE_SPEECH_KEY: process.env.AZURE_SPEECH_KEY ? '***' : undefined,
        AZURE_SPEECH_REGION: process.env.AZURE_SPEECH_REGION,
        AZURE_SPEECH_ENDPOINT: process.env.AZURE_SPEECH_ENDPOINT
      });
    } catch (error) {
      console.error('Error loading MCP settings:', error);
      throw error;
    }

    this.server = new Server(
      {
        name: 'speech-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize components
    this.ttsEngine = new TTSEngine();
    this.documentParser = new DocumentParser();
    this.voiceManager = new VoiceManager();
    this.audioExporter = new AudioExporter();
    this.accessibilityManager = new AccessibilityManager();

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
      if (error instanceof Error) {
        console.error('Stack:', error.stack);
      }
    };

    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      console.error('[Uncaught Exception]', error);
      if (error instanceof Error) {
        console.error('Stack:', error.stack);
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('[Unhandled Rejection]', reason);
      if (reason instanceof Error) {
        console.error('Stack:', reason.stack);
      }
    });
  }

  private async cleanup() {
    try {
      await this.ttsEngine.cleanup();
      if (this.isConnected) {
        await this.server.close();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      if (!this.isConnected) {
        throw new McpError(ErrorCode.InternalError, 'Server not connected');
      }
      return {
        tools: [
          {
            name: 'read_document',
            description: 'Read a document with advanced options',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                profile: { type: 'string' },
                options: {
                  type: 'object',
                  properties: {
                    highlighting: { type: 'boolean' },
                    skipCode: { type: 'boolean' },
                    mathMode: { 
                      type: 'string',
                      enum: ['natural', 'technical', 'simple']
                    },
                    tableStrategy: {
                      type: 'string',
                      enum: ['row-by-row', 'cell-by-cell', 'summary']
                    }
                  }
                }
              },
              required: ['path']
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.isConnected) {
        throw new McpError(ErrorCode.InternalError, 'Server not connected');
      }

      try {
        switch (request.params.name) {
          case 'read_document': {
            console.log('Processing read_document request:', request.params);
            const args = request.params.arguments;
            if (!this.validateReadDocumentOptions(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid read document options');
            }
            return await this.handleReadDocument(args);
          }
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error: any) {
        console.error('Error handling request:', error);
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

  private validateReadDocumentOptions(args: unknown): args is ReadDocumentOptions {
    if (!args || typeof args !== 'object') return false;
    const obj = args as Record<string, unknown>;
    if (typeof obj.path !== 'string') return false;
    return true;
  }

  private async handleReadDocument(args: ReadDocumentOptions) {
    const { path: docPath, profile, options } = args;

    try {
      // Validate file exists
      await fsPromises.access(docPath);

      // Parse document
      const content = await this.documentParser.parse(docPath, options);

      // Get voice profile
      const voiceProfile = profile 
        ? await this.voiceManager.getProfile(profile)
        : await this.voiceManager.getDefaultProfile();

      // Configure TTS engine
      await this.ttsEngine.configure(voiceProfile);

      // Setup accessibility features if requested
      if (options?.highlighting) {
        await this.accessibilityManager.enableHighlighting();
      }

      // Start reading
      const readingId = await this.ttsEngine.speak(content);

      return {
        content: [
          {
            type: 'text',
            text: `Started reading document with ID: ${readingId}`,
          },
        ],
      };
    } catch (error) {
      console.error('Error in handleReadDocument:', error);
      throw error;
    }
  }

  async run() {
    try {
      console.log('Connecting to MCP...');
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      this.isConnected = true;
      console.log('Speech MCP server running on stdio');
    } catch (error) {
      console.error('Error starting server:', error);
      if (error instanceof Error) {
        console.error('Stack:', error.stack);
      }
      process.exit(1);
    }
  }
}

const server = new SpeechServer();
server.run().catch((error) => {
  console.error('Fatal error:', error);
  if (error instanceof Error) {
    console.error('Stack:', error.stack);
  }
  process.exit(1);
});
