import { BaseParser } from './baseParser.js';

export class MdParser extends BaseParser {
  constructor() {
    super('md_parser', '1.0.0');
    this.supportedExtensions = ['.md', '.markdown'];
    this.supportedMimeTypes = ['text/markdown'];
  }

  async parse(buffer, context = {}) {
    const content = buffer.toString('utf-8');
    const lines = content.split(/\r?\n/);
    const sections = [];

    let currentHeading = '章節內容';
    let currentLevel = 1;
    let currentLines = [];
    let startLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);

      if (headingMatch) {
        if (currentLines.length > 0) {
          const text = currentLines.join('\n').trim();
          if (text) {
            sections.push({
              text,
              sourceLocation: {
                type: 'md',
                startLine,
                endLine: i,
                headingPath: currentHeading,
                sectionLevel: currentLevel,
              }
            });
          }
          currentLines = [];
        }

        currentLevel = headingMatch[1].length;
        currentHeading = headingMatch[2].trim();
        startLine = i + 1;
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      const text = currentLines.join('\n').trim();
      if (text) {
        sections.push({
          text,
          sourceLocation: {
            type: 'md',
            startLine,
            endLine: lines.length,
            headingPath: currentHeading,
            sectionLevel: currentLevel,
          }
        });
      }
    }

    return {
      parserType: this.parserType,
      parserVersion: this.parserVersion,
      fullText: content,
      sections,
      metadata: {
        totalLines: lines.length,
        headingsCount: sections.length,
      }
    };
  }
}
