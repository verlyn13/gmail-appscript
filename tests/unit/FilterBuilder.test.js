import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock FilterBuilder class
class FilterBuilder {
  constructor() {
    this.criteria = {};
    this.actions = {};
  }

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

  archive() {
    this.actions.shouldArchive = true;
    return this;
  }

  build() {
    return {
      criteria: this.criteria,
      action: this.actions
    };
  }

  toQueryString() {
    const parts = [];
    
    if (this.criteria.from) parts.push(`from:(${this.criteria.from})`);
    if (this.criteria.to) parts.push(`to:(${this.criteria.to})`);
    if (this.criteria.subject) parts.push(`subject:(${this.criteria.subject})`);
    if (this.criteria.query) parts.push(this.criteria.query);
    if (this.criteria.negatedQuery) parts.push(`-(${this.criteria.negatedQuery})`);
    if (this.criteria.hasAttachment) parts.push('has:attachment');
    
    return parts.join(' ');
  }
}

describe('FilterBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new FilterBuilder();
  });

  describe('criteria methods', () => {
    it('should set from criteria', () => {
      builder.from('test@example.com');
      expect(builder.criteria.from).toBe('test@example.com');
    });

    it('should set to criteria', () => {
      builder.to('recipient@example.com');
      expect(builder.criteria.to).toBe('recipient@example.com');
    });

    it('should set subject criteria', () => {
      builder.subject('Important');
      expect(builder.criteria.subject).toBe('Important');
    });

    it('should set hasWords criteria', () => {
      builder.hasWords('invoice payment');
      expect(builder.criteria.query).toBe('invoice payment');
    });

    it('should set doesNotHaveWords criteria', () => {
      builder.doesNotHaveWords('spam promotion');
      expect(builder.criteria.negatedQuery).toBe('spam promotion');
    });

    it('should set hasAttachment criteria', () => {
      builder.hasAttachment();
      expect(builder.criteria.hasAttachment).toBe(true);
    });
  });

  describe('action methods', () => {
    it('should add labels', () => {
      builder.addLabel('Work').addLabel('Important');
      expect(builder.actions.add).toEqual(['Work', 'Important']);
    });

    it('should remove labels', () => {
      builder.removeLabel('Inbox').removeLabel('Unread');
      expect(builder.actions.remove).toEqual(['Inbox', 'Unread']);
    });

    it('should mark as read', () => {
      builder.markAsRead();
      expect(builder.actions.shouldMarkAsRead).toBe(true);
    });

    it('should archive', () => {
      builder.archive();
      expect(builder.actions.shouldArchive).toBe(true);
    });
  });

  describe('chaining', () => {
    it('should support method chaining', () => {
      const result = builder
        .from('sender@example.com')
        .to('me@example.com')
        .subject('Invoice')
        .hasAttachment()
        .addLabel('Invoices')
        .markAsRead()
        .archive();

      expect(result).toBe(builder);
      expect(builder.criteria.from).toBe('sender@example.com');
      expect(builder.criteria.to).toBe('me@example.com');
      expect(builder.criteria.subject).toBe('Invoice');
      expect(builder.criteria.hasAttachment).toBe(true);
      expect(builder.actions.add).toContain('Invoices');
      expect(builder.actions.shouldMarkAsRead).toBe(true);
      expect(builder.actions.shouldArchive).toBe(true);
    });
  });

  describe('build', () => {
    it('should build filter object', () => {
      const filter = builder
        .from('test@example.com')
        .addLabel('Test')
        .markAsRead()
        .build();

      expect(filter).toEqual({
        criteria: {
          from: 'test@example.com'
        },
        action: {
          add: ['Test'],
          shouldMarkAsRead: true
        }
      });
    });
  });

  describe('toQueryString', () => {
    it('should generate Gmail search query', () => {
      const query = builder
        .from('sender@example.com')
        .to('me@example.com')
        .subject('Important')
        .hasWords('project deadline')
        .doesNotHaveWords('spam')
        .hasAttachment()
        .toQueryString();

      expect(query).toBe(
        'from:(sender@example.com) to:(me@example.com) subject:(Important) project deadline -(spam) has:attachment'
      );
    });

    it('should handle partial criteria', () => {
      const query = builder
        .from('test@example.com')
        .hasAttachment()
        .toQueryString();

      expect(query).toBe('from:(test@example.com) has:attachment');
    });

    it('should return empty string for no criteria', () => {
      const query = builder.toQueryString();
      expect(query).toBe('');
    });
  });
});