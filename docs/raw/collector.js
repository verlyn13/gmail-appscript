/**
 * Gmail Archive Analysis System - Enhanced Production Edition
 * Version 3.0 - Refactored for Clarity and Performance
 * 
 * Optimized for large-scale email archives (64K+ messages)
 * with comprehensive pattern analysis and actionable insights
 * 
 * @author G-Script Architect
 * @requires Gmail API enabled in Services
 * 
 * ARCHITECTURE OVERVIEW:
 * - ConfigManager: Centralized configuration management
 * - DataProcessor: Core analysis engine
 * - StorageManager: Spreadsheet operations
 * - InsightEngine: Pattern analysis and recommendations
 * - UIHelper: User interaction and progress reporting
 */

// ==================== CONFIGURATION MANAGEMENT ====================
/**
 * Centralized configuration system
 */
class ConfigManager {
  constructor() {
    this.props = PropertiesService.getScriptProperties();
    this.config = this._loadConfig();
  }
  
  /**
   * Load configuration with defaults
   * @private
   */
  _loadConfig() {
    return {
      // Label Configuration - Optimized for your system
      LABELS_TO_ANALYZE: this._getOptimizedLabels(),
      
      // University of Alaska domains
      INTERNAL_DOMAINS: [
        'alaska.edu', 'uaa.alaska.edu', 'uaf.edu', 'uas.alaska.edu',
        'email.alaska.edu', 'kpc.alaska.edu', 'matsu.alaska.edu',
        'koc.alaska.edu', 'pwscc.alaska.edu', 'nwc.alaska.edu',
        'ctc.alaska.edu', 'uaa.instructure.com'
      ],
      
      // Processing parameters
      THREADS_PER_PAGE: 100,
      TIME_BUDGET_MS: 5.5 * 60 * 1000, // 5.5 minutes
      TRIGGER_INTERVAL_MINUTES: 3,
      MIN_PHRASE_COUNT: 2,
      MIN_KEYWORD_COUNT: 3,
      TOP_KEYWORDS_PER_LABEL: 50,
      TOP_SENDERS_PER_LABEL: 30,
      
      // Date range
      START_DATE: new Date(),
      END_DATE: new Date(2010, 0, 1),
      
      // Output configuration
      SHEET_NAME_PREFIX: "UAA Email Analysis",
      APPEND_TIMESTAMP: true,
      
      // Privacy
      PII_SALT: this.props.getProperty('PII_SALT') || this._generateSalt()
    };
  }
  
  /**
   * Get optimized label list based on hierarchy analysis
   * @private
   */
  _getOptimizedLabels() {
    // Core action labels (highest priority)
    const actionLabels = [
      "Action_Required", "Action_Required/Later", "Action_Required/This_Week",
      "Action_Required/Urgent", "_LLM/Action-Needed-Reply", "_LLM/Action-Needed-Task",
      "Reply", "Task", "To-Do"
    ];
    
    // Student-related (high priority)
    const studentLabels = [
      "Student", "Students", "_LLM/Student-Message",
      "Student Evaluations", "Letters of Recommendation"
    ];
    
    // Administrative
    const adminLabels = [
      "Admin/Dept", "_LLM/Admin-Dept", "KPC Admin", "UAA",
      "UAA/Admin", "UAA/Math Dept", "UA", "UA/Admin"
    ];
    
    // Committees & Service
    const serviceLabels = [
      "Committees", "Committees/Student Success", "Committees/Faculty Senate",
      "Service", "Service/Advising"
    ];
    
    // Courses (recent only)
    const courseLabels = [
      "KPC Courses", "KPC Courses/Fall 2024", "KPC Courses/Spring 2025",
      "KPC Courses/Spring 2024", "KPC Courses/Fall 2023", "UAA Courses"
    ];
    
    // Other categories
    const otherLabels = [
      "KPC Faculty", "KPC Staff", "Colleagues", "UAA/Faculty",
      "Announcements/Campus", "Announcements/Course", "_LLM/Announcement-Campus",
      "_LLM/Announcement-Course", "Updates", "_LLM/Notification-Bot", "News",
      "Scheduling", "_LLM/Scheduling-Calendar", "Financial", "Receipts",
      "_LLM/Receipt-Finance", "Retirement", "TIAA", "Personal",
      "_LLM/Personal-Family", "Personal/Health", "Professional Development",
      "Trainings", "Promotion & Tenure", "Reference", "_LLM/Reference-Docs",
      "Learning Resources", "Library", "Social", "_LLM/Social",
      "_LLM/Marketing-Promotions", "Unsorted", "_LLM/Other",
      "UNAC", "UAA/Governance"
    ];
    
    return [
      ...actionLabels,
      ...studentLabels,
      ...adminLabels,
      ...serviceLabels,
      ...courseLabels,
      ...otherLabels
    ];
  }
  
  /**
   * Generate unique salt for PII hashing
   * @private
   */
  _generateSalt() {
    const salt = 'UAA_' + Utilities.getUuid() + '_2024';
    this.props.setProperty('PII_SALT', salt);
    return salt;
  }
  
  /**
   * Get configuration value
   */
  get(key) {
    return this.config[key];
  }
  
  /**
   * Get all configuration
   */
  getAll() {
    return this.config;
  }
}

// ==================== STORAGE MANAGEMENT ====================
/**
 * Manages spreadsheet operations
 */
class StorageManager {
  constructor(config) {
    this.config = config;
    this.props = PropertiesService.getScriptProperties();
    this.ss = null;
  }
  
  /**
   * Get or create the analysis spreadsheet
   */
  getSpreadsheet() {
    if (this.ss) return this.ss;
    
    const ssId = this.props.getProperty('ANALYSIS_SHEET_ID');
    
    if (ssId) {
      try {
        this.ss = SpreadsheetApp.openById(ssId);
        return this.ss;
      } catch (e) {
        Logger.log('Previous spreadsheet not found, creating new one');
      }
    }
    
    // Create new spreadsheet
    const name = this.config.SHEET_NAME_PREFIX + 
                  (this.config.APPEND_TIMESTAMP ? ' ' + new Date().toISOString().split('T')[0] : '');
    this.ss = SpreadsheetApp.create(name);
    this.props.setProperty('ANALYSIS_SHEET_ID', this.ss.getId());
    
    this._initializeSheets();
    
    Logger.log(`📊 Created analysis spreadsheet: ${this.ss.getUrl()}`);
    return this.ss;
  }
  
  /**
   * Initialize sheets with headers
   * @private
   */
  _initializeSheets() {
    // Overview sheet
    const overview = this.ss.getActiveSheet();
    overview.setName('Overview');
    overview.getRange('A1:C1').setValues([['Metric', 'Value', 'Last Updated']]);
    overview.setFrozenRows(1);
    
    // Keywords sheet
    const keywords = this.ss.insertSheet('Keywords');
    keywords.getRange('A1:E1').setValues([['Label', 'Month', 'Keyword', 'Count', 'Rank']]);
    keywords.setFrozenRows(1);
    
    // Senders sheet
    const senders = this.ss.insertSheet('Senders');
    senders.getRange('A1:F1').setValues([['Label', 'Month', 'Sender Hash', 'Domain', 'Count', 'Is Internal']]);
    senders.setFrozenRows(1);
    
    // Time patterns sheet
    const time = this.ss.insertSheet('Time Patterns');
    time.getRange('A1:E1').setValues([['Label', 'Month', 'Hour', 'Day', 'Count']]);
    time.setFrozenRows(1);
    
    // Characteristics sheet
    const chars = this.ss.insertSheet('Characteristics');
    chars.getRange('A1:H1').setValues([['Label', 'Month', 'Threads', 'Messages', 'Urgent %', 'Questions %', 'Actions %', 'Attachments %']]);
    chars.setFrozenRows(1);
    
    // Insights sheet (new)
    const insights = this.ss.insertSheet('Insights');
    insights.getRange('A1:D1').setValues([['Category', 'Insight Type', 'Value', 'Timestamp']]);
    insights.setFrozenRows(1);
  }
  
  /**
   * Write data to sheet efficiently
   */
  writeToSheet(sheetName, data) {
    if (!data || data.length === 0) return;
    
    const sheet = this.ss.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log(`Sheet ${sheetName} not found`);
      return;
    }
    
    const lastRow = sheet.getLastRow();
    const startRow = lastRow + 1;
    const numRows = data.length;
    const numCols = data[0].length;
    
    sheet.getRange(startRow, 1, numRows, numCols).setValues(data);
  }
  
  /**
   * Update overview metrics
   */
  updateOverview(metrics) {
    const sheet = this.ss.getSheetByName('Overview');
    const timestamp = new Date();
    
    const data = Object.entries(metrics).map(([key, value]) => 
      [key, value, timestamp]
    );
    
    // Clear existing data and write new
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).clear();
    }
    sheet.getRange(2, 1, data.length, 3).setValues(data);
  }
  
  /**
   * Get spreadsheet URL
   */
  getUrl() {
    return this.ss ? this.ss.getUrl() : null;
  }
}

// ==================== DATA PROCESSOR ====================
/**
 * Core data processing engine
 */
class DataProcessor {
  constructor(config) {
    this.config = config;
    this.stopWords = this._loadStopWords();
  }
  
  /**
   * Load stop words for text analysis
   * @private
   */
  _loadStopWords() {
    return new Set([
      // Standard English
      'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his',
      'she', 'her', 'it', 'its', 'they', 'them', 'their', 'what', 'which',
      'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
      'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
      'does', 'did', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because',
      'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about',
      'against', 'between', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on',
      'off', 'over', 'under', 'again', 'further', 'then', 'once',
      // Email-specific
      'fw', 'fwd', 're', 'cc', 'bcc', 'email', 'message', 'wrote', 'date',
      // Academic
      'dr', 'prof', 'professor', 'student', 'students', 'class', 'course',
      // University
      'uaa', 'uaf', 'uas', 'alaska', 'university', 'college', 'campus',
      // Calendar
      'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
      // Common signatures
      'best', 'regards', 'sincerely', 'thanks', 'cheers', 'cordially'
    ]);
  }
  
  /**
   * Process a thread and extract features
   */
  processThread(threadData) {
    const features = {
      threadId: threadData.id,
      messageCount: 0,
      senders: new Map(),
      keywords: new Map(),
      phrases: new Map(),
      timeDistribution: { hours: new Array(24).fill(0), days: new Array(7).fill(0) },
      hasUrgent: false,
      hasQuestion: false,
      hasAction: false,
      hasAttachment: false
    };
    
    const messages = threadData.messages || [];
    features.messageCount = messages.length;
    
    // Regular expressions for content analysis
    const urgentRe = /\b(urgent|asap|deadline|immediately|critical|emergency|time[-\s]?sensitive)\b/i;
    const questionRe = /\?|(?:\b(question|wondering|could you|can you|would you|please advise)\b)/i;
    const actionRe = /\b(action required|need to|must|should|deadline|due|respond by)\b/i;
    
    for (const msg of messages) {
      // Extract metadata
      const headers = msg.payload?.headers || [];
      const getHeader = name => headers.find(h => h.name === name)?.value || '';
      
      const from = getHeader('From');
      const subject = getHeader('Subject');
      const dateStr = getHeader('Date');
      
      // Process sender
      if (from) {
        const senderKey = this._hashSender(from);
        const domain = this._extractDomain(from);
        
        features.senders.set(senderKey, {
          domain,
          count: (features.senders.get(senderKey)?.count || 0) + 1,
          isInternal: this._isInternalDomain(domain)
        });
      }
      
      // Process time
      if (dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date)) {
          features.timeDistribution.hours[date.getHours()]++;
          features.timeDistribution.days[date.getDay()]++;
        }
      }
      
      // Process content
      const snippet = msg.snippet || '';
      const text = this._sanitizeText((subject + ' ' + snippet).toLowerCase());
      
      // Check for indicators
      if (!features.hasUrgent && urgentRe.test(text)) features.hasUrgent = true;
      if (!features.hasQuestion && questionRe.test(text)) features.hasQuestion = true;
      if (!features.hasAction && actionRe.test(text)) features.hasAction = true;
      
      // Check for attachments
      if (!features.hasAttachment && msg.payload?.parts?.some(p => p.filename)) {
        features.hasAttachment = true;
      }
      
      // Extract keywords
      const words = this._extractWords(text);
      for (const word of words) {
        features.keywords.set(word, (features.keywords.get(word) || 0) + 1);
      }
      
