/**
 * Gmail Auto-Triage System - UAA Account
 * Version 4.0 - Rule-based with Historical Intelligence
 * 
 * Processes inbox emails using historical patterns from analysis spreadsheet.
 * No external AI dependencies - pure rule-based classification.
 */

// ==================== CONFIGURATION ====================
const CONFIG = (() => {
  const props = PropertiesService.getScriptProperties().getProperties();
  return {
    // Historical Data
    ANALYSIS_SHEET_ID: props.ANALYSIS_SHEET_ID || '1OIY5GfzoRGDKgZHXTxf2QvDcXesC3-THSjBGZEunnDY',
    
    // VIP Configuration
    VIP_SENDERS: (props.TRIAGE_VIP_SENDERS || 'provost@alaska.edu,dean@alaska.edu').split(',').filter(s => s.trim()),
    VIP_DOMAINS: (props.TRIAGE_VIP_DOMAINS || 'alaska.edu,ua.edu').split(',').filter(s => s.trim()),
    
    // Protected Senders (always keep)
    KEEP_SENDERS: (props.TRIAGE_KEEP_SENDERS || '').split(',').filter(s => s.trim()),
    KEEP_DOMAINS: (props.TRIAGE_KEEP_DOMAINS || 'alaska.edu').split(',').filter(s => s.trim()),
    
    // Processing Parameters
    PAGE_SIZE: 50,
    MAX_PER_RUN: parseInt(props.TRIAGE_MAX_PER_RUN || '50'), // Start conservative
    PAUSE_MS: 100,
    CACHE_DURATION_SECONDS: 6 * 60 * 60, // 6 hours
    DRY_RUN: props.TRIAGE_DRY_RUN === 'true', // Safety mode
    PREVIEW_MODE: props.TRIAGE_PREVIEW_MODE === 'true'
    
    // Label Prefixes
    RUN_LABEL_PREFIX: '_Triage/Run-',
    PREVIEW_LABEL_PREFIX: '_Triage/PREVIEW-',
    
    // Safety Query
    SAFE_GUARD_QUERY: 'in:inbox -is:starred -in:chats -label:_Triage',
    
    // Confidence Thresholds
    HIGH_CONFIDENCE: 0.8,
    MEDIUM_CONFIDENCE: 0.5,
    
    // Time Windows
    BUSINESS_HOURS_START: 8,
    BUSINESS_HOURS_END: 17
  };
})();

// ==================== HISTORICAL INTELLIGENCE MODULE ====================
class HistoricalIntelligence {
  constructor() {
    this.cacheKey = 'HISTORICAL_ANALYSIS_DATA_V4';
    this.cache = CacheService.getScriptCache();
  }
  
  /**
   * Load intelligence data from spreadsheet or cache
   */
  load() {
    try {
      // Try cache first
      const cached = this.cache.get(this.cacheKey);
      if (cached) {
        Logger.log('🧠 Loaded historical intelligence from cache');
        return JSON.parse(cached);
      }
      
      // Load from spreadsheet
      if (!CONFIG.ANALYSIS_SHEET_ID) {
        Logger.log('⚠️ No ANALYSIS_SHEET_ID configured');
        return null;
      }
      
      Logger.log('🧠 Building historical intelligence from spreadsheet...');
      const ss = SpreadsheetApp.openById(CONFIG.ANALYSIS_SHEET_ID);
      
      const intelligence = {
        senderProfiles: this._processSenderSheet(ss.getSheetByName('Senders')),
        keywordProfiles: this._processKeywordSheet(ss.getSheetByName('Keywords')),
        labelPatterns: this._processCharacteristicsSheet(ss.getSheetByName('Characteristics')),
        metadata: {
          lastUpdated: new Date().toISOString(),
          emailCount: this._getMetadataValue(ss, 'Total Emails Analyzed')
        }
      };
      
      // Cache the processed data
      this.cache.put(this.cacheKey, JSON.stringify(intelligence), CONFIG.CACHE_DURATION_SECONDS);
      
      Logger.log(`✅ Loaded intelligence from ${intelligence.metadata.emailCount} emails`);
      return intelligence;
      
    } catch (error) {
      Logger.log(`❌ Error loading historical intelligence: ${error.toString()}`);
      return null;
    }
  }
  
