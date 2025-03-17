#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from 'fs-extra';
import * as path from 'path';
import pdf from 'pdf-parse';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import * as nodemailer from 'nodemailer';

interface FileOperation {
  filename: string;
}

interface EmailOperation extends FileOperation {
  to: string;
  subject: string;
  body: string;
}

interface EditOperation extends FileOperation {
  content: string;
}

const SEARCH_DIRECTORIES = [
  'C:\\Users\\Hassan\\Desktop',
  'C:\\Users\\Hassan\\Downloads',
  'C:\\Users\\Hassan\\Documents',
  'C:\\Users\\Hassan\\Pictures',
  'C:\\Users\\Hassan\\Music',
  'C:\\Users\\Hassan\\Videos',
  'C:\\Users\\Hassan\\PycharmProjects',
  'C:\\Users\\Hassan\\VSdode\\LedgerLink_client'
];

class DocumentHandler {
  private server: Server;
  private emailTransporter: nodemailer.Transporter;

  constructor() {
    this.server = new Server(
      {
        name: 'document-handler',
        version: '0.1.0',
        description: 'A document handling server that provides tools for reading, editing, deleting, and emailing PDF, Word, and Excel files. Features include text extraction from PDFs, content editing for Word/Excel documents, file deletion, and email capabilities with attachments.'
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error: Error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async findFile(filename: string): Promise<string> {
    for (const dir of SEARCH_DIRECTORIES) {
      try {
        const files = await fs.readdir(dir);
        const match = files.find(file => file.toLowerCase() === filename.toLowerCase());
        if (match) {
          return path.join(dir, match);
        }
      } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
      }
    }
    throw new McpError(
      ErrorCode.InvalidRequest,
      `File ${filename} not found in any of the accessible directories`
    );
  }

  private async readDocument(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    const buffer = await fs.readFile(filePath);

    switch (ext) {
      case '.pdf':
        const pdfData = await pdf(buffer);
        return pdfData.text;
      
      case '.docx':
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      
      case '.xlsx':
      case '.xls':
        const workbook = XLSX.read(buffer);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        return XLSX.utils.sheet_to_csv(worksheet);
      
      default:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unsupported file type: ${ext}`
        );
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'read_document',
          description: 'Read content from PDF, Word, or Excel files. Just provide the filename and it will be found automatically.',
          inputSchema: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: 'Name of the file to read (e.g., "document.pdf")',
              },
            },
            required: ['filename'],
          },
        },
        {
          name: 'edit_document',
          description: 'Edit content in Word or Excel files. Just provide the filename and it will be found automatically.',
          inputSchema: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: 'Name of the file to edit (e.g., "document.docx")',
              },
              content: {
                type: 'string',
                description: 'New content to write to the file',
              },
            },
            required: ['filename', 'content'],
          },
        },
        {
          name: 'delete_document',
          description: 'Delete a document file. Just provide the filename and it will be found automatically.',
          inputSchema: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: 'Name of the file to delete',
              },
            },
            required: ['filename'],
          },
        },
        {
          name: 'email_document',
          description: 'Email a document as an attachment. Just provide the filename and it will be found automatically.',
          inputSchema: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: 'Name of the file to email',
              },
              to: {
                type: 'string',
                description: 'Recipient email address',
              },
              subject: {
                type: 'string',
                description: 'Email subject',
              },
              body: {
                type: 'string',
                description: 'Email body content',
              },
            },
            required: ['filename', 'to', 'subject', 'body'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!request.params.arguments || typeof request.params.arguments !== 'object') {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Invalid arguments'
        );
      }

      try {
        switch (request.params.name) {
          case 'read_document': {
            const args = request.params.arguments as Record<string, unknown>;
            if (!args.filename || typeof args.filename !== 'string') {
              throw new McpError(ErrorCode.InvalidRequest, 'Invalid filename');
            }
            const filePath = await this.findFile(args.filename);
            const content = await this.readDocument(filePath);
            return {
              content: [
                {
                  type: 'text',
                  text: content,
                },
              ],
            };
          }

          case 'edit_document': {
            const args = request.params.arguments as Record<string, unknown>;
            if (!args.filename || typeof args.filename !== 'string' || !args.content || typeof args.content !== 'string') {
              throw new McpError(ErrorCode.InvalidRequest, 'Invalid filename or content');
            }
            const filePath = await this.findFile(args.filename);
            const ext = path.extname(filePath).toLowerCase();

            if (ext === '.docx') {
              await fs.writeFile(filePath, args.content);
            } else if (ext === '.xlsx' || ext === '.xls') {
              const worksheet = XLSX.utils.aoa_to_sheet(
                args.content.split('\n').map(line => line.split(','))
              );
              const workbook = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
              XLSX.writeFile(workbook, filePath);
            } else {
              throw new McpError(
                ErrorCode.InvalidRequest,
                `Cannot edit file type: ${ext}`
              );
            }

            return {
              content: [
                {
                  type: 'text',
                  text: 'Document updated successfully',
                },
              ],
            };
          }

          case 'delete_document': {
            const args = request.params.arguments as Record<string, unknown>;
            if (!args.filename || typeof args.filename !== 'string') {
              throw new McpError(ErrorCode.InvalidRequest, 'Invalid filename');
            }
            const filePath = await this.findFile(args.filename);
            await fs.remove(filePath);
            return {
              content: [
                {
                  type: 'text',
                  text: 'Document deleted successfully',
                },
              ],
            };
          }

          case 'email_document': {
            const args = request.params.arguments as Record<string, unknown>;
            if (!args.filename || typeof args.filename !== 'string' ||
                !args.to || typeof args.to !== 'string' ||
                !args.subject || typeof args.subject !== 'string' ||
                !args.body || typeof args.body !== 'string') {
              throw new McpError(ErrorCode.InvalidRequest, 'Invalid email parameters');
            }
            
            const filePath = await this.findFile(args.filename);
            await this.emailTransporter.sendMail({
              from: process.env.SMTP_USER,
              to: args.to,
              subject: args.subject,
              text: args.body,
              attachments: [
                {
                  path: filePath,
                },
              ],
            });

            return {
              content: [
                {
                  type: 'text',
                  text: 'Document emailed successfully',
                },
              ],
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Operation failed: ${(error as Error).message}`
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Document Handler MCP server running on stdio');
  }
}

const server = new DocumentHandler();
server.run().catch(console.error);