      // Extract phrases (limit for memory)
      if (features.phrases.size < 500) {
        const phrases = this._extractPhrases(text);
        for (const phrase of phrases.slice(0, 10)) {
          features.phrases.set(phrase, (features.phrases.get(phrase) || 0) + 1);
        }
      }
    }
    
    return features;
  }
  
  /**
   * Hash sender for privacy
   * @private
   */
  _hashSender(fromField) {
    const emailMatch = fromField.match(/<(.+?)>/) || fromField.match(/([^\s]+@[^\s]+)/);
    const email = emailMatch ? emailMatch[1].toLowerCase() : fromField.toLowerCase();
    
    if (!email.includes('@')) return 'unknown_' + Date.now();
    
    return Utilities.base64EncodeWebSafe(
      Utilities.computeHmacSha256Signature(email, this.config.PII_SALT)
    ).slice(0, 10);
  }
  
  /**
   * Extract domain from email
   * @private
   */
  _extractDomain(fromField) {
    const emailMatch = fromField.match(/<(.+?)>/) || fromField.match(/([^\s]+@[^\s]+)/);
    const email = emailMatch ? emailMatch[1].toLowerCase() : fromField.toLowerCase();
    const parts = email.split('@');
    return parts.length > 1 ? parts[1] : 'unknown';
  }
  
  /**
   * Check if domain is internal
   * @private
   */
  _isInternalDomain(domain) {
    return this.config.INTERNAL_DOMAINS.some(d => 
      domain === d || domain.endsWith('.' + d)
    );
  }
  
  /**
   * Sanitize text for privacy
   * @private
   */
  _sanitizeText(text) {
    if (!text) return '';
    
    let sanitized = String(text);
    
    // Remove emails
    sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');
    
    // Remove phone numbers
    sanitized = sanitized.replace(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '');
    
    // Remove URLs
    sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '');
    
    // Remove potential student IDs
    sanitized = sanitized.replace(/\b[A-Z]\d{8}\b/g, '[STUDENT_ID]');
    sanitized = sanitized.replace(/\b\d{8,9}\b/g, '[ID]');
    
    return sanitized;
  }
  
  /**
   * Extract words from text
   * @private
   */
  _extractWords(text) {
    return (text.normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 3 && !this.stopWords.has(word))) || [];
  }
  
  /**
   * Extract phrases from text
   * @private
   */
  _extractPhrases(text) {
    const words = this._extractWords(text);
    const phrases = [];
    
    // Bigrams
    for (let i = 0; i < words.length - 1; i++) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
    }
    
    // Trigrams
    for (let i = 0; i < words.length - 2; i++) {
      phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
    
    return phrases;
  }
}

// ==================== INSIGHT ENGINE ====================
/**
 * Analyzes data and generates insights
 */
class InsightEngine {
  constructor(storage, config) {
    this.storage = storage;
    this.config = config;
  }
  
  /**
   * Analyze data quality and completeness
   */
  analyzeDataQuality() {
    Logger.log('=== DATA QUALITY ANALYSIS ===\n');
    
    const ss = this.storage.getSpreadsheet();
    const metrics = {};
    
    // Get row counts
    const sheets = {
      'Keywords': ss.getSheetByName('Keywords'),
      'Senders': ss.getSheetByName('Senders'),
      'Characteristics': ss.getSheetByName('Characteristics'),
      'Time Patterns': ss.getSheetByName('Time Patterns')
    };
    
    for (const [name, sheet] of Object.entries(sheets)) {
      if (sheet) {
        metrics[`${name} Rows`] = sheet.getLastRow() - 1;
      }
    }
    
    // Analyze characteristics
    if (sheets['Characteristics'] && metrics['Characteristics Rows'] > 0) {
      const data = sheets['Characteristics'].getRange(
        2, 1, 
        Math.min(metrics['Characteristics Rows'], 5000), 
        8
      ).getValues();
      
      const labels = new Set();
      const months = new Set();
      let totalThreads = 0;
      let totalMessages = 0;
      
      data.forEach(row => {
        if (row[0]) labels.add(row[0]);
        if (row[1]) months.add(row[1]);
        totalThreads += row[2] || 0;
        totalMessages += row[3] || 0;
      });
      
      metrics['Unique Labels'] = labels.size;
      metrics['Month Range'] = months.size;
      metrics['Total Threads'] = totalThreads;
      metrics['Total Messages'] = totalMessages;
      
      Logger.log(`📊 Analyzed ${totalThreads.toLocaleString()} threads`);
      Logger.log(`📧 Containing ${totalMessages.toLocaleString()} messages`);
      Logger.log(`🏷️ Across ${labels.size} labels`);
      Logger.log(`📅 Spanning ${months.size} months`);
    }
    
    // Update overview
    this.storage.updateOverview(metrics);
    
    // Data sufficiency check
    const sufficient = {
      keywords: metrics['Keywords Rows'] > 1000,
      senders: metrics['Senders Rows'] > 500,
      characteristics: metrics['Characteristics Rows'] > 100
    };
    
    Logger.log('\n✅ DATA SUFFICIENCY:');
    if (Object.values(sufficient).every(v => v)) {
      Logger.log('EXCELLENT: Sufficient data for all analyses!');
    } else {
      Object.entries(sufficient).forEach(([type, ok]) => {
        Logger.log(`  ${type}: ${ok ? '✅ Sufficient' : '⚠️ Limited'}`);
      });
    }
    
    return metrics;
  }
  
  /**
   * Generate actionable insights
   */
  generateInsights() {
    Logger.log('=== GENERATING ACTIONABLE INSIGHTS ===\n');
    
    const ss = this.storage.getSpreadsheet();
    const insights = [];
    
    // Analyze keywords for patterns
    const keywordsSheet = ss.getSheetByName('Keywords');
    if (keywordsSheet && keywordsSheet.getLastRow() > 1) {
      const keywordInsights = this._analyzeKeywords(keywordsSheet);
      insights.push(...keywordInsights);
    }
    
    // Analyze sender patterns
    const sendersSheet = ss.getSheetByName('Senders');
    if (sendersSheet && sendersSheet.getLastRow() > 1) {
      const senderInsights = this._analyzeSenders(sendersSheet);
      insights.push(...senderInsights);
    }
    
    // Analyze characteristics
    const charsSheet = ss.getSheetByName('Characteristics');
    if (charsSheet && charsSheet.getLastRow() > 1) {
      const charInsights = this._analyzeCharacteristics(charsSheet);
      insights.push(...charInsights);
    }
    
    // Write insights to sheet
    if (insights.length > 0) {
      const insightData = insights.map(i => [
        i.category,
        i.type,
        i.value,
        new Date()
      ]);
      this.storage.writeToSheet('Insights', insightData);
    }
    
    // Log top insights
    this._logTopInsights(insights);
    
    return insights;
  }
  
  /**
   * Analyze keywords for insights
   * @private
   */
  _analyzeKeywords(sheet) {
    const data = sheet.getRange(2, 1, Math.min(2000, sheet.getLastRow() - 1), 5).getValues();
    const insights = [];
    
    // Find action keywords
    const actionKeywords = {};
    const studentKeywords = {};
    
    data.forEach(row => {
      const [label, month, keyword, count] = row;
      
      if (label && (label.includes('Action') || label.includes('Task'))) {
        actionKeywords[keyword] = (actionKeywords[keyword] || 0) + count;
      }
      if (label && label.includes('Student')) {
        studentKeywords[keyword] = (studentKeywords[keyword] || 0) + count;
      }
    });
    
    // Top action keywords
    Object.entries(actionKeywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([keyword, count]) => {
        insights.push({
          category: 'Keywords',
          type: 'Action Trigger',
          value: `"${keyword}" (${count} occurrences)`
        });
      });
    
    // Top student keywords
    Object.entries(studentKeywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([keyword, count]) => {
        insights.push({
          category: 'Keywords',
          type: 'Student Indicator',
          value: `"${keyword}" (${count} occurrences)`
        });
      });
    
    return insights;
  }
  
  /**
   * Analyze sender patterns
   * @private
   */
  _analyzeSenders(sheet) {
    const data = sheet.getRange(2, 1, Math.min(1000, sheet.getLastRow() - 1), 6).getValues();
    const insights = [];
    
    // Domain analysis
    const domains = {};
    let internalCount = 0;
    let externalCount = 0;
    
    data.forEach(row => {
      const [label, month, hash, domain, count, isInternal] = row;
      
      if (domain) {
        domains[domain] = (domains[domain] || 0) + (count || 1);
        if (isInternal === true || isInternal === 'TRUE') {
          internalCount++;
        } else {
          externalCount++;
        }
      }
    });
    
    // Top domains
    Object.entries(domains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([domain, count]) => {
        insights.push({
          category: 'Senders',
          type: 'Top Domain',
          value: `${domain} (${count} messages)`
        });
      });
    
    // Internal vs external ratio
    insights.push({
      category: 'Senders',
      type: 'Internal Ratio',
      value: `${Math.round(internalCount / (internalCount + externalCount) * 100)}% internal`
    });
    
    return insights;
  }
  
  /**
   * Analyze characteristics for patterns
   * @private
   */
  _analyzeCharacteristics(sheet) {
    const data = sheet.getRange(2, 1, Math.min(1000, sheet.getLastRow() - 1), 8).getValues();
    const insights = [];
    
    const labelStats = {};
    
    data.forEach(row => {
      const [label, month, threads, messages, urgent, questions, actions, attachments] = row;
      
      if (label) {
        if (!labelStats[label]) {
          labelStats[label] = {
            threads: 0,
            urgentSum: 0,
            questionSum: 0,
            actionSum: 0,
            count: 0
          };
        }
        
        labelStats[label].threads += threads || 0;
        labelStats[label].urgentSum += parseFloat(urgent) || 0;
        labelStats[label].questionSum += parseFloat(questions) || 0;
        labelStats[label].actionSum += parseFloat(actions) || 0;
        labelStats[label].count++;
      }
    });
    
    // Labels with highest action rates
    Object.entries(labelStats)
      .map(([label, stats]) => ({
        label,
        avgAction: stats.actionSum / stats.count
      }))
      .sort((a, b) => b.avgAction - a.avgAction)
      .slice(0, 5)
      .forEach(({label, avgAction}) => {
        insights.push({
          category: 'Patterns',
          type: 'High Action Label',
          value: `${label} (${avgAction.toFixed(1)}% action rate)`
        });
      });
    
    return insights;
  }
  
  /**
   * Log top insights to console
   * @private
   */
  _logTopInsights(insights) {
    const byCategory = {};
    
    insights.forEach(insight => {
      if (!byCategory[insight.category]) {
        byCategory[insight.category] = [];
      }
      byCategory[insight.category].push(insight);
    });
    
    Object.entries(byCategory).forEach(([category, items]) => {
      Logger.log(`\n${category.toUpperCase()}:`);
      items.slice(0, 5).forEach(item => {
        Logger.log(`  • ${item.type}: ${item.value}`);
      });
    });
    
    Logger.log('\n💡 RECOMMENDATIONS:');
    Logger.log('1. Create Gmail filters using the action trigger keywords');
    Logger.log('2. Add high-volume domains to VIP or blocked lists');
    Logger.log('3. Schedule processing for high-action labels');
    Logger.log('4. Fine-tune LLM prompts with discovered patterns');
  }
}

// ==================== ORCHESTRATOR ====================
/**
 * Main orchestrator for the analysis process
 */
class AnalysisOrchestrator {
  constructor() {
    this.config = new ConfigManager();
    this.storage = new StorageManager(this.config.getAll());
    this.processor = new DataProcessor(this.config.getAll());
    this.insights = new InsightEngine(this.storage, this.config.getAll());
    this.state = this._loadState();
  }
  
  /**
   * Initialize the analysis
   */
  initialize() {
    Logger.log('=== INITIALIZING EMAIL ANALYSIS ===\n');
    
    // Test Gmail API
    if (!this._testGmailAPI()) {
      Logger.log('❌ Please enable Gmail API first');
      return false;
    }
    
    // Reset state
    this._resetState();
    
    // Create spreadsheet
    const ss = this.storage.getSpreadsheet();
    
    // Estimate scope
    const profile = Gmail.Users.getProfile('me');
    const threads = profile.threadsTotal || 20000;
    const estimatedHours = (threads / 2000).toFixed(1);
    
    Logger.log('\n📊 ANALYSIS SCOPE:');
    Logger.log(`Total threads: ${threads.toLocaleString()}`);
    Logger.log(`Labels to analyze: ${this.config.get('LABELS_TO_ANALYZE').length}`);
    Logger.log(`Estimated time: ~${estimatedHours} hours`);
    Logger.log(`\n📋 Spreadsheet: ${ss.getUrl()}`);
    Logger.log('\n✅ Ready to start! Run main() to begin processing');
    
    return true;
  }
  
  /**
   * Main processing function
   */
  run() {
    const lock = LockService.getScriptLock();
    const gotLock = lock.tryLock(10000);
    
    if (!gotLock) {
      Logger.log('Another instance is running');
      return;
    }
    
    try {
      const startTime = Date.now();
      
      // Initialize if needed
      if (!this.state.initialized) {
        if (!this.initialize()) return;
        this.state.initialized = true;
      }
      
      // Process labels
      const processed = this._processLabels(startTime);
      
      if (this.state.completed) {
        this._completeAnalysis();
      } else {
        this._scheduleNextRun();
      }
      
      return processed;
      
    } finally {
      lock.releaseLock();
    }
  }
  
  /**
   * Process labels within time budget
   * @private
   */
  _processLabels(startTime) {
    const labels = this.config.get('LABELS_TO_ANALYZE');
    const timeLimit = this.config.get('TIME_BUDGET_MS');
    let processedCount = 0;
    
    for (let i = this.state.currentLabelIndex; i < labels.length; i++) {
      const labelName = labels[i];
      
      // Check time
      if ((Date.now() - startTime) > timeLimit) {
        this.state.currentLabelIndex = i;
        this._saveState();
        Logger.log(`⏸️ Pausing at ${labelName}, will resume`);
        return processedCount;
      }
      
      // Process label
      const labelProcessed = this._processLabel(labelName);
      if (labelProcessed > 0) {
        processedCount += labelProcessed;
        Logger.log(`✅ Processed ${labelName}: ${labelProcessed} threads`);
      }
      
      this.state.currentLabelIndex = i + 1;
    }
    
    // All complete
    this.state.completed = true;
    this._saveState();
    
    return processedCount;
  }
  