  /**
   * Process sender statistics
   */
  _processSenderSheet(sheet) {
    if (!sheet) return {};
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const senderIndex = headers.indexOf('Sender');
    const countIndex = headers.indexOf('Count');
    const avgLabelsIndex = headers.indexOf('Avg Labels');
    
    const profiles = {};
    
    for (let i = 1; i < Math.min(data.length, 500); i++) { // Top 500 senders
      const row = data[i];
      if (!row[senderIndex]) continue;
      
      profiles[row[senderIndex]] = {
        count: row[countIndex] || 0,
        avgLabels: row[avgLabelsIndex] || 0,
        importance: row[countIndex] > 10 ? 'high' : 'normal'
      };
    }
    
    return profiles;
  }
  
  /**
   * Process keyword patterns
   */
  _processKeywordSheet(sheet) {
    if (!sheet) return {};
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const keywordIndex = headers.indexOf('Keyword');
    const countIndex = headers.indexOf('Count');
    const labelIndex = headers.indexOf('Most Common Label');
    
    const profiles = {};
    
    for (let i = 1; i < Math.min(data.length, 200); i++) {
      const row = data[i];
      if (!row[keywordIndex]) continue;
      
      profiles[row[keywordIndex].toLowerCase()] = {
        count: row[countIndex] || 0,
        commonLabel: row[labelIndex] || '',
        weight: Math.min(row[countIndex] / 100, 1) // Normalize weight
      };
    }
    
    return profiles;
  }
  
  /**
   * Process label characteristics
   */
  _processCharacteristicsSheet(sheet) {
    if (!sheet) return {};
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const labelIndex = headers.indexOf('Label');
    
    const patterns = {};
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[labelIndex]) continue;
      
      patterns[row[labelIndex]] = {
        senderPatterns: this._extractPattern(row, headers, 'Top Senders'),
        keywordPatterns: this._extractPattern(row, headers, 'Top Keywords'),
        avgResponseTime: this._extractValue(row, headers, 'Avg Response Time')
      };
    }
    
    return patterns;
  }
  
  _extractPattern(row, headers, columnName) {
    const index = headers.indexOf(columnName);
    if (index === -1) return [];
    
    const value = row[index];
    if (!value) return [];
    
    return String(value).split(',').map(s => s.trim()).filter(s => s);
  }
  
  _extractValue(row, headers, columnName) {
    const index = headers.indexOf(columnName);
    return index !== -1 ? row[index] : null;
  }
  
  _getMetadataValue(ss, key) {
    try {
      const metaSheet = ss.getSheetByName('Metadata');
      if (!metaSheet) return 'Unknown';
      
      const data = metaSheet.getDataRange().getValues();
      for (const row of data) {
        if (row[0] === key) return row[1];
      }
    } catch (e) {
      // Silent fail
    }
    return 'Unknown';
  }
}

// ==================== EMAIL CLASSIFIER ====================
class EmailClassifier {
  constructor(intelligence) {
    this.intelligence = intelligence;
  }
  
  /**
   * Classify an email thread based on historical patterns
   */
  classifyThread(thread) {
    const firstMessage = thread.getMessages()[0];
    const sender = this._extractSenderEmail(firstMessage.getFrom());
    const subject = thread.getFirstMessageSubject();
    const snippet = firstMessage.getPlainBody().substring(0, 500);
    
    // Check VIP status
    if (this._isVIP(sender)) {
      return {
        action: 'star',
        label: 'VIP',
        confidence: 1.0,
        reason: 'VIP sender'
      };
    }
    
    // Check protected senders
    if (this._isProtected(sender)) {
      return {
        action: 'keep',
        label: null,
        confidence: 1.0,
        reason: 'Protected sender'
      };
    }
    
    // Use historical intelligence if available
    if (this.intelligence) {
      const classification = this._classifyWithIntelligence(sender, subject, snippet);
      if (classification.confidence >= CONFIG.MEDIUM_CONFIDENCE) {
        return classification;
      }
    }
    
    // Fallback to rule-based classification
    return this._ruleBasedClassification(sender, subject, snippet);
  }
  
