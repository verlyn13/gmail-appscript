/**
 * Filter builder for creating complex Gmail filters programmatically
 */

class FilterBuilder {
  constructor() {
    this.criteria = {};
    this.actions = {};
  }

  // Criteria methods
  from(email) {
    this.criteria.from = email;
    return this;
  }

  to(email) {
    this.criteria.to = email;
    return this;
  }

  subject(text) {
    this.criteria.subject = text;
    return this;
  }

  hasWords(words) {
    this.criteria.query = words;
    return this;
  }

  doesNotHaveWords(words) {
    this.criteria.negatedQuery = words;
    return this;
  }

  hasAttachment() {
    this.criteria.hasAttachment = true;
    return this;
  }

  excludeChats() {
    this.criteria.excludeChats = true;
    return this;
  }

  size(bytes) {
    this.criteria.size = bytes;
    return this;
  }

  sizeComparison(comparison) {
    this.criteria.sizeComparison = comparison; // 'larger' or 'smaller'
    return this;
  }

  // Action methods
  addLabel(labelName) {
    if (!this.actions.add) this.actions.add = [];
    this.actions.add.push(labelName);
    return this;
  }

  removeLabel(labelName) {
    if (!this.actions.remove) this.actions.remove = [];
    this.actions.remove.push(labelName);
    return this;
  }

  markAsRead() {
    this.actions.shouldMarkAsRead = true;
    return this;
  }

  markAsImportant() {
    this.actions.shouldAlwaysMarkAsImportant = true;
    return this;
  }

  neverMarkAsImportant() {
    this.actions.shouldNeverMarkAsImportant = true;
    return this;
  }

  archive() {
    this.actions.shouldArchive = true;
    return this;
  }

  deleteIt() {
    this.actions.shouldTrash = true;
    return this;
  }

  neverSpam() {
    this.actions.shouldNeverSpam = true;
    return this;
  }

  star() {
    this.actions.shouldStar = true;
    return this;
  }

  forward(email) {
    this.actions.forward = email;
    return this;
  }

  // Build and apply filter
  build() {
    return {
      criteria: this.criteria,
      action: this.actions
    };
  }

  /**
   * Create the filter in Gmail
   * Note: This requires Gmail API advanced service
   */
  create() {
    const filter = this.build();
    
    try {
      // This requires enabling Gmail API in Apps Script
      const result = Gmail.Users.Settings.Filters.create(filter, 'me');
      return result;
    } catch (e) {
      console.error('Error creating filter:', e);
      throw e;
    }
  }

  /**
   * Generate a query string from criteria
   */
  toQueryString() {
    const parts = [];
    
    if (this.criteria.from) parts.push(`from:(${this.criteria.from})`);
    if (this.criteria.to) parts.push(`to:(${this.criteria.to})`);
    if (this.criteria.subject) parts.push(`subject:(${this.criteria.subject})`);
    if (this.criteria.query) parts.push(this.criteria.query);
    if (this.criteria.negatedQuery) parts.push(`-(${this.criteria.negatedQuery})`);
    if (this.criteria.hasAttachment) parts.push('has:attachment');
    if (this.criteria.excludeChats) parts.push('-in:chats');
    
    if (this.criteria.size && this.criteria.sizeComparison) {
      const comparison = this.criteria.sizeComparison === 'larger' ? 'larger:' : 'smaller:';
      parts.push(`${comparison}${this.criteria.size}`);
    }
    
    return parts.join(' ');
  }
}

// Factory function for easier use
function createFilter() {
  return new FilterBuilder();
}

if (typeof module !== 'undefined') {
  module.exports = { FilterBuilder, createFilter };
}