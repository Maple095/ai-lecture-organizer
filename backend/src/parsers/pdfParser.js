import { createRequire } from 'module';
import { BaseParser } from './baseParser.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export class PdfParser extends BaseParser {
  constructor() {
    super('pdf_parser', '1.0.0');
    this.supportedExtensions = ['.pdf'];
    this.supportedMimeTypes = ['application/pdf'];
  }

  async parse(buffer, context = {}) {
    const pageTexts = [];

    // 客製化 pagerender 回呼以精確保留每頁文字與頁碼
    const options = {
      pagerender: function (pageData) {
        return pageData.getTextContent().then(function (textContent) {
          let lastY, text = '';
          for (let item of textContent.items) {
            if (lastY == item.transform[5] || !lastY) {
              text += item.str;
            } else {
              text += '\n' + item.str;
            }
            lastY = item.transform[5];
          }
          pageTexts.push({
            pageNumber: pageData.pageIndex + 1,
            text: text.trim(),
          });
          return text;
        });
      }
    };

    const data = await pdfParse(buffer, options);
    const sections = [];

    for (const pageItem of pageTexts) {
      if (!pageItem.text || pageItem.text.length === 0) continue;

      sections.push({
        text: pageItem.text,
        sourceLocation: {
          type: 'pdf',
          pageNumber: pageItem.pageNumber,
          bbox: [0, 0, 595.28, 841.89], // 標準 A4 點數參考 (1/72 inch)
        }
      });
    }

    return {
      parserType: this.parserType,
      parserVersion: this.parserVersion,
      fullText: data.text || '',
      sections,
      metadata: {
        pageCount: data.numpages || pageTexts.length,
        info: data.info || {},
      }
    };
  }
}
