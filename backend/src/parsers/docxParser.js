import mammoth from 'mammoth';
import { BaseParser } from './baseParser.js';

export class DocxParser extends BaseParser {
  constructor() {
    super('docx_parser', '1.0.0');
    this.supportedExtensions = ['.docx'];
    this.supportedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
  }

  async parse(buffer, context = {}) {
    const result = await mammoth.extractRawText({ buffer });
    const fullText = result.value || '';
    const paragraphs = fullText.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);

    const sections = [];
    const BATCH_PARAGRAPHS = 3;

    for (let i = 0; i < paragraphs.length; i += BATCH_PARAGRAPHS) {
      const slice = paragraphs.slice(i, i + BATCH_PARAGRAPHS);
      const text = slice.join('\n\n');

      sections.push({
        text,
        sourceLocation: {
          type: 'docx',
          paragraphIndex: i,
          headingPath: `段落 ${i + 1} ~ ${Math.min(i + BATCH_PARAGRAPHS, paragraphs.length)}`,
        }
      });
    }

    return {
      parserType: this.parserType,
      parserVersion: this.parserVersion,
      fullText,
      sections,
      metadata: {
        paragraphCount: paragraphs.length,
        messages: result.messages,
      }
    };
  }
}
