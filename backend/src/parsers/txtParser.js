import { BaseParser } from './baseParser.js';

export class TxtParser extends BaseParser {
  constructor() {
    super('txt_parser', '1.0.0');
    this.supportedExtensions = ['.txt'];
    this.supportedMimeTypes = ['text/plain'];
  }

  async parse(buffer, context = {}) {
    const content = buffer.toString('utf-8');
    const lines = content.split(/\r?\n/);
    const sections = [];
    const BATCH_LINES = 20;

    for (let i = 0; i < lines.length; i += BATCH_LINES) {
      const slice = lines.slice(i, i + BATCH_LINES);
      const text = slice.join('\n').trim();
      if (!text) continue;

      const startLine = i + 1;
      const endLine = Math.min(i + BATCH_LINES, lines.length);

      sections.push({
        text,
        sourceLocation: {
          type: 'txt',
          startLine,
          endLine,
          startChar: 0,
          endChar: text.length,
        }
      });
    }

    return {
      parserType: this.parserType,
      parserVersion: this.parserVersion,
      fullText: content,
      sections,
      metadata: {
        totalLines: lines.length,
        charCount: content.length,
      }
    };
  }
}
