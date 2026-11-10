import { createRequire } from 'module';
import { BaseParser } from './baseParser.js';

const require = createRequire(import.meta.url);
const rawPdfParse = require('pdf-parse');

export class PdfParser extends BaseParser {
  constructor() {
    super('pdf_parser', '1.0.0');
    this.supportedExtensions = ['.pdf'];
    this.supportedMimeTypes = ['application/pdf'];
  }

  async parse(buffer, context = {}) {
    const sections = [];
    let fullText = '';
    let pageCount = 0;
    let metadataInfo = {};

    // 判斷 pdf-parse 模組匯出型態（相容 v1 函式模式與 v2 PDFParse 類別模式）
    const isV1Func = typeof rawPdfParse === 'function'
      ? rawPdfParse
      : (typeof rawPdfParse.default === 'function' ? rawPdfParse.default : null);

    if (isV1Func) {
      // ===== v1 經典函式架構 =====
      const pageTexts = [];
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

      const data = await isV1Func(buffer, options);
      fullText = data.text || '';
      pageCount = data.numpages || pageTexts.length;
      metadataInfo = data.info || {};

      for (const item of pageTexts) {
        if (!item.text || item.text.length === 0) continue;
        sections.push({
          text: item.text,
          sourceLocation: {
            type: 'pdf',
            pageNumber: item.pageNumber,
            bbox: [0, 0, 595.28, 841.89], // 標準 A4 點數參考 (1/72 inch)
          }
        });
      }
    } else if (rawPdfParse && typeof rawPdfParse.PDFParse === 'function') {
      // ===== v2 物件導向架構 =====
      const parserInstance = new rawPdfParse.PDFParse({ data: buffer });
      try {
        const textData = await parserInstance.getText();
        const infoData = await parserInstance.getInfo().catch(() => ({}));

        fullText = textData.text || '';
        pageCount = textData.total || (textData.pages ? textData.pages.length : 1);
        metadataInfo = infoData.info || {};

        if (Array.isArray(textData.pages)) {
          for (const p of textData.pages) {
            const pageText = (p.text || '').trim();
            if (!pageText) continue;
            sections.push({
              text: pageText,
              sourceLocation: {
                type: 'pdf',
                pageNumber: p.num || 1,
                bbox: [0, 0, 595.28, 841.89],
              }
            });
          }
        }
      } finally {
        await parserInstance.destroy().catch(() => {});
      }
    } else {
      throw new Error('PDF_PARSER_ERROR: Unsupported or unresolvable pdf-parse export structure');
    }

    // 若未依頁面切分出 section 但存在 fullText，兜底為第 1 頁 section
    if (sections.length === 0 && fullText.trim().length > 0) {
      sections.push({
        text: fullText.trim(),
        sourceLocation: {
          type: 'pdf',
          pageNumber: 1,
          bbox: [0, 0, 595.28, 841.89],
        }
      });
    }

    return {
      parserType: this.parserType,
      parserVersion: this.parserVersion,
      fullText,
      sections,
      metadata: {
        pageCount,
        info: metadataInfo,
      }
    };
  }
}