  /**
   * Process a single label
   * @private
   */
  _processLabel(labelName) {
    if (!this.state.labels[labelName]) {
      this.state.labels[labelName] = {
        months: this._generateMonthSequence(),
        currentMonthIndex: 0,
        done: false
      };
    }
    
    const labelState = this.state.labels[labelName];
    if (labelState.done) return 0;
    
    let totalProcessed = 0;
    
    while (labelState.currentMonthIndex < labelState.months.length) {
      const yearMonth = labelState.months[labelState.currentMonthIndex];
      const processed = this._processLabelMonth(labelName, yearMonth);
      
      totalProcessed += processed;
      labelState.currentMonthIndex++;
      
      if (processed > 0) {
        this._saveState();
      }
    }
    
    labelState.done = true;
    return totalProcessed;
  }
  
  /**
   * Process a label-month combination
   * @private
   */
  _processLabelMonth(labelName, yearMonth) {
    const { after, before } = this._getMonthBounds(yearMonth);
    const query = `label:"${labelName.replace(/"/g, '\\"')}" after:${after} before:${before}`;
    
    try {
      const response = Gmail.Users.Threads.list('me', {
        q: query,
        maxResults: this.config.get('THREADS_PER_PAGE')
      });
      
      const threads = response.threads || [];
      if (threads.length === 0) return 0;
      
      // Process threads
      const accumulator = this._initAccumulator();
      
      for (const threadRef of threads) {
        try {
          const thread = Gmail.Users.Threads.get('me', threadRef.id, {
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date']
          });
          
          const features = this.processor.processThread(thread);
          this._updateAccumulator(accumulator, features);
          
        } catch (e) {
          Logger.log(`Error processing thread: ${e.toString()}`);
        }
      }
      
      // Save results
      this._flushAccumulator(labelName, yearMonth, accumulator);
      
      return threads.length;
      
    } catch (e) {
      Logger.log(`Error processing ${labelName} ${yearMonth}: ${e.toString()}`);
      return 0;
    }
  }
  
  /**
   * Initialize accumulator for monthly data
   * @private
   */
  _initAccumulator() {
    return {
      threadCount: 0,
      messageCount: 0,
      keywords: new Map(),
      phrases: new Map(),
      senders: new Map(),
      urgentThreads: 0,
      questionThreads: 0,
      actionThreads: 0,
      attachmentThreads: 0
    };
  }
  
  /**
   * Update accumulator with thread features
   * @private
   */
  _updateAccumulator(accum, features) {
    accum.threadCount++;
    accum.messageCount += features.messageCount;
    
    // Update flags
    if (features.hasUrgent) accum.urgentThreads++;
    if (features.hasQuestion) accum.questionThreads++;
    if (features.hasAction) accum.actionThreads++;
    if (features.hasAttachment) accum.attachmentThreads++;
    
    // Merge keywords
    features.keywords.forEach((count, keyword) => {
      accum.keywords.set(keyword, (accum.keywords.get(keyword) || 0) + count);
    });
    
    // Merge senders
    features.senders.forEach((info, sender) => {
      if (!accum.senders.has(sender)) {
        accum.senders.set(sender, info);
      } else {
        accum.senders.get(sender).count += info.count;
      }
    });
  }
  
  /**
   * Save accumulator data to spreadsheet
   * @private
   */
  _flushAccumulator(labelName, yearMonth, accum) {
    // Write keywords
    const topKeywords = Array.from(accum.keywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.get('TOP_KEYWORDS_PER_LABEL'))
      .filter(([_, count]) => count >= this.config.get('MIN_KEYWORD_COUNT'))
      .map(([keyword, count], idx) => [labelName, yearMonth, keyword, count, idx + 1]);
    
    if (topKeywords.length > 0) {
      this.storage.writeToSheet('Keywords', topKeywords);
    }
    
    // Write senders
    const topSenders = Array.from(accum.senders.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, this.config.get('TOP_SENDERS_PER_LABEL'))
      .map(([hash, info]) => [
        labelName, yearMonth, hash, info.domain, info.count, info.isInternal
      ]);
    
    if (topSenders.length > 0) {
      this.storage.writeToSheet('Senders', topSenders);
    }
    
    // Write characteristics
    const threadCount = accum.threadCount || 1;
    const characteristics = [[
      labelName,
      yearMonth,
      accum.threadCount,
      accum.messageCount,
      ((accum.urgentThreads / threadCount) * 100).toFixed(1),
      ((accum.questionThreads / threadCount) * 100).toFixed(1),
      ((accum.actionThreads / threadCount) * 100).toFixed(1),
      ((accum.attachmentThreads / threadCount) * 100).toFixed(1)
    ]];
    
    this.storage.writeToSheet('Characteristics', characteristics);
  }
  
  /**
   * Complete the analysis
   * @private
   */
  _completeAnalysis() {
    Logger.log('=== ANALYSIS COMPLETE ===');
    
    // Clear triggers
    this._clearTriggers();
    
    // Run quality analysis
    this.insights.analyzeDataQuality();
    
    // Generate insights
    this.insights.generateInsights();
    
    Logger.log(`\n📊 Results: ${this.storage.getUrl()}`);
  }
  
  /**
   * Test Gmail API access
   * @private
   */
  _testGmailAPI() {
    try {
      const profile = Gmail.Users.getProfile('me');
      Logger.log('✅ Gmail API is working');
      return true;
    } catch (e) {
      Logger.log('❌ Gmail API not enabled');
      Logger.log('To fix: Services → Gmail API → Add');
      return false;
    }
  }
  
  /**
   * Generate month sequence for analysis
   * @private
   */
  _generateMonthSequence() {
    const months = [];
    const current = new Date(this.config.get('START_DATE'));
    const end = new Date(this.config.get('END_DATE'));
    
    while (current >= end) {
      months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
      current.setMonth(current.getMonth() - 1);
    }
    
    return months;
  }
  
  /**
   * Get month boundaries for query
   * @private
   */
  _getMonthBounds(yearMonth) {
    const [year, month] = yearMonth.split('-').map(Number);
    const after = new Date(year, month - 1, 1);
    const before = new Date(year, month, 1);
    
    const fmt = d => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    
    return { after: fmt(after), before: fmt(before) };
  }
  
  /**
   * Load processing state
   * @private
   */
  _loadState() {
    const raw = PropertiesService.getScriptProperties().getProperty('ANALYSIS_STATE_V3') || '{}';
    return JSON.parse(raw);
  }
  
  /**
   * Save processing state
   * @private
   */
  _saveState() {
    PropertiesService.getScriptProperties().setProperty('ANALYSIS_STATE_V3', JSON.stringify(this.state));
  }
  
  /**
   * Reset processing state
   * @private
   */
  _resetState() {
    this.state = {
      initialized: false,
      labels: {},
      currentLabelIndex: 0,
      completed: false
    };
    this._saveState();
    this._clearTriggers();
  }
  
  /**
   * Schedule next run
   * @private
   */
  _scheduleNextRun() {
    this._clearTriggers();
    
    ScriptApp.newTrigger('main')
      .timeBased()
      .after(this.config.get('TRIGGER_INTERVAL_MINUTES') * 60 * 1000)
      .create();
    
    Logger.log(`⏰ Next run in ${this.config.get('TRIGGER_INTERVAL_MINUTES')} minutes`);
  }
  
  /**
   * Clear all triggers
   * @private
   */
  _clearTriggers() {
    ScriptApp.getProjectTriggers()
      .filter(t => t.getHandlerFunction() === 'main')
      .forEach(t => ScriptApp.deleteTrigger(t));
  }
}

// ==================== PUBLIC API ====================

// Global orchestrator instance
let orchestrator = null;

/**
 * Initialize the orchestrator
 */
function getOrchestrator() {
  if (!orchestrator) {
    orchestrator = new AnalysisOrchestrator();
  }
  return orchestrator;
}

/**
 * Initialize analysis - run this first
 */
function initializeAnalysis() {
  return getOrchestrator().initialize();
}

/**
 * Main processing function - run after initialization
 */
function main() {
  return getOrchestrator().run();
}

/**
 * Check current progress
 */
function getProgress() {
  const orch = getOrchestrator();
  const state = orch.state;
  
  if (!state.initialized) {
    Logger.log('Not started. Run initializeAnalysis() first.');
    return;
  }
  
  if (state.completed) {
    Logger.log('✅ Analysis complete!');
    Logger.log(`📊 View results: ${orch.storage.getUrl()}`);
    return;
  }
  
  const totalLabels = orch.config.get('LABELS_TO_ANALYZE').length;
  const currentIndex = state.currentLabelIndex || 0;
  const percentDone = ((currentIndex / totalLabels) * 100).toFixed(1);
  
  Logger.log('=== ANALYSIS PROGRESS ===');
  Logger.log(`📊 ${percentDone}% complete`);
  Logger.log(`📍 Processing label ${currentIndex + 1} of ${totalLabels}`);
  
  // Check for active triggers
  const triggers = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'main');
  
  Logger.log(triggers.length > 0 ? '✅ Auto-processing active' : '⏸️ Paused - run main() to continue');
}

/**
 * Analyze data quality
 */
function analyzeDataQuality() {
  return getOrchestrator().insights.analyzeDataQuality();
}

/**
 * Generate actionable insights
 */
function generateInsights() {
  return getOrchestrator().insights.generateInsights();
}

/**
 * Export data for LLM training
 */
function exportTrainingData() {
  const orch = getOrchestrator();
  const ss = orch.storage.getSpreadsheet();
  
  Logger.log('=== EXPORTING TRAINING DATA ===');
  
  // Collect data from sheets
  const trainingData = {
    metadata: {
      exportDate: new Date().toISOString(),
      spreadsheetUrl: ss.getUrl()
    },
    data: {}
  };
  
  // Export each sheet
  ['Keywords', 'Senders', 'Characteristics', 'Insights'].forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet && sheet.getLastRow() > 1) {
      trainingData.data[sheetName] = sheet.getDataRange().getValues();
      Logger.log(`  • Exported ${sheet.getLastRow() - 1} rows from ${sheetName}`);
    }
  });
  
  // Save to Drive
  const fileName = `Email_Training_Data_${new Date().toISOString().split('T')[0]}.json`;
  const blob = Utilities.newBlob(JSON.stringify(trainingData, null, 2), 'application/json', fileName);
  const file = DriveApp.createFile(blob);
  
  Logger.log(`\n✅ Training data exported: ${file.getUrl()}`);
  
  return file.getUrl();
}

/**
 * Reset analysis (use with caution)
 */
function resetAnalysis() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Reset Analysis?',
    'This will delete all progress and results. Are you sure?',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    Logger.log('Reset cancelled');
    return;
  }
  
  getOrchestrator()._resetState();
  PropertiesService.getScriptProperties().deleteProperty('ANALYSIS_SHEET_ID');
  
  Logger.log('✅ Analysis reset complete');
}

/**
 * Create menu on spreadsheet open
 */
function onOpen() {
  try {
    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getUi) {
      SpreadsheetApp.getUi()
        .createMenu('📧 Email Analysis')
        .addItem('🚀 Initialize', 'initializeAnalysis')
        .addItem('▶️ Start/Continue', 'main')
        .addItem('📊 Check Progress', 'getProgress')
        .addSeparator()
        .addItem('🔍 Analyze Quality', 'analyzeDataQuality')
        .addItem('💡 Generate Insights', 'generateInsights')
        .addItem('💾 Export Training Data', 'exportTrainingData')
        .addSeparator()
        .addItem('🔄 Reset (Caution!)', 'resetAnalysis')
        .addToUi();
    }
  } catch (e) {
    // Standalone environment
  }
}

/**
 * Gmail Analysis Recovery & Enhanced Insights System
 * Version 4.0 - Spreadsheet Reconnection & Advanced Analytics
 * 
 * This module handles reconnection to existing analysis spreadsheets
 * and provides enhanced insight generation capabilities.
 * 
 * @author G-Script Architect
 * @requires Existing analysis spreadsheet from previous runs
 */

// ==================== DIAGNOSTIC & RECOVERY MODULE ====================
/**
 * Comprehensive diagnostic and recovery system for analysis spreadsheets
 */
class AnalysisDiagnostics {
  constructor() {
    this.props = PropertiesService.getScriptProperties();
    this.requiredSheets = ['Overview', 'Keywords', 'Senders', 'Characteristics', 'Time Patterns'];
    this.optionalSheets = ['Insights', 'Phrases'];
  }
  
  /**
   * Run complete diagnostics
   * @returns {Object} Diagnostic results
   */
  runDiagnostics() {
    Logger.log('=== RUNNING ANALYSIS DIAGNOSTICS ===\n');
    
    const results = {
      properties: this._checkProperties(),
      spreadsheet: this._checkSpreadsheet(),
      sheets: this._checkSheets(),
      data: this._checkData(),
      recommendations: []
    };
    
    // Generate recommendations
    this._generateRecommendations(results);
    
    // Log results
    this._logResults(results);
    
    return results;
  }
  
  /**
   * Check script properties
   * @private
   */
  _checkProperties() {
    const properties = {
      ANALYSIS_SHEET_ID: this.props.getProperty('ANALYSIS_SHEET_ID'),
      PII_SALT: this.props.getProperty('PII_SALT'),
      ANALYSIS_STATE_V3: this.props.getProperty('ANALYSIS_STATE_V3')
    };
    
    const status = {
      hasSheetId: !!properties.ANALYSIS_SHEET_ID,
      hasPiiSalt: !!properties.PII_SALT,
      hasState: !!properties.ANALYSIS_STATE_V3,
      values: properties
    };
    
    Logger.log('📋 Script Properties:');
    Logger.log(`   Sheet ID: ${status.hasSheetId ? '✅ ' + properties.ANALYSIS_SHEET_ID : '❌ Not set'}`);
    Logger.log(`   PII Salt: ${status.hasPiiSalt ? '✅ Set' : '❌ Not set'}`);
    Logger.log(`   Analysis State: ${status.hasState ? '✅ Found' : '❌ Not found'}`);
    
    return status;
  }
  
