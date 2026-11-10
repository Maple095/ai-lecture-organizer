import { jest } from '@jest/globals';
import * as XLSX from 'xlsx';
import AdmZip from 'adm-zip';
import {
  getParserForFile,
  TxtParser,
  MdParser,
  CsvParser,
  XlsxParser,
  DocxParser,
  PptxParser,
  PdfParser,
} from '../src/parsers/index.js';

describe('Step 4: Multi-format Parser Adapter Tests', () => {
  describe('1. Parser Registry & Dispatcher Tests', () => {
    test('getParserForFile should return correct parser instance for each format', () => {
      expect(getParserForFile('.txt')).toBeInstanceOf(TxtParser);
      expect(getParserForFile('.md')).toBeInstanceOf(MdParser);
      expect(getParserForFile('.csv')).toBeInstanceOf(CsvParser);
      expect(getParserForFile('.xlsx')).toBeInstanceOf(XlsxParser);
      expect(getParserForFile('.docx')).toBeInstanceOf(DocxParser);
      expect(getParserForFile('.pptx')).toBeInstanceOf(PptxParser);
      expect(getParserForFile('.pdf')).toBeInstanceOf(PdfParser);
    });

    test('getParserForFile should throw error for unsupported extension', () => {
      expect(() => getParserForFile('.exe')).toThrow('NO_PARSER_AVAILABLE');
      expect(() => getParserForFile('.unknown')).toThrow('NO_PARSER_AVAILABLE');
    });
  });

  describe('2. TxtParser Tests', () => {
    test('should parse text lines and retain line numbers in sourceLocation', async () => {
      const parser = new TxtParser();
      const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      const result = await parser.parse(Buffer.from(content));

      expect(result.parserType).toBe('txt_parser');
      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.sections[0].sourceLocation.type).toBe('txt');
      expect(result.sections[0].sourceLocation.startLine).toBe(1);
      expect(result.sections[0].sourceLocation.endLine).toBe(5);
      expect(result.fullText).toBe(content);
    });
  });

  describe('3. MdParser Tests', () => {
    test('should parse markdown headings and retain headingPath', async () => {
      const parser = new MdParser();
      const content = `# 演算法概論\n這是第一章內容。\n\n## 排序演算法\n氣泡排序與快速排序。`;
      const result = await parser.parse(Buffer.from(content));

      expect(result.parserType).toBe('md_parser');
      expect(result.sections.length).toBeGreaterThanOrEqual(2);

      const sec1 = result.sections[0];
      expect(sec1.sourceLocation.type).toBe('md');
      expect(sec1.sourceLocation.headingPath).toBe('演算法概論');
      expect(sec1.sourceLocation.sectionLevel).toBe(1);

      const sec2 = result.sections[1];
      expect(sec2.sourceLocation.headingPath).toBe('排序演算法');
      expect(sec2.sourceLocation.sectionLevel).toBe(2);
    });
  });

  describe('4. CsvParser Tests', () => {
    test('should parse CSV rows and retain rowIndex', async () => {
      const parser = new CsvParser();
      const content = `學號,姓名,成績\nB10901,小明,95\nB10902,小華,88\nB10903,小美,92`;
      const result = await parser.parse(Buffer.from(content));

      expect(result.parserType).toBe('csv_parser');
      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.sections[0].sourceLocation.type).toBe('csv');
      expect(result.sections[0].sourceLocation.rowIndex).toBe(2);
      expect(result.sections[0].text).toContain('小明');
    });
  });

  describe('5. XlsxParser Tests', () => {
    test('should parse XLSX worksheet rows and retain sheetName & cellRange', async () => {
      const parser = new XlsxParser();
      // 動態建立測試用 XLSX 二進位緩衝區
      const wb = XLSX.utils.book_new();
      const wsData = [
        ['課程代碼', '課程名稱', '學分'],
        ['CS101', '計算機概論', 3],
        ['CS102', '資料結構', 3],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, '資工必修');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const result = await parser.parse(buffer);
      expect(result.parserType).toBe('xlsx_parser');
      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.sections[0].sourceLocation.type).toBe('xlsx');
      expect(result.sections[0].sourceLocation.sheetName).toBe('資工必修');
      expect(result.sections[0].text).toContain('計算機概論');
    });
  });

  describe('6. PptxParser Tests', () => {
    test('should parse PPTX slide XML and retain slideNumber', async () => {
      const parser = new PptxParser();
      // 構建最小結構 PPTX ZIP
      const zip = new AdmZip();
      const mockSlideXml = `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>第一章：雲端架構簡介</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
      zip.addFile('ppt/slides/slide1.xml', Buffer.from(mockSlideXml, 'utf-8'));
      const buffer = zip.toBuffer();

      const result = await parser.parse(buffer);
      expect(result.parserType).toBe('pptx_parser');
      expect(result.sections.length).toBe(1);
      expect(result.sections[0].sourceLocation.type).toBe('pptx');
      expect(result.sections[0].sourceLocation.slideNumber).toBe(1);
      expect(result.sections[0].text).toContain('雲端架構簡介');
    });
  });

  describe('7. PdfParser Tests', () => {
    test('should parse PDF buffer and extract text with pageNumber', async () => {
      const parser = new PdfParser();
      const stream = 'BT /F1 12 Tf 72 712 Td (Cloud Distributed Architecture) Tj ET';
      const pdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>/Contents 4 0 R>>endobj\n4 0 obj<</Length ' + stream.length + '>>stream\n' + stream + '\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000117 00000 n\n0000000280 00000 n\ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n380\n%%EOF';

      const result = await parser.parse(Buffer.from(pdf));
      expect(result.parserType).toBe('pdf_parser');
      expect(result.fullText).toContain('Cloud Distributed Architecture');
      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.sections[0].sourceLocation.type).toBe('pdf');
      expect(result.sections[0].sourceLocation.pageNumber).toBe(1);
    });
  });
});
