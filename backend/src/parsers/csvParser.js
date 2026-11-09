import { parse as parseCsvSync } from 'csv-parse/sync';
import { BaseParser } from './baseParser.js';

export class CsvParser extends BaseParser {
  constructor() {
    super('csv_parser', '1.0.0');
    this.supportedExtensions = ['.csv'];
    this.supportedMimeTypes = ['text/csv'];
  }

  async parse(buffer, context = {}) {
    const content = buffer.toString('utf-8');
    
    // 使用 RFC 4180 標準解析器
    const records = parseCsvSync(content, {
      skip_empty_lines: true,
      relax_column_count: true,
    });

    if (!records || records.length === 0) {
      return {
        parserType: this.parserType,
        parserVersion: this.parserVersion,
        fullText: '',
        sections: [],
        metadata: { totalRows: 0 }
      };
    }

    const headers = records[0];
    const sections = [];
    const fullTextLines = [];

    // 將每 5~10 列打包成一個 section，避免單格過小
    const BATCH_ROWS = 5;
    for (let i = 1; i < records.length; i += BATCH_ROWS) {
      const batch = records.slice(i, i + BATCH_ROWS);
      const rowTexts = batch.map((row, idx) => {
        const rowNum = i + idx + 1;
        const colPairs = row.map((val, colIdx) => {
          const colName = headers[colIdx] || `Col${colIdx + 1}`;
          return `${colName}: ${val}`;
        }).join(', ');
        return `[列 ${rowNum}] ${colPairs}`;
      });

      const sectionText = rowTexts.join('\n');
      fullTextLines.push(sectionText);

      sections.push({
        text: sectionText,
        sourceLocation: {
          type: 'csv',
          rowIndex: i + 1,
          columnName: headers[0] || '欄位1',
          columnIndex: 0,
        }
      });
    }

    return {
      parserType: this.parserType,
      parserVersion: this.parserVersion,
      fullText: fullTextLines.join('\n\n'),
      sections,
      metadata: {
        totalRows: records.length,
        columnCount: headers.length,
      }
    };
  }
}