  /**
   * Check spreadsheet accessibility
   * @private
   */
  _checkSpreadsheet() {
    const result = {
      exists: false,
      accessible: false,
      url: null,
      name: null,
      id: null
    };
    
    const sheetId = this.props.getProperty('ANALYSIS_SHEET_ID');
    if (!sheetId) {
      Logger.log('\n📊 Spreadsheet: ❌ No ID configured');
      return result;
    }
    
    try {
      const ss = SpreadsheetApp.openById(sheetId);
      result.exists = true;
      result.accessible = true;
      result.url = ss.getUrl();
      result.name = ss.getName();
      result.id = sheetId;
      
      Logger.log('\n📊 Spreadsheet:');
      Logger.log(`   Status: ✅ Accessible`);
      Logger.log(`   Name: ${result.name}`);
      Logger.log(`   URL: ${result.url}`);
      
    } catch (e) {
      result.exists = false;
      Logger.log('\n📊 Spreadsheet:');
      Logger.log(`   Status: ❌ Cannot access (${e.toString()})`);
      Logger.log(`   ID: ${sheetId}`);
    }
    
    return result;
  }
  
  /**
   * Check individual sheets
   * @private
   */
  _checkSheets() {
    const results = {
      required: {},
      optional: {},
      allPresent: false
    };
    
    const sheetId = this.props.getProperty('ANALYSIS_SHEET_ID');
    if (!sheetId) return results;
    
    try {
      const ss = SpreadsheetApp.openById(sheetId);
      
      Logger.log('\n📑 Sheet Structure:');
      
      // Check required sheets
      for (const sheetName of this.requiredSheets) {
        const sheet = ss.getSheetByName(sheetName);
        results.required[sheetName] = {
          exists: !!sheet,
          rows: sheet ? sheet.getLastRow() : 0
        };
        
        Logger.log(`   ${sheetName}: ${sheet ? `✅ ${sheet.getLastRow()} rows` : '❌ Missing'}`);
      }
      
      // Check optional sheets
      for (const sheetName of this.optionalSheets) {
        const sheet = ss.getSheetByName(sheetName);
        results.optional[sheetName] = {
          exists: !!sheet,
          rows: sheet ? sheet.getLastRow() : 0
        };
      }
      
      results.allPresent = Object.values(results.required).every(s => s.exists);
      
    } catch (e) {
      Logger.log(`   Error checking sheets: ${e.toString()}`);
    }
    
    return results;
  }
  
  /**
   * Check data quality
   * @private
   */
  _checkData() {
    const result = {
      hasData: false,
      totalThreads: 0,
      totalMessages: 0,
      uniqueLabels: 0,
      keywordRows: 0,
      senderRows: 0
    };
    
    const sheetId = this.props.getProperty('ANALYSIS_SHEET_ID');
    if (!sheetId) return result;
    
    try {
      const ss = SpreadsheetApp.openById(sheetId);
      
      // Check Keywords sheet
      const keywordsSheet = ss.getSheetByName('Keywords');
      if (keywordsSheet) {
        result.keywordRows = keywordsSheet.getLastRow() - 1;
      }
      
      // Check Senders sheet
      const sendersSheet = ss.getSheetByName('Senders');
      if (sendersSheet) {
        result.senderRows = sendersSheet.getLastRow() - 1;
      }
      
      // Check Characteristics sheet
      const charsSheet = ss.getSheetByName('Characteristics');
      if (charsSheet && charsSheet.getLastRow() > 1) {
        const data = charsSheet.getRange(
          2, 1, 
          Math.min(charsSheet.getLastRow() - 1, 5000), 
          4
        ).getValues();
        
        const labels = new Set();
        data.forEach(row => {
          if (row[0]) labels.add(row[0]);
          result.totalThreads += row[2] || 0;
          result.totalMessages += row[3] || 0;
        });
        
        result.uniqueLabels = labels.size;
        result.hasData = result.totalThreads > 0;
      }
      
      Logger.log('\n📈 Data Statistics:');
      Logger.log(`   Total Threads: ${result.totalThreads.toLocaleString()}`);
      Logger.log(`   Total Messages: ${result.totalMessages.toLocaleString()}`);
      Logger.log(`   Unique Labels: ${result.uniqueLabels}`);
      Logger.log(`   Keyword Entries: ${result.keywordRows.toLocaleString()}`);
      Logger.log(`   Sender Entries: ${result.senderRows.toLocaleString()}`);
      
    } catch (e) {
      Logger.log(`   Error checking data: ${e.toString()}`);
    }
    
    return result;
  }
  
  /**
   * Generate recommendations based on diagnostics
   * @private
   */
  _generateRecommendations(results) {
    const recs = results.recommendations;
    
    // No sheet ID
    if (!results.properties.hasSheetId) {
      recs.push({
        priority: 'HIGH',
        issue: 'No spreadsheet ID configured',
        action: 'Run reconnectToSpreadsheet() with your spreadsheet URL'
      });
    }
    
    // Sheet exists but missing required sheets
    if (results.spreadsheet.accessible && !results.sheets.allPresent) {
      const missing = Object.entries(results.sheets.required)
        .filter(([_, info]) => !info.exists)
        .map(([name, _]) => name);
      
      recs.push({
        priority: 'HIGH',
        issue: `Missing required sheets: ${missing.join(', ')}`,
        action: 'Run repairSpreadsheetStructure() to add missing sheets'
      });
    }
    
    // No data
    if (results.spreadsheet.accessible && results.data.totalThreads === 0) {
      recs.push({
        priority: 'MEDIUM',
        issue: 'Spreadsheet exists but contains no data',
        action: 'Run the data collection script (main()) to populate data'
      });
    }
    
    // Missing Insights sheet
    if (results.spreadsheet.accessible && !results.sheets.optional['Insights']?.exists) {
      recs.push({
        priority: 'LOW',
        issue: 'Insights sheet not found',
        action: 'Will be created automatically when generateInsights() is run'
      });
    }
  }
  
  /**
   * Log diagnostic results
   * @private
   */
  _logResults(results) {
    if (results.recommendations.length > 0) {
      Logger.log('\n🔧 RECOMMENDATIONS:');
      results.recommendations.forEach((rec, i) => {
        Logger.log(`\n${i + 1}. [${rec.priority}] ${rec.issue}`);
        Logger.log(`   → ${rec.action}`);
      });
    } else {
      Logger.log('\n✅ SYSTEM STATUS: All checks passed!');
    }
  }
}

// ==================== RECOVERY FUNCTIONS ====================

/**
 * Reconnect to an existing analysis spreadsheet
 * @param {string} spreadsheetUrl - The URL of the existing spreadsheet
 * @returns {boolean} Success status
 */
function reconnectToSpreadsheet(spreadsheetUrl) {
  Logger.log('=== RECONNECTING TO EXISTING SPREADSHEET ===\n');
  
  if (!spreadsheetUrl) {
    Logger.log('❌ Error: No URL provided');
    Logger.log('Usage: reconnectToSpreadsheet("https://docs.google.com/spreadsheets/d/YOUR_ID/edit")');
    return false;
  }
  
  try {
    // Extract ID from URL
    const idMatch = spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!idMatch) {
      Logger.log('❌ Error: Could not extract spreadsheet ID from URL');
      return false;
    }
    
    const spreadsheetId = idMatch[1];
    Logger.log(`📋 Extracted ID: ${spreadsheetId}`);
    
    // Try to open the spreadsheet
    const ss = SpreadsheetApp.openById(spreadsheetId);
    Logger.log(`✅ Successfully opened: ${ss.getName()}`);
    
    // Save the ID to script properties
    PropertiesService.getScriptProperties().setProperty('ANALYSIS_SHEET_ID', spreadsheetId);
    Logger.log('✅ Saved spreadsheet ID to script properties');
    
    // Check for PII_SALT
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty('PII_SALT')) {
      const salt = 'UAA_' + Utilities.getUuid() + '_RECOVERED';
      props.setProperty('PII_SALT', salt);
      Logger.log('✅ Generated new PII_SALT');
    }
    
    // Run diagnostics
    Logger.log('\n📊 Running diagnostics on reconnected spreadsheet...');
    const diagnostics = new AnalysisDiagnostics();
    const results = diagnostics.runDiagnostics();
    
    if (results.data.hasData) {
      Logger.log('\n🎉 SUCCESS! Reconnected to spreadsheet with existing data');
      Logger.log('You can now run:');
      Logger.log('  • generateEnhancedInsights() - for detailed analysis');
      Logger.log('  • exportForTriage() - to prepare data for triage system');
    }
    
    return true;
    
  } catch (e) {
    Logger.log(`❌ Error: ${e.toString()}`);
    Logger.log('\nPossible issues:');
    Logger.log('  • The spreadsheet URL is incorrect');
    Logger.log('  • You don\'t have access to the spreadsheet');
    Logger.log('  • The spreadsheet has been deleted');
    return false;
  }
}

/**
 * Repair missing sheets in the analysis spreadsheet
 */
function repairSpreadsheetStructure() {
  Logger.log('=== REPAIRING SPREADSHEET STRUCTURE ===\n');
  
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('ANALYSIS_SHEET_ID');
  
  if (!sheetId) {
    Logger.log('❌ No spreadsheet ID found. Run reconnectToSpreadsheet() first.');
    return false;
  }
  
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    Logger.log(`📊 Repairing: ${ss.getName()}`);
    
    const requiredSheets = {
      'Overview': ['Metric', 'Value', 'Last Updated'],
      'Keywords': ['Label', 'Month', 'Keyword', 'Count', 'Rank'],
      'Senders': ['Label', 'Month', 'Sender Hash', 'Domain', 'Count', 'Is Internal'],
      'Time Patterns': ['Label', 'Month', 'Hour', 'Day', 'Count'],
      'Characteristics': ['Label', 'Month', 'Threads', 'Messages', 'Urgent %', 'Questions %', 'Actions %', 'Attachments %'],
      'Insights': ['Category', 'Insight Type', 'Value', 'Timestamp']
    };
    
    let repaired = 0;
    
    for (const [sheetName, headers] of Object.entries(requiredSheets)) {
      let sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        Logger.log(`  Creating missing sheet: ${sheetName}`);
        sheet = ss.insertSheet(sheetName);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.setFrozenRows(1);
        repaired++;
      } else {
        // Check if headers are correct
        const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
        const headersMatch = headers.every((h, i) => currentHeaders[i] === h);
        
        if (!headersMatch) {
          Logger.log(`  Fixing headers for: ${sheetName}`);
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
          repaired++;
        } else {
          Logger.log(`  ✅ ${sheetName} - OK`);
        }
      }
    }
    
    Logger.log(`\n✅ Repair complete. Fixed ${repaired} issues.`);
    return true;
    
  } catch (e) {
    Logger.log(`❌ Error: ${e.toString()}`);
    return false;
  }
}

// ==================== ENHANCED INSIGHTS ENGINE ====================
/**
 * Advanced insights generator for existing data
 */
class EnhancedInsightEngine {
  constructor() {
    this.props = PropertiesService.getScriptProperties();
    this.sheetId = this.props.getProperty('ANALYSIS_SHEET_ID');
  }
  
  /**
   * Generate comprehensive insights from existing data
   */
  generateInsights() {
    if (!this.sheetId) {
      Logger.log('❌ No spreadsheet configured. Run reconnectToSpreadsheet() first.');
      return null;
    }
    
    Logger.log('=== GENERATING ENHANCED INSIGHTS ===\n');
    
    try {
      const ss = SpreadsheetApp.openById(this.sheetId);
      const insights = [];
      
      // Pattern Analysis
      Logger.log('🔍 Analyzing patterns...');
      insights.push(...this._analyzeLabelPatterns(ss));
      insights.push(...this._analyzeTemporalPatterns(ss));
      insights.push(...this._analyzeSenderPatterns(ss));
      insights.push(...this._analyzeKeywordClusters(ss));
      
      // Generate recommendations
      const recommendations = this._generateRecommendations(insights);
      
      // Save insights
      this._saveInsights(ss, insights, recommendations);
      
      // Log summary
      this._logInsightSummary(insights, recommendations);
      
      return {
        insights,
        recommendations,
        spreadsheetUrl: ss.getUrl()
      };
      
    } catch (e) {
      Logger.log(`❌ Error generating insights: ${e.toString()}`);
      return null;
    }
  }
  
