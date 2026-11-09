/**
 * 所有特定格式 Parser 的抽象基底類別
 */
export class BaseParser {
  constructor(parserType, parserVersion = '1.0.0') {
    this.parserType = parserType;
    this.parserVersion = parserVersion;
    this.supportedExtensions = [];
    this.supportedMimeTypes = [];
  }

  /**
   * 檢查是否能處理該格式
   * @param {string} ext
   * @param {string} [mimeType]
   * @returns {boolean}
   */
  canParse(ext, mimeType = '') {
    const cleanExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
    return this.supportedExtensions.includes(cleanExt) || this.supportedMimeTypes.includes(mimeType);
  }

  /**
   * 核心解析方法 (子類別必須實作)
   * @param {Buffer} buffer - 檔案二進位內容
   * @param {Object} [context] - 上下文 (如 filename, documentId)
   * @returns {Promise<{ parserType: string, parserVersion: string, fullText: string, sections: Array<{ text: string, sourceLocation: Object }>, metadata: Object }>}
   */
  async parse(buffer, context = {}) {
    throw new Error(`parse() must be implemented by ${this.constructor.name}`);
  }
}
