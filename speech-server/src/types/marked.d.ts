declare module 'marked' {
  export interface MarkedOptions {
    gfm?: boolean;
    renderer?: Renderer;
    skipCode?: boolean;
    tableStrategy?: 'row-by-row' | 'cell-by-cell' | 'summary';
  }

  export class Renderer {
    constructor(options?: MarkedOptions);
    options: MarkedOptions;
    code(code: string, language: string | undefined, isEscaped: boolean): string;
    table(header: string, body: string): string;
    tablerow(content: string): string;
    tablecell(content: string, flags: { header: boolean; align: 'left' | 'center' | 'right' | null }): string;
    link(href: string, title: string | null, text: string): string;
    image(href: string, title: string | null, text: string): string;
  }

  export function marked(text: string, options?: MarkedOptions): string;
}