  /**
   * Analyze label patterns for actionable categories
   * @private
   */
  _analyzeLabelPatterns(ss) {
    const insights = [];
    const charsSheet = ss.getSheetByName('Characteristics');
    
    if (!charsSheet || charsSheet.getLastRow() <= 1) {
      return insights;
    }
    
    // Get all data
    const data = charsSheet.getRange(
      2, 1, 
      Math.min(charsSheet.getLastRow() - 1, 10000), 
      8
    ).getValues();
    
    // Aggregate by label
    const labelStats = {};
    
    data.forEach(row => {
      const [label, month, threads, messages, urgent, questions, actions, attachments] = row;
      
      if (!label) return;
      
      if (!labelStats[label]) {
        labelStats[label] = {
          totalThreads: 0,
          totalMessages: 0,
          months: new Set(),
          urgentSum: 0,
          questionSum: 0,
          actionSum: 0,
          attachmentSum: 0,
          dataPoints: 0
        };
      }
      
      const stats = labelStats[label];
      stats.totalThreads += threads || 0;
      stats.totalMessages += messages || 0;
      stats.months.add(month);
      stats.urgentSum += parseFloat(urgent) || 0;
      stats.questionSum += parseFloat(questions) || 0;
      stats.actionSum += parseFloat(actions) || 0;
      stats.attachmentSum += parseFloat(attachments) || 0;
      stats.dataPoints++;
    });
    
    // Find high-action labels
    const actionLabels = Object.entries(labelStats)
      .map(([label, stats]) => ({
        label,
        avgAction: stats.actionSum / stats.dataPoints,
        totalThreads: stats.totalThreads
      }))
      .filter(item => item.avgAction > 30 && item.totalThreads > 10)
      .sort((a, b) => b.avgAction - a.avgAction)
      .slice(0, 10);
    
    actionLabels.forEach(item => {
      insights.push({
        category: 'Label Pattern',
        type: 'High Action',
        label: item.label,
        value: `${item.avgAction.toFixed(1)}% action rate`,
        threads: item.totalThreads,
        priority: item.avgAction > 50 ? 'HIGH' : 'MEDIUM'
      });
    });
    
    // Find high-volume labels
    const volumeLabels = Object.entries(labelStats)
      .map(([label, stats]) => ({
        label,
        totalThreads: stats.totalThreads,
        avgMessages: stats.totalMessages / stats.totalThreads
      }))
      .sort((a, b) => b.totalThreads - a.totalThreads)
      .slice(0, 10);
    
    volumeLabels.forEach(item => {
      insights.push({
        category: 'Label Pattern',
        type: 'High Volume',
        label: item.label,
        value: `${item.totalThreads.toLocaleString()} threads`,
        avgMessages: item.avgMessages.toFixed(1),
        priority: item.totalThreads > 1000 ? 'HIGH' : 'MEDIUM'
      });
    });
    
    return insights;
  }
  
  /**
   * Analyze temporal patterns
   * @private
   */
  _analyzeTemporalPatterns(ss) {
    const insights = [];
    const timeSheet = ss.getSheetByName('Time Patterns');
    
    if (!timeSheet || timeSheet.getLastRow() <= 1) {
      return insights;
    }
    
    const data = timeSheet.getRange(
      2, 1,
      Math.min(timeSheet.getLastRow() - 1, 5000),
      5
    ).getValues();
    
    // Aggregate by hour and day
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    
    data.forEach(row => {
      const [label, month, hour, day, count] = row;
      if (hour !== null && hour !== '') {
        hourCounts[parseInt(hour)] += count || 0;
      }
      if (day !== null && day !== '') {
        dayCounts[parseInt(day)] += count || 0;
      }
    });
    
    // Find peak hours
    const peakHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    
    peakHours.forEach(item => {
      const hourStr = item.hour < 12 ? `${item.hour || 12}AM` : 
                      item.hour === 12 ? '12PM' : `${item.hour - 12}PM`;
      insights.push({
        category: 'Temporal',
        type: 'Peak Hour',
        value: `${hourStr} (${item.count.toLocaleString()} messages)`,
        priority: 'LOW'
      });
    });
    
    // Find peak days
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const peakDays = dayCounts
      .map((count, day) => ({ day: dayNames[day], count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 2);
    
    peakDays.forEach(item => {
      insights.push({
        category: 'Temporal',
        type: 'Peak Day',
        value: `${item.day} (${item.count.toLocaleString()} messages)`,
        priority: 'LOW'
      });
    });
    
    return insights;
  }
  
  /**
   * Analyze sender patterns
   * @private
   */
  _analyzeSenderPatterns(ss) {
    const insights = [];
    const sendersSheet = ss.getSheetByName('Senders');
    
    if (!sendersSheet || sendersSheet.getLastRow() <= 1) {
      return insights;
    }
    
    const data = sendersSheet.getRange(
      2, 1,
      Math.min(sendersSheet.getLastRow() - 1, 5000),
      6
    ).getValues();
    
    // Aggregate by domain and internal/external
    const domains = {};
    let internalTotal = 0;
    let externalTotal = 0;
    
    data.forEach(row => {
      const [label, month, hash, domain, count, isInternal] = row;
      
      if (domain) {
        domains[domain] = (domains[domain] || 0) + (count || 1);
      }
      
      if (isInternal === true || isInternal === 'TRUE') {
        internalTotal += count || 1;
      } else {
        externalTotal += count || 1;
      }
    });
    
    // Top domains
    const topDomains = Object.entries(domains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    topDomains.forEach(([domain, count]) => {
      insights.push({
        category: 'Sender',
        type: 'Top Domain',
        value: domain,
        count: count,
        priority: count > 500 ? 'HIGH' : 'MEDIUM'
      });
    });
    
    // Internal vs External ratio
    const totalMessages = internalTotal + externalTotal;
    if (totalMessages > 0) {
      insights.push({
        category: 'Sender',
        type: 'Internal Ratio',
        value: `${Math.round((internalTotal / totalMessages) * 100)}% internal`,
        internal: internalTotal,
        external: externalTotal,
        priority: 'MEDIUM'
      });
    }
    
    return insights;
  }
  
  /**
   * Analyze keyword clusters
   * @private
   */
  _analyzeKeywordClusters(ss) {
    const insights = [];
    const keywordsSheet = ss.getSheetByName('Keywords');
    
    if (!keywordsSheet || keywordsSheet.getLastRow() <= 1) {
      return insights;
    }
    
    const data = keywordsSheet.getRange(
      2, 1,
      Math.min(keywordsSheet.getLastRow() - 1, 5000),
      5
    ).getValues();
    
    // Find keywords that appear across multiple labels (cross-cutting themes)
    const keywordLabels = {};
    
    data.forEach(row => {
      const [label, month, keyword, count, rank] = row;
      
      if (!keyword || !label) return;
      
      if (!keywordLabels[keyword]) {
        keywordLabels[keyword] = {
          labels: new Set(),
          totalCount: 0
        };
      }
      
      keywordLabels[keyword].labels.add(label);
      keywordLabels[keyword].totalCount += count || 0;
    });
    
    // Find cross-cutting keywords
    const crossCutting = Object.entries(keywordLabels)
      .filter(([keyword, info]) => info.labels.size >= 3)
      .map(([keyword, info]) => ({
        keyword,
        labelCount: info.labels.size,
        totalCount: info.totalCount,
        labels: Array.from(info.labels).slice(0, 5)
      }))
      .sort((a, b) => b.labelCount - a.labelCount)
      .slice(0, 20);
    
    crossCutting.forEach(item => {
      insights.push({
        category: 'Keyword',
        type: 'Cross-Cutting Theme',
        keyword: item.keyword,
        value: `Appears in ${item.labelCount} labels`,
        labels: item.labels,
        count: item.totalCount,
        priority: item.labelCount > 5 ? 'HIGH' : 'MEDIUM'
      });
    });
    
    return insights;
  }
  
  /**
   * Generate actionable recommendations
   * @private
   */
  _generateRecommendations(insights) {
    const recommendations = [];
    
    // High-action labels recommendation
    const highActionLabels = insights
      .filter(i => i.type === 'High Action' && i.priority === 'HIGH')
      .map(i => i.label);
    
    if (highActionLabels.length > 0) {
      recommendations.push({
        type: 'Triage Configuration',
        priority: 'HIGH',
        title: 'Configure High-Priority Labels',
        description: `Add these labels to your triage system's high-priority list: ${highActionLabels.join(', ')}`,
        labels: highActionLabels
      });
    }
    
    // High-volume domains recommendation
    const highVolumeDomains = insights
      .filter(i => i.type === 'Top Domain' && i.priority === 'HIGH')
      .map(i => i.value);
    
    if (highVolumeDomains.length > 0) {
      recommendations.push({
        type: 'Sender Management',
        priority: 'MEDIUM',
        title: 'Review High-Volume Domains',
        description: `Consider adding filters or VIP status for: ${highVolumeDomains.slice(0, 5).join(', ')}`,
        domains: highVolumeDomains
      });
    }
    
    // Cross-cutting keywords recommendation
    const crossCuttingKeywords = insights
      .filter(i => i.type === 'Cross-Cutting Theme' && i.priority === 'HIGH')
      .map(i => i.keyword);
    
    if (crossCuttingKeywords.length > 0) {
      recommendations.push({
        type: 'Keyword Rules',
        priority: 'MEDIUM',
        title: 'Universal Keyword Triggers',
        description: `These keywords appear across many labels and could be used for universal rules: ${crossCuttingKeywords.slice(0, 10).join(', ')}`,
        keywords: crossCuttingKeywords
      });
    }
    
    return recommendations;
  }
  
  /**
   * Save insights to spreadsheet
   * @private
   */
  _saveInsights(ss, insights, recommendations) {
    // Ensure Insights sheet exists
    let insightsSheet = ss.getSheetByName('Insights');
    if (!insightsSheet) {
      insightsSheet = ss.insertSheet('Insights');
      insightsSheet.getRange('A1:E1').setValues([['Category', 'Type', 'Value', 'Priority', 'Timestamp']]);
      insightsSheet.setFrozenRows(1);
    }
    
    // Clear existing insights
    if (insightsSheet.getLastRow() > 1) {
      insightsSheet.getRange(2, 1, insightsSheet.getLastRow() - 1, 5).clear();
    }
    
    // Prepare data
    const timestamp = new Date();
    const insightData = insights.map(i => [
      i.category,
      i.type,
      typeof i.value === 'object' ? JSON.stringify(i.value) : i.value,
      i.priority || 'MEDIUM',
      timestamp
    ]);
    
    // Write insights
    if (insightData.length > 0) {
      insightsSheet.getRange(2, 1, insightData.length, 5).setValues(insightData);
    }
    
    // Create Recommendations sheet
    let recsSheet = ss.getSheetByName('Recommendations');
    if (!recsSheet) {
      recsSheet = ss.insertSheet('Recommendations');
      recsSheet.getRange('A1:D1').setValues([['Type', 'Priority', 'Title', 'Description']]);
      recsSheet.setFrozenRows(1);
    }
    
    // Clear and write recommendations
    if (recsSheet.getLastRow() > 1) {
      recsSheet.getRange(2, 1, recsSheet.getLastRow() - 1, 4).clear();
    }
    
    if (recommendations.length > 0) {
      const recData = recommendations.map(r => [
        r.type,
        r.priority,
        r.title,
        r.description
      ]);
      recsSheet.getRange(2, 1, recData.length, 4).setValues(recData);
    }
  }
  
  /**
   * Log insight summary
   * @private
   */
  _logInsightSummary(insights, recommendations) {
    Logger.log('\n📊 INSIGHT SUMMARY:');
    
    // Group insights by category
    const byCategory = {};
    insights.forEach(i => {
      if (!byCategory[i.category]) {
        byCategory[i.category] = [];
      }
      byCategory[i.category].push(i);
    });
    
    // Log by category
    Object.entries(byCategory).forEach(([category, items]) => {
      Logger.log(`\n${category}:`);
      items.slice(0, 5).forEach(item => {
        if (item.type === 'High Action') {
          Logger.log(`  • ${item.label}: ${item.value}`);
        } else if (item.type === 'Cross-Cutting Theme') {
          Logger.log(`  • "${item.keyword}": ${item.value}`);
        } else {
          Logger.log(`  • ${item.type}: ${item.value}`);
        }
      });
    });
    
    // Log recommendations
    if (recommendations.length > 0) {
      Logger.log('\n🎯 TOP RECOMMENDATIONS:');
      recommendations.forEach((rec, i) => {
        Logger.log(`\n${i + 1}. [${rec.priority}] ${rec.title}`);
        Logger.log(`   ${rec.description}`);
      });
    }
    
    Logger.log('\n✅ Insights saved to spreadsheet');
  }
}

// ==================== EXPORT FUNCTIONS ====================

/**
 * Export data formatted for the triage system
 */
function exportForTriage() {
  Logger.log('=== EXPORTING DATA FOR TRIAGE SYSTEM ===\n');
  
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('ANALYSIS_SHEET_ID');
  
  if (!sheetId) {
    Logger.log('❌ No spreadsheet configured. Run reconnectToSpreadsheet() first.');
    return null;
  }
  
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    
    // Log the configuration needed for triage
    Logger.log('📋 TRIAGE CONFIGURATION:');
    Logger.log('\nAdd these to your triage script properties:');
    Logger.log(`  ANALYSIS_SHEET_ID: ${sheetId}`);
    
    const piiSalt = props.getProperty('PII_SALT');
    if (piiSalt) {
      Logger.log(`  PII_SALT: ${piiSalt}`);
    } else {
      Logger.log('  PII_SALT: [Generate new or copy from original]');
    }
    
    Logger.log(`\n📊 Spreadsheet URL: ${ss.getUrl()}`);
    
    // Get data statistics
    const stats = {
      keywords: 0,
      senders: 0,
      labels: new Set(),
      months: new Set()
    };
    
    const keywordsSheet = ss.getSheetByName('Keywords');
    if (keywordsSheet) {
      stats.keywords = keywordsSheet.getLastRow() - 1;
    }
    
    const sendersSheet = ss.getSheetByName('Senders');
    if (sendersSheet) {
      stats.senders = sendersSheet.getLastRow() - 1;
    }
    
    const charsSheet = ss.getSheetByName('Characteristics');
    if (charsSheet && charsSheet.getLastRow() > 1) {
      const data = charsSheet.getRange(
        2, 1,
        Math.min(charsSheet.getLastRow() - 1, 5000),
        2
      ).getValues();
      
      data.forEach(row => {
        if (row[0]) stats.labels.add(row[0]);
        if (row[1]) stats.months.add(row[1]);
      });
    }
    
    Logger.log('\n📈 DATA AVAILABLE FOR TRIAGE:');
    Logger.log(`  Keywords: ${stats.keywords.toLocaleString()}`);
    Logger.log(`  Senders: ${stats.senders.toLocaleString()}`);
    Logger.log(`  Labels: ${stats.labels.size}`);
    Logger.log(`  Time Range: ${stats.months.size} months`);
    
    Logger.log('\n✅ Ready for triage integration!');
    Logger.log('\nNEXT STEPS:');
    Logger.log('1. Copy the configuration values above');
    Logger.log('2. Open your triage script');
    Logger.log('3. Add the values to Script Properties');
    Logger.log('4. Run testHistoricalIntelligence() in triage script');
    
    return {
      spreadsheetId: sheetId,
      spreadsheetUrl: ss.getUrl(),
      piiSalt: piiSalt,
      stats: {
        keywords: stats.keywords,
        senders: stats.senders,
        labels: stats.labels.size,
        months: stats.months.size
      }
    };
    
  } catch (e) {
    Logger.log(`❌ Error: ${e.toString()}`);
    return null;
  }
}

// ==================== PUBLIC API FUNCTIONS ====================

/**
 * Run complete diagnostics
 */
function runDiagnostics() {
  const diagnostics = new AnalysisDiagnostics();
  return diagnostics.runDiagnostics();
}

/**
 * Generate enhanced insights
 */
function generateEnhancedInsights() {
  const engine = new EnhancedInsightEngine();
  return engine.generateInsights();
}

/**
 * Quick fix function - attempts to resolve common issues
 */
function quickFix() {
  Logger.log('=== RUNNING QUICK FIX ===\n');
  
  // Run diagnostics first
  const diagnostics = new AnalysisDiagnostics();
  const results = diagnostics.runDiagnostics();
  
  // Apply fixes based on recommendations
  let fixesApplied = 0;
  
  results.recommendations.forEach(rec => {
    if (rec.action.includes('reconnectToSpreadsheet')) {
      Logger.log('\n📋 Please provide your spreadsheet URL:');
      Logger.log('Run: reconnectToSpreadsheet("YOUR_SPREADSHEET_URL")');
    } else if (rec.action.includes('repairSpreadsheetStructure')) {
      Logger.log('\n🔧 Repairing spreadsheet structure...');
      if (repairSpreadsheetStructure()) {
        fixesApplied++;
      }
    }
  });
  
  if (fixesApplied > 0) {
    Logger.log(`\n✅ Applied ${fixesApplied} fixes`);
  } else if (results.recommendations.length === 0) {
    Logger.log('\n✅ No issues found!');
  }
  
  return fixesApplied;
}

/**
 * Menu creation for spreadsheet UI
 */
function onOpen() {
  try {
    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getUi) {
      SpreadsheetApp.getUi()
        .createMenu('📧 Analysis Tools')
        .addItem('🔍 Run Diagnostics', 'runDiagnostics')
        .addItem('🔗 Reconnect Spreadsheet', 'promptReconnect')
        .addItem('🔧 Repair Structure', 'repairSpreadsheetStructure')
        .addSeparator()
        .addItem('💡 Generate Insights', 'generateEnhancedInsights')
        .addItem('📤 Export for Triage', 'exportForTriage')
        .addSeparator()
        .addItem('⚡ Quick Fix', 'quickFix')
        .addToUi();
    }
  } catch (e) {
    // Standalone environment
  }
}

/**
 * UI helper for reconnection
 */
function promptReconnect() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Reconnect to Spreadsheet',
    'Enter the URL of your analysis spreadsheet:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const url = response.getResponseText();
    if (reconnectToSpreadsheet(url)) {
      ui.alert('Success', 'Reconnected to spreadsheet successfully!', ui.ButtonSet.OK);
    } else {
      ui.alert('Error', 'Could not connect to spreadsheet. Check the logs for details.', ui.ButtonSet.OK);
    }
  }
}

