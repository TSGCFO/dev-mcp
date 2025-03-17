declare module 'mammoth' {
  interface ConversionOptions {
    buffer?: Buffer;
    path?: string;
    styleMap?: string[];
  }

  interface ConversionResult {
    value: string;
    messages: any[];
  }

  export function extractRawText(options: ConversionOptions): Promise<ConversionResult>;
  export function convertToHtml(options: ConversionOptions): Promise<ConversionResult>;
  export function convertToMarkdown(options: ConversionOptions): Promise<ConversionResult>;
}