/**
 * Shared Gmail utility functions
 * Used across all account scripts
 */

const GmailUtils = {
  /**
   * Get threads matching a query with pagination
   * @param {string} query - Gmail search query
   * @param {number} maxResults - Maximum results to return
   * @param {string} pageToken - Token for pagination
   */
  searchThreads(query, maxResults = 50, pageToken = null) {
    const threads = pageToken 
      ? GmailApp.search(query, 0, maxResults)
      : GmailApp.search(query, 0, maxResults);
    
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

  /**
   * Apply labels to messages/threads
   * @param {string[]} threadIds - Array of thread IDs
   * @param {string[]} labelNames - Labels to apply
   */
  applyLabels(threadIds, labelNames) {
    const threads = threadIds.map(id => GmailApp.getThreadById(id));
    const labels = labelNames.map(name => 
      GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name)
    );
    
    threads.forEach(thread => {
      labels.forEach(label => thread.addLabel(label));
    });
  },

  /**
   * Archive threads older than specified days
   * @param {string} query - Base query to filter threads
   * @param {number} daysOld - Age threshold in days
   */
  archiveOldThreads(query, daysOld) {
    const dateQuery = `${query} older_than:${daysOld}d`;
    const threads = GmailApp.search(dateQuery);
    
    threads.forEach(thread => {
      thread.moveToArchive();
    });
    
    return threads.length;
  },

  /**
   * Get email statistics
   * @param {string} query - Query to filter emails
   */
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
  },

  /**
   * Batch delete threads matching criteria
   * @param {string} query - Query for threads to delete
   * @param {boolean} permanent - Whether to permanently delete
   */
  batchDelete(query, permanent = false) {
    const threads = GmailApp.search(query);
    
    if (permanent) {
      threads.forEach(thread => thread.moveToTrash());
    } else {
      threads.forEach(thread => thread.moveToTrash());
    }
    
    return threads.length;
  }
};

// Make available to other scripts
if (typeof module !== 'undefined') {
  module.exports = GmailUtils;
}