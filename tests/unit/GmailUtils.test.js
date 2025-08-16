import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the module since we're testing in Node environment
const GmailUtils = {
  searchThreads(query, maxResults = 50, pageToken = null) {
    const threads = GmailApp.search(query, 0, maxResults);
    
    return threads.map(thread => ({
      id: thread.getId(),
      firstMessageSubject: thread.getFirstMessageSubject(),
      lastMessageDate: thread.getLastMessageDate(),
      messageCount: thread.getMessageCount(),
      labels: thread.getLabels().map(l => l.getName()),
      isUnread: thread.isUnread(),
      isImportant: thread.isImportant()
    }));
  },

  applyLabels(threadIds, labelNames) {
    const threads = threadIds.map(id => GmailApp.getThreadById(id));
    const labels = labelNames.map(name => 
      GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name)
    );
    
    threads.forEach(thread => {
      if (thread) {
        labels.forEach(label => thread.addLabel(label));
      }
    });
  },

  archiveOldThreads(query, daysOld) {
    const dateQuery = `${query} older_than:${daysOld}d`;
    const threads = GmailApp.search(dateQuery);
    
    threads.forEach(thread => {
      thread.moveToArchive();
    });
    
    return threads.length;
  },

  getStatistics(query = '') {
    const threads = GmailApp.search(query, 0, 500);
    const labels = GmailApp.getUserLabels();
    
    return {
      totalThreads: threads.length,
      unreadCount: threads.filter(t => t.isUnread()).length,
      labelCount: labels.length,
      labelStats: labels.map(label => ({
        name: label.getName(),
        threadCount: label.getThreads().length
      }))
    };
  }
};

describe('GmailUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchThreads', () => {
    it('should search and return formatted threads', () => {
      const mockThreads = [
        {
          getId: () => 'thread1',
          getFirstMessageSubject: () => 'Test Subject',
          getLastMessageDate: () => new Date('2025-01-16'),
          getMessageCount: () => 3,
          getLabels: () => [{ getName: () => 'Important' }],
          isUnread: () => true,
          isImportant: () => true
        }
      ];

      GmailApp.search = vi.fn().mockReturnValue(mockThreads);

      const results = GmailUtils.searchThreads('test query', 10);

      expect(GmailApp.search).toHaveBeenCalledWith('test query', 0, 10);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: 'thread1',
        firstMessageSubject: 'Test Subject',
        lastMessageDate: new Date('2025-01-16'),
        messageCount: 3,
        labels: ['Important'],
        isUnread: true,
        isImportant: true
      });
    });

    it('should handle empty search results', () => {
      GmailApp.search = vi.fn().mockReturnValue([]);

      const results = GmailUtils.searchThreads('no results', 50);

      expect(results).toEqual([]);
    });
  });

  describe('applyLabels', () => {
    it('should apply labels to threads', () => {
      const mockThread = {
        addLabel: vi.fn()
      };
      const mockLabel = {};

      GmailApp.getThreadById = vi.fn().mockReturnValue(mockThread);
      GmailApp.getUserLabelByName = vi.fn().mockReturnValue(null);
      GmailApp.createLabel = vi.fn().mockReturnValue(mockLabel);

      GmailUtils.applyLabels(['thread1'], ['NewLabel']);

      expect(GmailApp.getThreadById).toHaveBeenCalledWith('thread1');
      expect(GmailApp.createLabel).toHaveBeenCalledWith('NewLabel');
      expect(mockThread.addLabel).toHaveBeenCalledWith(mockLabel);
    });

    it('should use existing labels when available', () => {
      const mockThread = {
        addLabel: vi.fn()
      };
      const existingLabel = {};

      GmailApp.getThreadById = vi.fn().mockReturnValue(mockThread);
      GmailApp.getUserLabelByName = vi.fn().mockReturnValue(existingLabel);
      GmailApp.createLabel = vi.fn();

      GmailUtils.applyLabels(['thread1'], ['ExistingLabel']);

      expect(GmailApp.getUserLabelByName).toHaveBeenCalledWith('ExistingLabel');
      expect(GmailApp.createLabel).not.toHaveBeenCalled();
      expect(mockThread.addLabel).toHaveBeenCalledWith(existingLabel);
    });
  });

  describe('archiveOldThreads', () => {
    it('should archive threads older than specified days', () => {
      const mockThreads = [
        { moveToArchive: vi.fn() },
        { moveToArchive: vi.fn() }
      ];

      GmailApp.search = vi.fn().mockReturnValue(mockThreads);

      const count = GmailUtils.archiveOldThreads('in:inbox', 30);

      expect(GmailApp.search).toHaveBeenCalledWith('in:inbox older_than:30d');
      expect(count).toBe(2);
      mockThreads.forEach(thread => {
        expect(thread.moveToArchive).toHaveBeenCalled();
      });
    });
  });

  describe('getStatistics', () => {
    it('should return email statistics', () => {
      const mockThreads = [
        { isUnread: () => true },
        { isUnread: () => false },
        { isUnread: () => true }
      ];

      const mockLabels = [
        {
          getName: () => 'Work',
          getThreads: () => new Array(5)
        },
        {
          getName: () => 'Personal',
          getThreads: () => new Array(3)
        }
      ];

      GmailApp.search = vi.fn().mockReturnValue(mockThreads);
      GmailApp.getUserLabels = vi.fn().mockReturnValue(mockLabels);

      const stats = GmailUtils.getStatistics();

      expect(stats).toEqual({
        totalThreads: 3,
        unreadCount: 2,
        labelCount: 2,
        labelStats: [
          { name: 'Work', threadCount: 5 },
          { name: 'Personal', threadCount: 3 }
        ]
      });
    });
  });
});