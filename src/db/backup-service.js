/**
 * BackupService — Create, validate, and inspect database backups.
 *
 * Uses sql.js db.export() to produce a raw SQLite binary snapshot.
 * Validation checks SQLite magic bytes before any restore attempt.
 */
class BackupService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Export the current database as a Node Buffer.
   * @returns {Buffer} Raw SQLite database bytes.
   */
  createBackup() {
    const data = this.db.export();
    return Buffer.from(data);
  }

  /**
   * Validate that a buffer contains a legitimate SQLite database.
   * @param {Buffer} buffer - The backup data to validate.
   * @throws {Error} If the buffer is empty or lacks the SQLite header.
   */
  validateBackup(buffer) {
    if (!buffer || buffer.length === 0) {
      throw new Error('Backup is empty');
    }
    // SQLite magic bytes: "SQLite format 3\0"
    const magic = 'SQLite format 3';
    const header = buffer.slice(0, 15).toString('ascii');
    if (header !== magic) {
      throw new Error('Invalid backup: not a valid SQLite database');
    }
  }

  /**
   * Return size and timestamp metadata for a backup buffer.
   * @param {Buffer} buffer - The backup data.
   * @returns {{ sizeBytes: number, sizeFormatted: string, timestamp: string }}
   */
  getBackupMetadata(buffer) {
    return {
      sizeBytes: buffer.length,
      sizeFormatted: this._formatSize(buffer.length),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Human-readable file-size string.
   * @private
   */
  _formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}

module.exports = { BackupService };
