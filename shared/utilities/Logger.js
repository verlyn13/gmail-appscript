/**
 * Enhanced logging utility for AppScript projects
 * Supports multiple log levels and destinations
 */

class Logger {
  constructor(config = {}) {
    this.config = {
      level: config.level || 'INFO',
      prefix: config.prefix || '',
      logToSheet: config.logToSheet || false,
      sheetId: config.sheetId || null,
      logToEmail: config.logToEmail || false,
      emailRecipient: config.emailRecipient || null,
      bufferSize: config.bufferSize || 100
    };
    
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3,
      TRACE: 4
    };
    
    this.buffer = [];
  }

  _shouldLog(level) {
    return this.levels[level] <= this.levels[this.config.level];
  }

  _formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    const prefix = this.config.prefix ? `[${this.config.prefix}]` : '';
    const dataStr = data ? JSON.stringify(data) : '';
    
    return `${timestamp} ${prefix}[${level}] ${message} ${dataStr}`.trim();
  }

  _write(level, message, data) {
    if (!this._shouldLog(level)) return;
    
    const formatted = this._formatMessage(level, message, data);
    
    // Console log
    console.log(formatted);
    
    // Buffer for batch operations
    this.buffer.push({
      timestamp: new Date(),
      level,
      message,
      data,
      formatted
    });
    
    // Flush if buffer is full
    if (this.buffer.length >= this.config.bufferSize) {
      this.flush();
    }
    
    // Log to sheet if configured
    if (this.config.logToSheet && this.config.sheetId) {
      this._logToSheet(formatted);
    }
  }

  _logToSheet(message) {
    try {
      const sheet = SpreadsheetApp.openById(this.config.sheetId);
      const logSheet = sheet.getSheetByName('Logs') || sheet.insertSheet('Logs');
      logSheet.appendRow([new Date(), message]);
    } catch (e) {
      console.error('Failed to log to sheet:', e);
    }
  }

  error(message, data) {
    this._write('ERROR', message, data);
  }

  warn(message, data) {
    this._write('WARN', message, data);
  }

  info(message, data) {
    this._write('INFO', message, data);
  }

  debug(message, data) {
    this._write('DEBUG', message, data);
  }

  trace(message, data) {
    this._write('TRACE', message, data);
  }

  /**
   * Flush buffer to persistent storage or email
   */
  flush() {
    if (this.buffer.length === 0) return;
    
    if (this.config.logToEmail && this.config.emailRecipient) {
      this._sendLogEmail();
    }
    
    // Clear buffer
    this.buffer = [];
  }

  _sendLogEmail() {
    const subject = `${this.config.prefix} Log Report - ${new Date().toLocaleDateString()}`;
    const body = this.buffer.map(entry => entry.formatted).join('\n');
    
    try {
      GmailApp.sendEmail(this.config.emailRecipient, subject, body);
    } catch (e) {
      console.error('Failed to send log email:', e);
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(prefix) {
    return new Logger({
      ...this.config,
      prefix: this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix
    });
  }
}

// Singleton instance for global logging
const globalLogger = new Logger();

if (typeof module !== 'undefined') {
  module.exports = { Logger, globalLogger };
}