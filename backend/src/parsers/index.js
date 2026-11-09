import { TxtParser } from './txtParser.js';
import { MdParser } from './mdParser.js';
import { CsvParser } from './csvParser.js';
import { XlsxParser } from './xlsxParser.js';
import { DocxParser } from './docxParser.js';
import { PptxParser } from './pptxParser.js';
import { PdfParser } from './pdfParser.js';

// 初始化並註冊各格式 Parser 實例
const parsers = [
  new TxtParser(),
  new MdParser(),
  new CsvParser(),
  new XlsxParser(),
  new DocxParser(),
  new PptxParser(),
  new PdfParser(),
];

/**
 * 依據副檔名與 MIME 取得最適配之 Parser
 * @param {string} ext - 例如 .pdf, .docx, .csv
 * @param {string} [mimeType='']
 * @returns {BaseParser}
 */
export function getParserForFile(ext, mimeType = '') {
  const cleanExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  const found = parsers.find(p => p.canParse(cleanExt, mimeType));
  if (!found) {
    throw new Error(`NO_PARSER_AVAILABLE: 無法解析格式「${cleanExt}」，請確認是否支援`);
  }
  return found;
}

export {
  TxtParser,
  MdParser,
  CsvParser,
  XlsxParser,
  DocxParser,
  PptxParser,
  PdfParser,
};