  /**
   * Classify using historical patterns
   */
  _classifyWithIntelligence(sender, subject, snippet) {
    let scoreMap = {};
    let totalWeight = 0;
    
    // Check sender profile
    if (this.intelligence.senderProfiles[sender]) {
      const profile = this.intelligence.senderProfiles[sender];
      if (profile.importance === 'high') {
        scoreMap['Important'] = (scoreMap['Important'] || 0) + 0.4;
        totalWeight += 0.4;
      }
    }
    
    // Check keywords
    const text = (subject + ' ' + snippet).toLowerCase();
    for (const [keyword, profile] of Object.entries(this.intelligence.keywordProfiles || {})) {
      if (text.includes(keyword)) {
        const label = profile.commonLabel;
        if (label) {
          scoreMap[label] = (scoreMap[label] || 0) + profile.weight * 0.3;
          totalWeight += profile.weight * 0.3;
        }
      }
    }
    
    // Find best matching label
    let bestLabel = null;
    let bestScore = 0;
    
    for (const [label, score] of Object.entries(scoreMap)) {
      if (score > bestScore) {
        bestScore = score;
        bestLabel = label;
      }
    }
    
    if (bestLabel && totalWeight > 0) {
      return {
        action: 'label',
        label: bestLabel,
        confidence: Math.min(bestScore / totalWeight, 1),
        reason: 'Historical pattern match'
      };
    }
    
    return {
      action: 'keep',
      label: null,
      confidence: 0,
      reason: 'No pattern match'
    };
  }
  
  /**
   * Fallback rule-based classification
   */
  _ruleBasedClassification(sender, subject, snippet) {
    const text = (subject + ' ' + snippet).toLowerCase();
    
    // University/Academic rules
    if (sender.endsWith('@alaska.edu') || sender.endsWith('@ua.edu')) {
      if (text.includes('meeting') || text.includes('schedule')) {
        return { action: 'label', label: 'Meetings', confidence: 0.8, reason: 'Meeting related' };
      }
      if (text.includes('student') || text.includes('grade')) {
        return { action: 'label', label: 'Students', confidence: 0.8, reason: 'Student related' };
      }
      if (text.includes('department') || text.includes('faculty')) {
        return { action: 'label', label: 'Department', confidence: 0.7, reason: 'Department business' };
      }
    }
    
    // Newsletter/Marketing detection
    if (text.includes('unsubscribe') || text.includes('newsletter')) {
      return { action: 'label', label: 'Newsletters', confidence: 0.9, reason: 'Newsletter detected' };
    }
    
    // Default keep
    return { action: 'keep', label: null, confidence: 0.3, reason: 'No specific rule matched' };
  }
  
  _isVIP(sender) {
    if (CONFIG.VIP_SENDERS.includes(sender)) return true;
    
    for (const domain of CONFIG.VIP_DOMAINS) {
      if (sender.endsWith('@' + domain)) return true;
    }
    
    return false;
  }
  
  _isProtected(sender) {
    if (CONFIG.KEEP_SENDERS.includes(sender)) return true;
    
    for (const domain of CONFIG.KEEP_DOMAINS) {
      if (sender.endsWith('@' + domain)) return true;
    }
    
    return false;
  }
  
  _extractSenderEmail(fromString) {
    const match = fromString.match(/<(.+?)>/);
    return match ? match[1].toLowerCase() : fromString.toLowerCase();
  }
}

// ==================== MAIN PROCESSING ====================
/**
 * Main entry point - process inbox emails
 */