/**
 * Wrapper function to reconnect to YOUR specific spreadsheet
 * Run this function from the Apps Script editor
 */
function reconnectToMySpreadsheet() {
  // Replace this URL with your actual spreadsheet URL
  const mySpreadsheetUrl = "https://docs.google.com/spreadsheets/d/1OIY5GfzoRGDKgZHXTxf2QvDcXesC3-THSjBGZEunnDY/edit";
  
  // Call the reconnect function with your URL
  return reconnectToSpreadsheet(mySpreadsheetUrl);
}

/**
 * After reconnecting, run this to generate insights
 */
function runMyInsights() {
  // First check if connected
  const diagnostics = runDiagnostics();
  
  // Then generate insights if connected
  if (diagnostics.spreadsheet.accessible) {
    return generateEnhancedInsights();
  } else {
    Logger.log("❌ Not connected to spreadsheet yet. Run reconnectToMySpreadsheet() first.");
  }
}

/**
 * Complete workflow - run this for the full process
 */
function runCompleteAnalysis() {
  Logger.log("=== STARTING COMPLETE ANALYSIS WORKFLOW ===\n");
  
  // Step 1: Reconnect
  Logger.log("Step 1: Reconnecting to spreadsheet...");
  reconnectToMySpreadsheet();
  
  // Step 2: Generate insights
  Logger.log("\nStep 2: Generating insights...");
  const insights = generateEnhancedInsights();
  
  // Step 3: Export for triage
  Logger.log("\nStep 3: Exporting configuration for triage...");
  const exportData = exportForTriage();
  
  Logger.log("\n✅ COMPLETE ANALYSIS WORKFLOW FINISHED!");
  return { insights, exportData };
}

/**
 * Triage Preparation & Optimization Module
 * Version 1.0 - Pre-flight checks and intelligent configuration
 * 
 * This module prepares your analysis data specifically for triage system integration,
 * generating actionable patterns that improve classification accuracy.
 * 
 * @author G-Script Architect
 * @requires Completed analysis spreadsheet with historical data
 */

// ==================== TRIAGE PREPARATION ENGINE ====================
/**
 * Specialized analyzer for triage system preparation
 */
class TriagePreparation {
  constructor() {
    this.props = PropertiesService.getScriptProperties();
    this.sheetId = this.props.getProperty('ANALYSIS_SHEET_ID');
    this.piiSalt = this.props.getProperty('PII_SALT');
    
    // Triage-relevant label categories
    this.actionLabels = new Set([
      'Action_Required', 'Action_Required/Later', 'Action_Required/This_Week',
      'Action_Required/Urgent', '_LLM/Action-Needed-Reply', '_LLM/Action-Needed-Task',
      'Reply', 'Task', 'To-Do'
    ]);
    
    this.studentLabels = new Set([
      'Student', 'Students', '_LLM/Student-Message',
      'Student Evaluations', 'Letters of Recommendation'
    ]);
    
    this.adminLabels = new Set([
      'Admin/Dept', '_LLM/Admin-Dept', 'KPC Admin', 'UAA',
      'UAA/Admin', 'UAA/Math Dept', 'UA', 'UA/Admin'
    ]);
  }
  
  /**
   * Run complete triage preparation
   */
  runPreparation() {
    Logger.log('=== TRIAGE SYSTEM PREPARATION ===\n');
    
    if (!this.sheetId) {
      Logger.log('❌ No spreadsheet configured. Run reconnectToSpreadsheet() first.');
      return null;
    }
    
    try {
      const ss = SpreadsheetApp.openById(this.sheetId);
      
      // Step 1: Validate data completeness
      Logger.log('📊 Step 1: Validating Data Completeness...');
      const validation = this._validateData(ss);
      
      if (!validation.ready) {
        Logger.log('\n❌ Data validation failed. See issues above.');
        return null;
      }
      
      // Step 2: Generate classification patterns
      Logger.log('\n🔍 Step 2: Analyzing Classification Patterns...');
      const patterns = this._analyzeClassificationPatterns(ss);
      
      // Step 3: Identify VIP and priority senders
      Logger.log('\n👤 Step 3: Identifying VIP Senders...');
      const vipAnalysis = this._analyzeVIPSenders(ss);
      
      // Step 4: Generate keyword rules
      Logger.log('\n📝 Step 4: Building Keyword Rules...');
      const keywordRules = this._generateKeywordRules(ss);
      
      // Step 5: Create triage configuration
      Logger.log('\n⚙️ Step 5: Creating Triage Configuration...');
      const config = this._generateTriageConfig(patterns, vipAnalysis, keywordRules);
      
      // Step 6: Save configuration
      this._saveTriageConfig(ss, config);
      
      // Step 7: Generate implementation instructions
      this._generateImplementationGuide(config);
      
      return config;
      
    } catch (e) {
      Logger.log(`❌ Error: ${e.toString()}`);
      return null;
    }
  }
  
