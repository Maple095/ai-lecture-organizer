import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/index.js';

export class LocalStorageAdapter {
  constructor(baseDir) {
    this.baseDir = path.resolve(baseDir);
  }

  /**
   * 確保路徑安全且不發生路徑穿越 (Path Traversal 防禦)
   * @param {string} relativePath
   * @returns {string}
   */
  resolveSafePath(relativePath) {
    const safePath = path.resolve(this.baseDir, relativePath);
    if (!safePath.startsWith(this.baseDir)) {
      throw new Error('SECURITY_ERROR: Path traversal detected');
    }
    return safePath;
  }

  /**
   * 儲存檔案並計算 SHA-256 雜湊
   * @param {string} relativePath - 例如 users/{userId}/{docId}/{uuid}.ext
   * @param {Buffer|NodeJS.ReadableStream} content
   * @returns {Promise<{ storagePath: string, checksum: string, size: number }>}
   */
  async saveFile(relativePath, content) {
    const fullPath = this.resolveSafePath(relativePath);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });

    if (Buffer.isBuffer(content)) {
      await fs.promises.writeFile(fullPath, content);
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      return {
        storagePath: relativePath,
        checksum: hash,
        size: content.length,
      };
    } else {
      // 串流寫入並同步計算 SHA-256
      return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        let size = 0;
        const writeStream = fs.createWriteStream(fullPath);

        content.on('data', (chunk) => {
          hash.update(chunk);
          size += chunk.length;
        });

        content.on('error', reject);
        writeStream.on('error', reject);

        writeStream.on('finish', () => {
          resolve({
            storagePath: relativePath,
            checksum: hash.digest('hex'),
            size,
          });
        });

        content.pipe(writeStream);
      });
    }
  }

  /**
   * 取得檔案讀取串流
   * @param {string} relativePath
   * @param {Object} [options] - fs.createReadStream 選項 (如 { start, end })
   * @returns {fs.ReadStream}
   */
  getFileStream(relativePath, options = {}) {
    const fullPath = this.resolveSafePath(relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error('FILE_NOT_FOUND: Physical file does not exist on disk');
    }
    return fs.createReadStream(fullPath, options);
  }

  /**
   * 取得檔案實體狀態 (大小等)
   * @param {string} relativePath
   * @returns {Promise<fs.Stats>}
   */
  async getFileStats(relativePath) {
    const fullPath = this.resolveSafePath(relativePath);
    return await fs.promises.stat(fullPath);
  }

  /**
   * 刪除實體檔案
   * @param {string} relativePath
   * @returns {Promise<boolean>}
   */
  async deleteFile(relativePath) {
    try {
      const fullPath = this.resolveSafePath(relativePath);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        return true;
      }
      return false;
    } catch (err) {
      console.error(`[StorageAdapter Error] Failed to delete file ${relativePath}:`, err.message);
      return false;
    }
  }

  /**
   * 檢查檔案是否存在
   * @param {string} relativePath
   * @returns {boolean}
   */
  fileExists(relativePath) {
    try {
      const fullPath = this.resolveSafePath(relativePath);
      return fs.existsSync(fullPath);
    } catch {
      return false;
    }
  }
}

// 根據 config 導出單例適配器實例
export const storageAdapter = new LocalStorageAdapter(config.storage.localDir);