function processInbox() {
  try {
    Logger.log('🚀 Starting Gmail Triage process...');
    
    // Load historical intelligence
    const intelligenceSystem = new HistoricalIntelligence();
    const intelligence = intelligenceSystem.load();
    
    if (!intelligence) {
      Logger.log('⚠️ Running without historical intelligence');
    }
    
    // Initialize classifier
    const classifier = new EmailClassifier(intelligence);
    
    // Get threads to process
    const threads = GmailApp.search(CONFIG.SAFE_GUARD_QUERY, 0, CONFIG.MAX_PER_RUN);
    Logger.log(`📧 Found ${threads.length} threads to process`);
    
    if (threads.length === 0) {
      Logger.log('✅ No emails to process');
      return;
    }
    
    // Process each thread
    let processed = 0;
    let starred = 0;
    let labeled = 0;
    let archived = 0;
    
    for (const thread of threads) {
      try {
        const result = classifier.classifyThread(thread);
        
        // Apply classification based on mode
        if (CONFIG.DRY_RUN) {
          // DRY RUN - Log only
          Logger.log(`[DRY RUN] Would ${result.action}: ${thread.getFirstMessageSubject()}`);
          if (result.label) {
            Logger.log(`[DRY RUN] Would label as: ${result.label}`);
          }
          processed++;
          
        } else if (CONFIG.PREVIEW_MODE) {
          // PREVIEW MODE - Add preview labels only
          const previewLabel = GmailApp.createLabel(`_Triage/PREVIEW-${result.action}`);
          thread.addLabel(previewLabel);
          
          if (result.label) {
            const labelPreview = GmailApp.createLabel(`_Triage/PREVIEW-${result.label}`);
            thread.addLabel(labelPreview);
          }
          
          Logger.log(`[PREVIEW] Marked for ${result.action}: ${thread.getFirstMessageSubject()}`);
          processed++;
          
        } else {
          // PRODUCTION MODE - Apply actual changes
          switch (result.action) {
            case 'star':
              thread.addLabel(GmailApp.createLabel('VIP'));
              thread.markImportant();
              if (!thread.isStarred()) {
                GmailApp.starMessage(thread.getMessages()[0]);
              }
              starred++;
              Logger.log(`⭐ Starred VIP: ${thread.getFirstMessageSubject()}`);
              break;
              
            case 'label':
              if (result.label) {
                const label = GmailApp.createLabel(result.label);
                thread.addLabel(label);
                labeled++;
                
                // Archive only with high confidence and not from .edu domains
                const sender = classifier._extractSenderEmail(thread.getMessages()[0].getFrom());
                const isEduDomain = sender.endsWith('.edu');
                
                if (result.confidence >= CONFIG.HIGH_CONFIDENCE && !isEduDomain) {
                  thread.moveToArchive();
                  archived++;
                }
                Logger.log(`🏷️ Labeled as ${result.label}: ${thread.getFirstMessageSubject()}`);
              }
              break;
              
            case 'archive':
              // Extra safety check for work email
              const archiveSender = classifier._extractSenderEmail(thread.getMessages()[0].getFrom());
              if (!archiveSender.endsWith('.edu')) {
                thread.moveToArchive();
                archived++;
                Logger.log(`📦 Archived: ${thread.getFirstMessageSubject()}`);
              } else {
                Logger.log(`📥 Kept (edu domain): ${thread.getFirstMessageSubject()}`);
              }
              break;
              
            default:
              // Keep in inbox
              Logger.log(`📥 Kept: ${thread.getFirstMessageSubject()}`);
          }
        }
        
        // Mark as processed
        thread.addLabel(GmailApp.createLabel('_Triage/Processed'));
        
        processed++;
        
        // Pause to avoid rate limits
        if (processed % 10 === 0) {
          Utilities.sleep(CONFIG.PAUSE_MS);
        }
        
      } catch (error) {
        Logger.log(`❌ Error processing thread: ${error.toString()}`);
      }
    }
    
    // Log summary
    Logger.log('📊 Processing Summary:');
    Logger.log(`  - Processed: ${processed}`);
    Logger.log(`  - Starred: ${starred}`);
    Logger.log(`  - Labeled: ${labeled}`);
    Logger.log(`  - Archived: ${archived}`);
    
    // Send summary email if significant activity
    if (processed > 20) {
      sendSummaryEmail(processed, starred, labeled, archived);
    }
    
  } catch (error) {
    Logger.log(`❌ Fatal error: ${error.toString()}`);
    throw error;
  }
}

/**
 * Send summary email
 */
function sendSummaryEmail(processed, starred, labeled, archived) {
  const subject = `Gmail Triage Summary - ${new Date().toLocaleDateString()}`;
  const body = `
Gmail Triage completed successfully.

Summary:
- Emails Processed: ${processed}
- VIP/Starred: ${starred}
- Labeled: ${labeled}
- Archived: ${archived}

Time: ${new Date().toLocaleString()}

This is an automated message from your Gmail Triage system.
  `;
  
  GmailApp.sendEmail(Session.getActiveUser().getEmail(), subject, body);
}

/**
 * Setup function - creates necessary labels
 */
function setup() {
  Logger.log('Setting up Gmail Triage...');
  
  // Create labels
  const labels = [
    '_Triage/Processed',
    'VIP',
    'Important',
    'Students',
    'Department',
    'Meetings',
    'Newsletters'
  ];
  
  for (const labelName of labels) {
    try {
      GmailApp.createLabel(labelName);
      Logger.log(`✅ Created label: ${labelName}`);
    } catch (e) {
      Logger.log(`Label already exists: ${labelName}`);
    }
  }
  
  Logger.log('Setup complete!');
}

/**
 * Clear cache - useful for forcing reload of historical data
 */
function clearCache() {
  const cache = CacheService.getScriptCache();
  cache.remove('HISTORICAL_ANALYSIS_DATA_V4');
  Logger.log('✅ Cache cleared');
}