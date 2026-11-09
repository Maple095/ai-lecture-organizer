import * as XLSX from 'xlsx';
import { BaseParser } from './baseParser.js';

export class XlsxParser extends BaseParser {
  constructor() {
    super('xlsx_parser', '1.0.0');
    this.supportedExtensions = ['.xlsx', '.xls'];
    this.supportedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
  }

  async parse(buffer, context = {}) {
    // 讀取 workbook
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sections = [];
    const fullTextParts = [];

    const sheetNames = workbook.SheetNames || [];

    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      // 轉換為二維陣列 (保留空列/儲存格)
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      if (!data || data.length === 0) continue;

      const headers = data[0] || [];
      const BATCH_ROWS = 10;

      for (let r = 1; r < data.length; r += BATCH_ROWS) {
        const slice = data.slice(r, r + BATCH_ROWS);
        const rowTexts = slice.map((row, idx) => {
          const rowNum = r + idx + 1;
          const cellStr = row.map((cell, cIdx) => {
            const colHeader = headers[cIdx] ? `[${headers[cIdx]}]` : `[C${cIdx + 1}]`;
            return `${colHeader} ${cell}`;
          }).filter(c => c.trim().length > 0).join(' | ');

          return `【${sheetName}】第 ${rowNum} 列: ${cellStr}`;
        }).filter(t => t.length > 0);

        if (rowTexts.length === 0) continue;

        const sectionText = rowTexts.join('\n');
        fullTextParts.push(sectionText);

        sections.push({
          text: sectionText,
          sourceLocation: {
            type: 'xlsx',
            sheetName,
            rowIndex: r + 1,
            cellRange: `A${r + 1}:Z${Math.min(r + BATCH_ROWS, data.length)}`,
            columnName: String(headers[0] || 'A'),
          }
        });
      }
    }

    return {
      parserType: this.parserType,
      parserVersion: this.parserVersion,
      fullText: fullTextParts.join('\n\n'),
      sections,
      metadata: {
        sheetCount: sheetNames.length,
        sheetNames,
      }
    };
  }
}
