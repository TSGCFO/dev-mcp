import * as fs from 'fs/promises';
import * as path from 'path';

interface ParserOptions {
  highlighting?: boolean;
  skipCode?: boolean;
  mathMode?: 'natural' | 'technical' | 'simple';
  tableStrategy?: 'row-by-row' | 'cell-by-cell' | 'summary';
}

export class DocumentParser {

  async parse(filePath: string, options: ParserOptions = {}): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    const content = await fs.readFile(filePath, 'utf-8');

    switch (ext) {
      case '.md':
        return this.parseMarkdown(content, options);
      case '.txt':
        return this.parsePlainText(content, options);
      case '.json':
        return this.parseJson(content, options);
      default:
        return this.parsePlainText(content, options);
    }
  }

  private parseMarkdown(content: string, options: ParserOptions): string {
    // Remove code blocks if skipCode is enabled
    if (options.skipCode) {
      content = content.replace(/```[\s\S]*?```/g, 'Code block skipped.');
      content = content.replace(/`[^`]*`/g, 'Code skipped.');
    }

    // Handle tables based on strategy
    if (options.tableStrategy) {
      content = this.handleTables(content, options.tableStrategy);
    }

    // Handle math equations if mode is specified
    if (options.mathMode) {
      content = this.handleMathEquations(content, options.mathMode);
    }

    // Remove Markdown formatting
    content = content
      // Headers
      .replace(/#{1,6}\s+/g, '')
      // Bold/Italic
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
      // Links
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // Images
      .replace(/!\[([^\]]*)\]\([^\)]+\)/g, 'Image: $1')
      // Horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, 'Section break.')
      // Blockquotes
      .replace(/^>\s+/gm, '')
      // Lists
      .replace(/^[-*+]\s+/gm, '• ')
      .replace(/^\d+\.\s+/gm, '• ');

    return this.cleanupText(content);
  }

  private parsePlainText(content: string, options: ParserOptions): string {
    if (options.mathMode) {
      content = this.handleMathEquations(content, options.mathMode);
    }
    return this.cleanupText(content);
  }

  private parseJson(content: string, options: ParserOptions): string {
    try {
      const parsed = JSON.parse(content);
      return this.jsonToText(parsed);
    } catch {
      return this.parsePlainText(content, options);
    }
  }

  private jsonToText(json: any, level: number = 0): string {
    if (typeof json !== 'object' || json === null) {
      return String(json);
    }

    const indent = '  '.repeat(level);
    const lines: string[] = [];

    if (Array.isArray(json)) {
      json.forEach((item, index) => {
        lines.push(`${indent}Item ${index + 1}: ${this.jsonToText(item, level + 1)}`);
      });
    } else {
      Object.entries(json).forEach(([key, value]) => {
        lines.push(`${indent}${key}: ${this.jsonToText(value, level + 1)}`);
      });
    }

    return lines.join('\n');
  }

  private handleTables(text: string, strategy: string): string {
    const tableRegex = /\|.*\|/g;
    return text.replace(tableRegex, (table) => {
      const rows = table.split('\n')
        .map(row => row.split('|')
        .filter(cell => cell.trim())
        .map(cell => cell.trim()));
      
      switch (strategy) {
        case 'row-by-row':
          return rows.map(row => row.join(', ')).join('\n');
        case 'cell-by-cell':
          return rows.map(row => row.join('. ')).join('\n');
        case 'summary':
          return `Table with ${rows.length} rows and ${rows[0]?.length || 0} columns`;
        default:
          return table;
      }
    });
  }

  private handleMathEquations(text: string, mode: 'natural' | 'technical' | 'simple'): string {
    const mathRegex = /\$\$(.*?)\$\$|\\\[(.*?)\\\]|\$(.*?)\$/g;
    
    return text.replace(mathRegex, (match, equation) => {
      switch (mode) {
        case 'natural':
          return this.mathToNaturalLanguage(equation);
        case 'technical':
          return this.mathToTechnicalLanguage(equation);
        case 'simple':
          return `Mathematical expression: ${equation}`;
        default:
          return equation;
      }
    });
  }

  private mathToNaturalLanguage(equation: string): string {
    return equation
      .replace(/\+/g, ' plus ')
      .replace(/-/g, ' minus ')
      .replace(/\*/g, ' times ')
      .replace(/\//g, ' divided by ')
      .replace(/\^/g, ' to the power of ')
      .replace(/=/g, ' equals ')
      .replace(/\(/g, ' open parenthesis ')
      .replace(/\)/g, ' close parenthesis ');
  }

  private mathToTechnicalLanguage(equation: string): string {
    return equation
      .replace(/\+/g, ' addition ')
      .replace(/-/g, ' subtraction ')
      .replace(/\*/g, ' multiplication ')
      .replace(/\//g, ' division ')
      .replace(/\^/g, ' exponent ')
      .replace(/=/g, ' equals ')
      .replace(/\(/g, ' left parenthesis ')
      .replace(/\)/g, ' right parenthesis ');
  }

  private cleanupText(text: string): string {
    return text
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Remove extra newlines
      .replace(/\n\s*\n/g, '\n')
      // Ensure proper sentence spacing
      .replace(/([.!?])\s*(\w)/g, '$1 $2')
      .trim();
  }
}