  /**
   * Validate data completeness for triage
   * @private
   */
  _validateData(ss) {
    const issues = [];
    const warnings = [];
    
    // Check required sheets
    const requiredSheets = ['Keywords', 'Senders', 'Characteristics'];
    const sheets = {};
    
    for (const sheetName of requiredSheets) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        issues.push(`Missing required sheet: ${sheetName}`);
      } else {
        const rows = sheet.getLastRow() - 1;
        sheets[sheetName] = rows;
        if (rows < 100) {
          warnings.push(`Low data in ${sheetName}: only ${rows} rows`);
        }
      }
    }
    
    // Check for minimum viable data
    const charsSheet = ss.getSheetByName('Characteristics');
    if (charsSheet) {
      const labelData = charsSheet.getRange(
        2, 1,
        Math.min(charsSheet.getLastRow() - 1, 1000),
        1
      ).getValues();
      
      const uniqueLabels = new Set(labelData.map(r => r[0]).filter(l => l));
      
      if (uniqueLabels.size < 10) {
        warnings.push(`Only ${uniqueLabels.size} unique labels found (recommend 10+)`);
      }
      
      Logger.log(`  ✓ Found ${uniqueLabels.size} unique labels`);
      Logger.log(`  ✓ Keywords: ${sheets['Keywords'] || 0} entries`);
      Logger.log(`  ✓ Senders: ${sheets['Senders'] || 0} entries`);
    }
    
    // Log issues and warnings
    if (issues.length > 0) {
      Logger.log('\n❌ CRITICAL ISSUES:');
      issues.forEach(i => Logger.log(`  • ${i}`));
    }
    
    if (warnings.length > 0) {
      Logger.log('\n⚠️ WARNINGS:');
      warnings.forEach(w => Logger.log(`  • ${w}`));
    }
    
    return {
      ready: issues.length === 0,
      issues,
      warnings,
      stats: sheets
    };
  }
  
  /**
   * Analyze classification patterns for triage
   * @private
   */
  _analyzeClassificationPatterns(ss) {
    const patterns = {
      labelCorrelations: {},
      monthlyTrends: {},
      actionIndicators: [],
      autoArchiveCandidates: []
    };
    
    const charsSheet = ss.getSheetByName('Characteristics');
    if (!charsSheet) return patterns;
    
    const data = charsSheet.getRange(
      2, 1,
      Math.min(charsSheet.getLastRow() - 1, 5000),
      8
    ).getValues();
    
    // Analyze each label's characteristics
    const labelProfiles = {};
    
    data.forEach(row => {
      const [label, month, threads, messages, urgent, questions, actions, attachments] = row;
      
      if (!label) return;
      
      if (!labelProfiles[label]) {
        labelProfiles[label] = {
          totalThreads: 0,
          avgUrgent: [],
          avgQuestions: [],
          avgActions: [],
          avgAttachments: [],
          months: new Set()
        };
      }
      
      const profile = labelProfiles[label];
      profile.totalThreads += threads || 0;
      profile.months.add(month);
      
      if (urgent) profile.avgUrgent.push(parseFloat(urgent));
      if (questions) profile.avgQuestions.push(parseFloat(questions));
      if (actions) profile.avgActions.push(parseFloat(actions));
      if (attachments) profile.avgAttachments.push(parseFloat(attachments));
    });
    
    // Calculate averages and identify patterns
    Object.entries(labelProfiles).forEach(([label, profile]) => {
      const avgAction = profile.avgActions.length > 0 
        ? profile.avgActions.reduce((a, b) => a + b, 0) / profile.avgActions.length
        : 0;
      
      const avgUrgent = profile.avgUrgent.length > 0
        ? profile.avgUrgent.reduce((a, b) => a + b, 0) / profile.avgUrgent.length
        : 0;
      
      // High action labels (need attention)
      if (avgAction > 30 && profile.totalThreads > 20) {
        patterns.actionIndicators.push({
          label,
          actionRate: avgAction.toFixed(1),
          urgentRate: avgUrgent.toFixed(1),
          volume: profile.totalThreads,
          priority: avgAction > 50 ? 'HIGH' : 'MEDIUM'
        });
      }
      
      // Low action, high volume (auto-archive candidates)
      if (avgAction < 10 && profile.totalThreads > 50) {
        patterns.autoArchiveCandidates.push({
          label,
          actionRate: avgAction.toFixed(1),
          volume: profile.totalThreads
        });
      }
    });
    
    // Sort by priority
    patterns.actionIndicators.sort((a, b) => parseFloat(b.actionRate) - parseFloat(a.actionRate));
    patterns.autoArchiveCandidates.sort((a, b) => b.volume - a.volume);
    
    return patterns;
  }
  
  /**
   * Analyze VIP senders based on interaction patterns
   * @private
   */
  _analyzeVIPSenders(ss) {
    const vipAnalysis = {
      frequentSenders: [],
      actionRequiringSenders: [],
      internalVIPs: [],
      suggestedDomains: []
    };
    
    const sendersSheet = ss.getSheetByName('Senders');
    if (!sendersSheet) return vipAnalysis;
    
    const data = sendersSheet.getRange(
      2, 1,
      Math.min(sendersSheet.getLastRow() - 1, 3000),
      6
    ).getValues();
    
    // Aggregate by sender and domain
    const senderProfiles = {};
    const domainStats = {};
    
    data.forEach(row => {
      const [label, month, senderHash, domain, count, isInternal] = row;
      
      if (!senderHash || !label) return;
      
      // Track sender patterns
      if (!senderProfiles[senderHash]) {
        senderProfiles[senderHash] = {
          domain,
          isInternal,
          labels: {},
          totalCount: 0
        };
      }
      
      senderProfiles[senderHash].labels[label] = 
        (senderProfiles[senderHash].labels[label] || 0) + (count || 1);
      senderProfiles[senderHash].totalCount += count || 1;
      
      // Track domain patterns
      if (domain) {
        if (!domainStats[domain]) {
          domainStats[domain] = {
            totalCount: 0,
            actionLabels: 0,
            isInternal
          };
        }
        
        domainStats[domain].totalCount += count || 1;
        if (this.actionLabels.has(label)) {
          domainStats[domain].actionLabels += count || 1;
        }
      }
    });
    
    // Identify VIP senders (high volume + action labels)
    Object.entries(senderProfiles).forEach(([hash, profile]) => {
      const actionCount = Object.entries(profile.labels)
        .filter(([label, _]) => this.actionLabels.has(label))
        .reduce((sum, [_, count]) => sum + count, 0);
      
      const actionRatio = actionCount / profile.totalCount;
      
      // High action ratio senders
      if (actionRatio > 0.5 && profile.totalCount > 5) {
        vipAnalysis.actionRequiringSenders.push({
          hash,
          domain: profile.domain,
          actionRatio: (actionRatio * 100).toFixed(1),
          totalCount: profile.totalCount
        });
      }
      
      // Frequent internal senders
      if (profile.isInternal && profile.totalCount > 20) {
        vipAnalysis.internalVIPs.push({
          hash,
          domain: profile.domain,
          totalCount: profile.totalCount
        });
      }
    });
    
    // Identify important domains
    Object.entries(domainStats)
      .filter(([domain, stats]) => stats.totalCount > 50)
      .sort((a, b) => b[1].actionLabels - a[1].actionLabels)
      .slice(0, 10)
      .forEach(([domain, stats]) => {
        const actionRatio = (stats.actionLabels / stats.totalCount * 100).toFixed(1);
        vipAnalysis.suggestedDomains.push({
          domain,
          totalCount: stats.totalCount,
          actionRatio,
          type: stats.isInternal ? 'INTERNAL' : 'EXTERNAL'
        });
      });
    
    return vipAnalysis;
  }
  
  /**
   * Generate keyword rules for classification
   * @private
   */
  _generateKeywordRules(ss) {
    const rules = {
      actionKeywords: [],
      studentKeywords: [],
      adminKeywords: [],
      labelSpecificKeywords: {}
    };
    
    const keywordsSheet = ss.getSheetByName('Keywords');
    if (!keywordsSheet) return rules;
    
    const data = keywordsSheet.getRange(
      2, 1,
      Math.min(keywordsSheet.getLastRow() - 1, 3000),
      5
    ).getValues();
    
    // Aggregate keywords by label category
    const keywordStats = {};
    
    data.forEach(row => {
      const [label, month, keyword, count, rank] = row;
      
      if (!keyword || !label || keyword.length < 3) return;
      
      if (!keywordStats[keyword]) {
        keywordStats[keyword] = {
          actionCount: 0,
          studentCount: 0,
          adminCount: 0,
          labels: new Set(),
          totalCount: 0
        };
      }
      
      const stats = keywordStats[keyword];
      stats.labels.add(label);
      stats.totalCount += count || 1;
      
      if (this.actionLabels.has(label)) {
        stats.actionCount += count || 1;
      }
      if (this.studentLabels.has(label)) {
        stats.studentCount += count || 1;
      }
      if (this.adminLabels.has(label)) {
        stats.adminCount += count || 1;
      }
    });
    
    // Generate category-specific keyword lists
    Object.entries(keywordStats).forEach(([keyword, stats]) => {
      // Skip common words that aren't meaningful
      if (stats.labels.size > 10) return;
      
      // Action keywords (strong indicators)
      if (stats.actionCount > 10 && stats.actionCount / stats.totalCount > 0.6) {
        rules.actionKeywords.push({
          keyword,
          confidence: Math.round(stats.actionCount / stats.totalCount * 100),
          occurrences: stats.actionCount
        });
      }
      
      // Student keywords
      if (stats.studentCount > 10 && stats.studentCount / stats.totalCount > 0.6) {
        rules.studentKeywords.push({
          keyword,
          confidence: Math.round(stats.studentCount / stats.totalCount * 100),
          occurrences: stats.studentCount
        });
      }
      
      // Admin keywords
      if (stats.adminCount > 10 && stats.adminCount / stats.totalCount > 0.6) {
        rules.adminKeywords.push({
          keyword,
          confidence: Math.round(stats.adminCount / stats.totalCount * 100),
          occurrences: stats.adminCount
        });
      }
    });
    
    // Sort by confidence
    rules.actionKeywords.sort((a, b) => b.confidence - a.confidence);
    rules.studentKeywords.sort((a, b) => b.confidence - a.confidence);
    rules.adminKeywords.sort((a, b) => b.confidence - a.confidence);
    
    // Limit to top keywords
    rules.actionKeywords = rules.actionKeywords.slice(0, 20);
    rules.studentKeywords = rules.studentKeywords.slice(0, 20);
    rules.adminKeywords = rules.adminKeywords.slice(0, 20);
    
    return rules;
  }
  
  /**
   * Generate triage configuration
   * @private
   */
  _generateTriageConfig(patterns, vipAnalysis, keywordRules) {
  const config = {
    timestamp: new Date().toISOString(),
    spreadsheetId: this.sheetId,
    piiSalt: this.piiSalt,
    
    // Priority labels for deep analysis
    priorityLabels: patterns.actionIndicators
      .filter(p => p.priority === 'HIGH')
      .map(p => p.label),
    
    // Auto-archive labels
    autoArchiveLabels: patterns.autoArchiveCandidates
      .slice(0, 10)
      .map(c => c.label),
    
    // VIP configuration
    vipDomains: vipAnalysis.suggestedDomains
      .filter(d => parseFloat(d.actionRatio) > 30)
      .map(d => d.domain),
    
    // Keyword triggers - FIXED: using keywordRules instead of rules
    urgentKeywords: [
      ...keywordRules.actionKeywords.slice(0, 10).map(k => k.keyword),
      'urgent', 'asap', 'deadline', 'immediately'
    ].filter((v, i, a) => a.indexOf(v) === i), // Remove duplicates
    
    studentKeywords: keywordRules.studentKeywords.slice(0, 10).map(k => k.keyword),
    
    // Classification hints - FIXED: using keywordRules
    classificationHints: {
      actionIndicators: keywordRules.actionKeywords.slice(0, 5),
      studentIndicators: keywordRules.studentKeywords.slice(0, 5),
      adminIndicators: keywordRules.adminKeywords.slice(0, 5)
    },
    
    // Statistics - FIXED: using keywordRules
    stats: {
      totalPatterns: patterns.actionIndicators.length,
      vipSenders: vipAnalysis.actionRequiringSenders.length,
      keywordRules: keywordRules.actionKeywords.length + keywordRules.studentKeywords.length
    }
  };
  
  return config;

}
  /**
   * Save configuration to spreadsheet
   * @private
   */
  _saveTriageConfig(ss, config) {
    // Create or get Triage Config sheet
    let configSheet = ss.getSheetByName('Triage Config');
    if (!configSheet) {
      configSheet = ss.insertSheet('Triage Config');
    }
    
    // Clear existing content
    configSheet.clear();
    
    // Write configuration
    const configData = [
      ['TRIAGE CONFIGURATION', new Date()],
      [''],
      ['Setting', 'Value'],
      ['Spreadsheet ID', config.spreadsheetId],
      ['PII Salt', config.piiSalt || 'Not configured'],
      ['Generated', config.timestamp],
      [''],
      ['PRIORITY LABELS (High Action)', ''],
      ...config.priorityLabels.map(l => ['', l]),
      [''],
      ['AUTO-ARCHIVE LABELS (Low Action)', ''],
      ...config.autoArchiveLabels.map(l => ['', l]),
      [''],
      ['VIP DOMAINS', ''],
      ...config.vipDomains.map(d => ['', d]),
      [''],
      ['URGENT KEYWORDS', ''],
      ...config.urgentKeywords.map(k => ['', k]),
      [''],
      ['STATISTICS', ''],
      ['Action Patterns', config.stats.totalPatterns],
      ['VIP Senders', config.stats.vipSenders],
      ['Keyword Rules', config.stats.keywordRules]
    ];
    
    configSheet.getRange(1, 1, configData.length, 2).setValues(configData);
    
    // Format headers
    configSheet.getRange('A1:B1').setFontWeight('bold').setFontSize(14);
    configSheet.getRange('A3:B3').setFontWeight('bold');
    configSheet.getRange('A8').setFontWeight('bold');
    configSheet.getRange('A11').setFontWeight('bold');
    configSheet.getRange('A14').setFontWeight('bold');
    configSheet.getRange('A17').setFontWeight('bold');
    configSheet.getRange('A20').setFontWeight('bold');
    
    // Auto-resize columns
    configSheet.autoResizeColumns(1, 2);
  }
  
  /**
   * Generate implementation guide
   * @private
   */
  _generateImplementationGuide(config) {
    Logger.log('\n' + '='.repeat(60));
    Logger.log('📋 TRIAGE SYSTEM CONFIGURATION GUIDE');
    Logger.log('='.repeat(60));
    
    Logger.log('\n1️⃣ ADD TO TRIAGE SCRIPT PROPERTIES:');
    Logger.log('   ANALYSIS_SHEET_ID: ' + config.spreadsheetId);
    if (config.piiSalt) {
      Logger.log('   PII_SALT: ' + config.piiSalt);
    }
    
    if (config.vipDomains.length > 0) {
      Logger.log('\n2️⃣ ADD TO VIP CONFIGURATION:');
      Logger.log('   TRIAGE_VIP_DOMAINS: ' + config.vipDomains.slice(0, 5).join(','));
    }
    
    if (config.urgentKeywords.length > 0) {
      Logger.log('\n3️⃣ UPDATE URGENT KEYWORDS:');
      Logger.log('   TRIAGE_DEEP_KEYWORDS: ' + config.urgentKeywords.slice(0, 10).join(','));
    }
    
    Logger.log('\n4️⃣ RECOMMENDED LABEL POLICIES:');
    
    if (config.priorityLabels.length > 0) {
      Logger.log('\n   High Priority (never auto-archive):');
      config.priorityLabels.slice(0, 5).forEach(l => {
        Logger.log(`   • ${l}`);
      });
    }
    
    if (config.autoArchiveLabels.length > 0) {
      Logger.log('\n   Safe to Auto-Archive:');
      config.autoArchiveLabels.slice(0, 5).forEach(l => {
        Logger.log(`   • ${l}`);
      });
    }
    
    Logger.log('\n5️⃣ CLASSIFICATION IMPROVEMENTS:');
    Logger.log('\n   Action Keywords (add to prompts):');
    config.classificationHints.actionIndicators.forEach(k => {
      Logger.log(`   • "${k.keyword}" → Action-Needed (${k.confidence}% confidence)`);
    });
    
    Logger.log('\n   Student Keywords:');
    config.classificationHints.studentIndicators.forEach(k => {
      Logger.log(`   • "${k.keyword}" → Student-Message (${k.confidence}% confidence)`);
    });
    
    Logger.log('\n' + '='.repeat(60));
    Logger.log('✅ CONFIGURATION COMPLETE');
    Logger.log('Next: Copy settings above to your triage script');
    Logger.log('='.repeat(60));
  }
}

// ==================== QUICK DIAGNOSTIC FOR TRIAGE ====================

/**
 * Quick check if system is ready for triage
 */
