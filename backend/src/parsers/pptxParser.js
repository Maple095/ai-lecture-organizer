import AdmZip from 'adm-zip';
import { BaseParser } from './baseParser.js';

export class PptxParser extends BaseParser {
  constructor() {
    super('pptx_parser', '1.0.0');
    this.supportedExtensions = ['.pptx'];
    this.supportedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];
  }

  async parse(buffer, context = {}) {
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    const sections = [];
    const fullTextParts = [];

    // 找出所有 slide{N}.xml 投影片條目並排序
    const slideEntries = zipEntries
      .filter(entry => entry.entryName.startsWith('ppt/slides/slide') && entry.entryName.endsWith('.xml'))
      .sort((a, b) => {
        const numA = parseInt(a.entryName.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.entryName.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });

    for (let i = 0; i < slideEntries.length; i++) {
      const entry = slideEntries[i];
      const xmlContent = zip.readAsText(entry);
      const slideNumber = i + 1;

      // 提取 <a:t> 標籤內的文字 (PowerPoint 投影片文字內容)
      const textMatches = xmlContent.match(/<a:t[^>]*>(.*?)<\/a:t>/g) || [];
      const texts = textMatches
        .map(t => t.replace(/<[^>]+>/g, '').trim())
        .filter(t => t.length > 0);

      if (texts.length === 0) continue;

      const slideTitle = texts[0] || `投影片 ${slideNumber}`;
      const slideBody = texts.join(' ');
      const sectionText = `【投影片 ${slideNumber}：${slideTitle}】\n${slideBody}`;

      fullTextParts.push(sectionText);
      sections.push({
        text: sectionText,
        sourceLocation: {
          type: 'pptx',
          slideNumber,
          shapeIndex: 0,
          slideTitle,
        }
      });
    }

    return {
      parserType: this.parserType,
      parserVersion: this.parserVersion,
      fullText: fullTextParts.join('\n\n'),
      sections,
      metadata: {
        slideCount: slideEntries.length,
      }
    };
  }
}