function checkTriageReadiness() {
  Logger.log('=== TRIAGE READINESS CHECK ===\n');
  
  const checks = {
    spreadsheet: false,
    data: false,
    salt: false,
    patterns: false
  };
  
  const props = PropertiesService.getScriptProperties();
  
  // Check 1: Spreadsheet connection
  const sheetId = props.getProperty('ANALYSIS_SHEET_ID');
  if (sheetId) {
    try {
      const ss = SpreadsheetApp.openById(sheetId);
      checks.spreadsheet = true;
      Logger.log('✅ Spreadsheet connected: ' + ss.getName());
      
      // Check 2: Data presence
      const charsSheet = ss.getSheetByName('Characteristics');
      if (charsSheet && charsSheet.getLastRow() > 100) {
        checks.data = true;
        Logger.log('✅ Sufficient data: ' + (charsSheet.getLastRow() - 1) + ' records');
      } else {
        Logger.log('❌ Insufficient data: Need more email analysis');
      }
      
      // Check 3: PII Salt
      if (props.getProperty('PII_SALT')) {
        checks.salt = true;
        Logger.log('✅ PII Salt configured');
      } else {
        Logger.log('⚠️ PII Salt missing (will generate new)');
      }
      
      // Check 4: Patterns
      const insightsSheet = ss.getSheetByName('Insights');
      const configSheet = ss.getSheetByName('Triage Config');
      
      if (insightsSheet || configSheet) {
        checks.patterns = true;
        Logger.log('✅ Analysis patterns available');
      } else {
        Logger.log('⚠️ No patterns generated yet');
      }
      
    } catch (e) {
      Logger.log('❌ Cannot access spreadsheet: ' + e.toString());
    }
  } else {
    Logger.log('❌ No spreadsheet connected');
  }
  
  // Overall readiness
  const ready = Object.values(checks).every(v => v);
  
  Logger.log('\n' + '='.repeat(40));
  if (ready) {
    Logger.log('✅ READY FOR TRIAGE!');
    Logger.log('Run: prepareForTriage()');
  } else {
    Logger.log('⚠️ NOT READY - Fix issues above');
    if (!checks.spreadsheet) {
      Logger.log('\n1. Run: reconnectToMySpreadsheet()');
    }
    if (!checks.patterns) {
      Logger.log('\n2. Run: prepareForTriage()');
    }
  }
  Logger.log('='.repeat(40));
  
  return checks;
}

// ==================== MAIN ENTRY POINTS ====================

/**
 * Main function to prepare for triage
 */
function prepareForTriage() {
  const prep = new TriagePreparation();
  return prep.runPreparation();
}

/**
 * Complete workflow for triage preparation
 */
function runCompleteTriagePrep() {
  Logger.log('=== COMPLETE TRIAGE PREPARATION WORKFLOW ===\n');
  
  // Step 1: Check readiness
  Logger.log('Step 1: Checking system readiness...');
  const readiness = checkTriageReadiness();
  
  if (!readiness.spreadsheet) {
    Logger.log('\n❌ Spreadsheet not connected. Run reconnectToMySpreadsheet() first.');
    return;
  }
  
  // Step 2: Prepare for triage
  Logger.log('\nStep 2: Generating triage configuration...');
  const config = prepareForTriage();
  
  if (config) {
    Logger.log('\n✅ TRIAGE PREPARATION COMPLETE!');
    Logger.log('Configuration has been saved to your spreadsheet.');
    Logger.log('Follow the implementation guide above to update your triage script.');
  } else {
    Logger.log('\n❌ Preparation failed. Check the logs for details.');
  }
  
  return config;
}

/**
 * Test function to see what patterns we have
 */
function previewTriagePatterns() {
  const prep = new TriagePreparation();
  const ss = SpreadsheetApp.openById(prep.sheetId);
  
  Logger.log('=== PREVIEW: TRIAGE PATTERNS ===\n');
  
  // Get top patterns
  const patterns = prep._analyzeClassificationPatterns(ss);
  
  Logger.log('📊 HIGH ACTION LABELS:');
  patterns.actionIndicators.slice(0, 10).forEach(p => {
    Logger.log(`  ${p.label}: ${p.actionRate}% action rate (${p.volume} threads)`);
  });
  
  Logger.log('\n📦 AUTO-ARCHIVE CANDIDATES:');
  patterns.autoArchiveCandidates.slice(0, 10).forEach(c => {
    Logger.log(`  ${c.label}: ${c.actionRate}% action rate (${c.volume} threads)`);
  });
  
  const keywordRules = prep._generateKeywordRules(ss);
  
  Logger.log('\n🔑 TOP ACTION KEYWORDS:');
  keywordRules.actionKeywords.slice(0, 10).forEach(k => {
    Logger.log(`  "${k.keyword}": ${k.confidence}% confidence`);
  });
  
  Logger.log('\n🎓 TOP STUDENT KEYWORDS:');
  keywordRules.studentKeywords.slice(0, 10).forEach(k => {
    Logger.log(`  "${k.keyword}": ${k.confidence}% confidence`);
  });
}

/**
 * COMPLETE STANDALONE FIX
 * Paste this entire block at the very END of your script
 * This is completely self-contained and won't interfere with existing code
 */
function runTriagePreparationFixed() {
  Logger.log('=== COMPLETE TRIAGE PREPARATION (STANDALONE FIX) ===\n');
  
  try {
    const props = PropertiesService.getScriptProperties();
    const sheetId = props.getProperty('ANALYSIS_SHEET_ID');
    const piiSalt = props.getProperty('PII_SALT');
    
    if (!sheetId) {
      Logger.log('❌ No spreadsheet configured. Run reconnectToSpreadsheet() first.');
      return null;
    }
    
    const ss = SpreadsheetApp.openById(sheetId);
    
    // Step 1: Validate
    Logger.log('📊 Step 1: Validating Data...');
    const charsSheet = ss.getSheetByName('Characteristics');
    const keywordsSheet = ss.getSheetByName('Keywords');
    const sendersSheet = ss.getSheetByName('Senders');
    
    if (!charsSheet || !keywordsSheet || !sendersSheet) {
      Logger.log('❌ Missing required sheets');
      return null;
    }
    
    // Step 2: Analyze patterns
    Logger.log('🔍 Step 2: Analyzing Patterns...');
    
    // Get label statistics
    const labelData = charsSheet.getRange(
      2, 1,
      Math.min(charsSheet.getLastRow() - 1, 5000),
      8
    ).getValues();
    
    const labelStats = {};
    labelData.forEach(row => {
      const [label, month, threads, messages, urgent, questions, actions, attachments] = row;
      if (!label) return;
      
      if (!labelStats[label]) {
        labelStats[label] = {
          threads: 0,
          actionSum: 0,
          count: 0
        };
      }
      
      labelStats[label].threads += threads || 0;
      labelStats[label].actionSum += parseFloat(actions) || 0;
      labelStats[label].count++;
    });
    
    // Find high-action and low-action labels
    const priorityLabels = [];
    const archiveLabels = [];
    
    Object.entries(labelStats).forEach(([label, stats]) => {
      if (stats.count > 0) {
        const avgAction = stats.actionSum / stats.count;
        
        if (avgAction > 40 && stats.threads > 20) {
          priorityLabels.push(label);
        } else if (avgAction < 10 && stats.threads > 30) {
          archiveLabels.push(label);
        }
      }
    });
    
    // Step 3: Get keyword patterns
    Logger.log('📝 Step 3: Analyzing Keywords...');
    
    const keywordData = keywordsSheet.getRange(
      2, 1,
      Math.min(keywordsSheet.getLastRow() - 1, 3000),
      5
    ).getValues();
    
    const actionKeywords = [];
    const keywordCounts = {};
    
    keywordData.forEach(row => {
      const [label, month, keyword, count, rank] = row;
      if (!keyword || keyword.length < 3) return;
      
      if (!keywordCounts[keyword]) {
        keywordCounts[keyword] = {
          total: 0,
          actionLabels: 0
        };
      }
      
      keywordCounts[keyword].total += count || 1;
      
      // Check if it's an action label
      if (label && (label.includes('Action') || label.includes('Task') || label.includes('Reply'))) {
        keywordCounts[keyword].actionLabels += count || 1;
      }
    });
    
    // Find strong action keywords
    Object.entries(keywordCounts).forEach(([keyword, counts]) => {
      if (counts.actionLabels > 10 && counts.actionLabels / counts.total > 0.5) {
        actionKeywords.push(keyword);
      }
    });
    
    // Limit to top 10
    const topActionKeywords = actionKeywords.slice(0, 10);
    
    // Step 4: Get domain patterns
    Logger.log('👤 Step 4: Analyzing Domains...');
    
    const senderData = sendersSheet.getRange(
      2, 1,
      Math.min(sendersSheet.getLastRow() - 1, 2000),
      6
    ).getValues();
    
    const domainCounts = {};
    
    senderData.forEach(row => {
      const [label, month, hash, domain, count, isInternal] = row;
      if (!domain) return;
      
      domainCounts[domain] = (domainCounts[domain] || 0) + (count || 1);
    });
    
    // Get top domains
    const topDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([domain, count]) => domain);
    
    // Step 5: Create configuration
    Logger.log('⚙️ Step 5: Creating Configuration...');
    
    const config = {
      spreadsheetId: sheetId,
      piiSalt: piiSalt || 'Not configured',
      timestamp: new Date().toISOString(),
      priorityLabels: priorityLabels.slice(0, 10),
      archiveLabels: archiveLabels.slice(0, 10),
      vipDomains: topDomains,
      urgentKeywords: [...topActionKeywords, 'urgent', 'asap', 'deadline'].filter((v, i, a) => a.indexOf(v) === i),
      stats: {
        totalLabels: Object.keys(labelStats).length,
        priorityLabels: priorityLabels.length,
        archiveLabels: archiveLabels.length,
        keywords: topActionKeywords.length
      }
    };
    
    // Step 6: Save to spreadsheet
    Logger.log('💾 Step 6: Saving Configuration...');
    
    let configSheet = ss.getSheetByName('Triage Config');
    if (!configSheet) {
      configSheet = ss.insertSheet('Triage Config');
    }
    
    configSheet.clear();
    
    // Build data array with consistent 2-column structure
    const rows = [];
    
    // Header
    rows.push(['TRIAGE CONFIGURATION', new Date().toISOString()]);
    rows.push(['', '']);
    
    // Settings
    rows.push(['SETTINGS', '']);
    rows.push(['Spreadsheet ID', config.spreadsheetId]);
    rows.push(['PII Salt', config.piiSalt]);
    rows.push(['Generated', config.timestamp]);
    rows.push(['', '']);
    
    // Priority Labels
    rows.push(['PRIORITY LABELS', '(Never auto-archive)']);
    if (config.priorityLabels.length > 0) {
      config.priorityLabels.forEach(label => {
        rows.push(['', label]);
      });
    } else {
      rows.push(['', 'None identified']);
    }
    rows.push(['', '']);
    
    // Archive Labels
    rows.push(['AUTO-ARCHIVE LABELS', '(Safe to archive)']);
    if (config.archiveLabels.length > 0) {
      config.archiveLabels.forEach(label => {
        rows.push(['', label]);
      });
    } else {
      rows.push(['', 'None identified']);
    }
    rows.push(['', '']);
    
    // VIP Domains
    rows.push(['VIP DOMAINS', '']);
    if (config.vipDomains.length > 0) {
      config.vipDomains.forEach(domain => {
        rows.push(['', domain]);
      });
    } else {
      rows.push(['', 'None identified']);
    }
    rows.push(['', '']);
    
    // Keywords
    rows.push(['URGENT KEYWORDS', '']);
    if (config.urgentKeywords.length > 0) {
      config.urgentKeywords.forEach(keyword => {
        rows.push(['', keyword]);
      });
    } else {
      rows.push(['', 'None identified']);
    }
    rows.push(['', '']);
    
    // Statistics
    rows.push(['STATISTICS', '']);
    rows.push(['Total Labels Analyzed', String(config.stats.totalLabels)]);
    rows.push(['Priority Labels Found', String(config.stats.priorityLabels)]);
    rows.push(['Archive Labels Found', String(config.stats.archiveLabels)]);
    rows.push(['Action Keywords Found', String(config.stats.keywords)]);
    
    // Write all data
    configSheet.getRange(1, 1, rows.length, 2).setValues(rows);
    
    // Apply formatting (optional, non-critical)
    try {
      configSheet.getRange('A1:B1').setFontWeight('bold').setFontSize(14);
      configSheet.getRange('A3').setFontWeight('bold');
      configSheet.getRange('A8').setFontWeight('bold');
      configSheet.autoResizeColumns(1, 2);
    } catch (e) {
      // Ignore formatting errors
    }
    
    // Step 7: Generate implementation guide
    Logger.log('\n' + '='.repeat(60));
    Logger.log('📋 TRIAGE CONFIGURATION COMPLETE');
    Logger.log('='.repeat(60));
    
    Logger.log('\n1️⃣ COPY THESE TO YOUR TRIAGE SCRIPT PROPERTIES:');
    Logger.log('   ANALYSIS_SHEET_ID: ' + config.spreadsheetId);
    Logger.log('   PII_SALT: ' + config.piiSalt);
    
    if (config.vipDomains.length > 0) {
      Logger.log('\n2️⃣ ADD TO VIP CONFIGURATION:');
      Logger.log('   TRIAGE_VIP_DOMAINS: ' + config.vipDomains.join(','));
    }
    
    if (config.urgentKeywords.length > 0) {
      Logger.log('\n3️⃣ UPDATE URGENT KEYWORDS:');
      Logger.log('   TRIAGE_DEEP_KEYWORDS: ' + config.urgentKeywords.slice(0, 10).join(','));
    }
    
    Logger.log('\n4️⃣ REVIEW THE "Triage Config" SHEET:');
    Logger.log('   ' + ss.getUrl() + '#gid=' + configSheet.getSheetId());
    
    Logger.log('\n✅ Configuration saved to spreadsheet!');
    Logger.log('✅ Ready to run triage with historical intelligence!');
    
    return config;
    
  } catch (error) {
    Logger.log('❌ Error: ' + error.toString());
    Logger.log('Stack trace: ' + error.stack);
    return null;
  }
}
