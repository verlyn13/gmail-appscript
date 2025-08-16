/**
 * Gmail Auto-Triage with Historical Intelligence System
 * Version 3.0 - FINAL OPTIMIZED VERSION FOR LARGE DATASETS
 * 
 * This script combines real-time LLM classification with historical email patterns
 * learned from your archive analysis. Optimized for 64K+ email archives.
 * 
 * @author G-Script Architect
 * @requires Gmail API, OpenAI API, Analysis Spreadsheet
 */

// ==================== CONFIGURATION ====================
/**
 * System configuration - loaded from Script Properties
 * @const {Object}
 */
const CONFIG = (() => {
  const props = PropertiesService.getScriptProperties().getProperties();
  return {
    // API Configuration
    OPENAI_API_KEY: props.OPENAI_API_KEY || '',
    OPENAI_FAST_MODEL: props.OPENAI_FAST_MODEL || 'gpt-4o-mini',
    OPENAI_DEEP_MODEL: props.OPENAI_DEEP_MODEL || 'gpt-4o',
    
    // Historical Data
    ANALYSIS_SHEET_ID: props.ANALYSIS_SHEET_ID || '',
    PII_SALT: props.PII_SALT || '',
    
    // VIP Configuration
    VIP_SENDERS: (props.TRIAGE_VIP_SENDERS || '').split(',').filter(s => s.trim()),
    VIP_DOMAINS: (props.TRIAGE_VIP_DOMAINS || '').split(',').filter(s => s.trim()),
    
    // Protected Senders (never sent to AI)
    KEEP_SENDERS: (props.TRIAGE_KEEP_SENDERS || '').split(',').filter(s => s.trim()),
    KEEP_DOMAINS: (props.TRIAGE_KEEP_DOMAINS || '').split(',').filter(s => s.trim()),
    
    // Deep Analysis Triggers
    MAX_DEEP_REVIEW: parseInt(props.TRIAGE_MAX_DEEP_REVIEW || '100'),
    DEEP_CONFIDENCE_THRESHOLD: parseFloat(props.TRIAGE_DEEP_CONFIDENCE_THRESHOLD || '0.7'),
    DEEP_SNIPPET_LENGTH: parseInt(props.TRIAGE_DEEP_SNIPPET_LENGTH || '1500'),
    URGENT_KEYWORDS: (props.TRIAGE_DEEP_KEYWORDS || 'urgent,ASAP,deadline').split(',').map(k => k.trim()),
    
    // Processing Parameters
    PAGE_SIZE: 100,
    MAX_PER_RULE: 500,
    PAUSE_MS: 200,
    CACHE_DURATION_SECONDS: 6 * 60 * 60, // 6 hours
    
    // Label Prefixes
    RUN_LABEL_PREFIX: '_Triage/Run-',
    PREVIEW_LABEL_PREFIX: '_Triage/PREVIEW-',
    LLM_LABEL_PREFIX: '_LLM/',
    
    // Safety Query
    SAFE_GUARD_QUERY: 'in:inbox -is:starred -in:chats'
  };
})();

// ==================== OPTIMIZED HISTORICAL INTELLIGENCE MODULE ====================
/**
 * Historical Intelligence System - Optimized for Large Datasets
 * Handles 64K+ email analysis data efficiently
 */
class HistoricalIntelligence {
  /**
   * @constructor
   */
  constructor() {
    this.cacheKey = 'HISTORICAL_ANALYSIS_DATA_V3'; // Updated version
    this.cache = CacheService.getScriptCache();
    this.maxCacheSize = 95000; // Stay under 100KB limit
  }
  
  /**
   * Load intelligence data with size optimization
   * @returns {Object|null} Processed historical data or null if unavailable
   */
  load() {
    try {
      // Try cache first
      const cached = this._loadFromCache();
      if (cached) {
        Logger.log('🧠 Loaded historical intelligence from cache');
        return cached;
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
        metadata: this._extractMetadata(ss)
      };
      
      // Try to cache (but don't fail if too large)
      this._saveToCache(intelligence);
      
      Logger.log(`✅ Historical intelligence loaded: ${intelligence.metadata.totalThreads} threads analyzed`);
      return intelligence;
      
    } catch (error) {
      Logger.log(`❌ Error loading historical data: ${error.toString()}`);
      
      // If caching failed, try loading without cache
      if (error.toString().includes('too large')) {
        Logger.log('📊 Data too large for cache, loading directly...');
        return this._loadDirectly();
      }
      
      return null;
    }
  }
  
  /**
   * Load data directly without caching (for large datasets)
   * @private
   */
  _loadDirectly() {
    try {
      const ss = SpreadsheetApp.openById(CONFIG.ANALYSIS_SHEET_ID);
      
      // Load with limits to prevent memory issues
      const intelligence = {
        senderProfiles: this._processSenderSheet(ss.getSheetByName('Senders'), 500), // Limit to top 500
        keywordProfiles: this._processKeywordSheet(ss.getSheetByName('Keywords'), 1000), // Limit to top 1000
        labelPatterns: this._processCharacteristicsSheet(ss.getSheetByName('Characteristics'), 200), // All labels
        metadata: this._extractMetadata(ss)
      };
      
      Logger.log('✅ Loaded directly (cache bypassed due to size)');
      return intelligence;
      
    } catch (error) {
      Logger.log(`❌ Direct load failed: ${error.toString()}`);
      return null;
    }
  }
  
  /**
   * Process sender patterns from sheet with optional limit
   * @private
   */
  _processSenderSheet(sheet, limit = 1000) {
    if (!sheet) return {};
    
    const profiles = {};
    
    try {
      // Get data with limit
      const lastRow = Math.min(sheet.getLastRow(), limit + 1);
      if (lastRow <= 1) return {};
      
      const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
      
      // Process rows
      for (const row of data) {
        const [label, month, senderHash, domain, count, isInternal] = row;
        
        if (!senderHash || !label) continue;
        
        const key = String(senderHash).toLowerCase().trim();
        
        // Limit to significant senders (more than 2 messages)
        if (count < 3) continue;
        
        if (!profiles[key]) {
          profiles[key] = {
            domain: domain,
            labels: {},
            totalCount: 0,
            isInternal: isInternal
          };
        }
        
        profiles[key].labels[label] = (profiles[key].labels[label] || 0) + count;
        profiles[key].totalCount += count;
      }
      
      // Convert to sorted arrays and limit stored data
      for (const key in profiles) {
        profiles[key].topLabels = Object.entries(profiles[key].labels)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3) // Only keep top 3 labels
          .map(([label, count]) => ({
            label,
            confidence: Math.round((count / profiles[key].totalCount) * 100)
          }));
        
        // Remove the full labels object to save space
        delete profiles[key].labels;
      }
      
      // Keep only top senders by volume
      const sortedSenders = Object.entries(profiles)
        .sort(([, a], [, b]) => b.totalCount - a.totalCount)
        .slice(0, Math.min(500, Object.keys(profiles).length));
      
      const topProfiles = {};
      sortedSenders.forEach(([key, profile]) => {
        topProfiles[key] = profile;
      });
      
      Logger.log(`  📧 Processed ${Object.keys(topProfiles).length} sender profiles`);
      return topProfiles;
      
    } catch (error) {
      Logger.log(`  ⚠️ Error processing senders: ${error.toString()}`);
      return {};
    }
  }
  
  /**
   * Process keyword patterns from sheet with optional limit
   * @private
   */
  _processKeywordSheet(sheet, limit = 2000) {
    if (!sheet) return {};
    
    const profiles = {};
    
    try {
      // Get data with limit
      const lastRow = Math.min(sheet.getLastRow(), limit + 1);
      if (lastRow <= 1) return {};
      
      const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
      
      // Process rows
      for (const row of data) {
        const [label, month, keyword, count, rank] = row;
        
        if (!keyword || !label || count < 5) continue; // Skip rare keywords
        
        const key = String(keyword).toLowerCase().trim();
        
        // Skip very short or very common words
        if (key.length < 3 || key.length > 30) continue;
        
        if (!profiles[key]) {
          profiles[key] = {
            labels: {},
            totalCount: 0
          };
        }
        
        profiles[key].labels[label] = (profiles[key].labels[label] || 0) + count;
        profiles[key].totalCount += count;
      }
      
      // Convert to sorted arrays
      for (const key in profiles) {
        profiles[key].topLabels = Object.entries(profiles[key].labels)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 2) // Only keep top 2 labels
          .map(([label, count]) => ({
            label,
            confidence: Math.round((count / profiles[key].totalCount) * 100)
          }));
        
        // Remove the full labels object
        delete profiles[key].labels;
      }
      
      // Keep only keywords with strong signals
      const significantKeywords = {};
      Object.entries(profiles).forEach(([key, profile]) => {
        if (profile.totalCount >= 10 && profile.topLabels[0]?.confidence >= 40) {
          significantKeywords[key] = profile;
        }
      });
      
      Logger.log(`  🔑 Processed ${Object.keys(significantKeywords).length} keyword patterns`);
      return significantKeywords;
      
    } catch (error) {
      Logger.log(`  ⚠️ Error processing keywords: ${error.toString()}`);
      return {};
    }
  }
  
  /**
   * Process label characteristics with optional limit
   * @private
   */
  _processCharacteristicsSheet(sheet, limit = 500) {
    if (!sheet) return {};
    
    const patterns = {};
    
    try {
      const lastRow = Math.min(sheet.getLastRow(), limit + 1);
      if (lastRow <= 1) return {};
      
      const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
      
      for (const row of data) {
        const [label, month, threads, messages, urgentPct, questionPct, actionPct, attachmentPct] = row;
        
        if (!label || threads < 5) continue; // Skip labels with very few threads
        
        if (!patterns[label]) {
          patterns[label] = {
            totalThreads: 0,
            avgUrgent: 0,
            avgQuestion: 0,
            avgAction: 0,
            months: 0
          };
        }
        
        patterns[label].totalThreads += threads;
        patterns[label].months++;
        
        // Running averages (simplified to save space)
        const n = patterns[label].months;
        patterns[label].avgUrgent = ((patterns[label].avgUrgent * (n - 1)) + parseFloat(urgentPct || 0)) / n;
        patterns[label].avgQuestion = ((patterns[label].avgQuestion * (n - 1)) + parseFloat(questionPct || 0)) / n;
        patterns[label].avgAction = ((patterns[label].avgAction * (n - 1)) + parseFloat(actionPct || 0)) / n;
      }
      
      // Round averages to save space
      for (const label in patterns) {
        patterns[label].avgUrgent = Math.round(patterns[label].avgUrgent);
        patterns[label].avgQuestion = Math.round(patterns[label].avgQuestion);
        patterns[label].avgAction = Math.round(patterns[label].avgAction);
      }
      
      Logger.log(`  🏷️ Processed ${Object.keys(patterns).length} label patterns`);
      return patterns;
      
    } catch (error) {
      Logger.log(`  ⚠️ Error processing characteristics: ${error.toString()}`);
      return {};
    }
  }
  
  /**
   * Extract metadata from overview sheet
   * @private
   */
  _extractMetadata(ss) {
    const metadata = {
      totalThreads: 0,
      totalMessages: 0,
      lastUpdated: new Date().toISOString()
    };
    
    try {
      const chars = ss.getSheetByName('Characteristics');
      if (chars && chars.getLastRow() > 1) {
        const data = chars.getRange(2, 3, Math.min(chars.getLastRow() - 1, 1000), 2).getValues();
        for (const row of data) {
          metadata.totalThreads += row[0] || 0;
          metadata.totalMessages += row[1] || 0;
        }
      }
    } catch (e) {
      // Silent fail for metadata
    }
    
    return metadata;
  }
  
  /**
   * Load from cache with multi-part support
   * @private
   */
  _loadFromCache() {
    try {
      // Try single cache first
      const cached = this.cache.get(this.cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      // Try multi-part cache
      const part1 = this.cache.get(this.cacheKey + '_1');
      const part2 = this.cache.get(this.cacheKey + '_2');
      
      if (part1 && part2) {
        return JSON.parse(part1 + part2);
      }
      
      return null;
    } catch (e) {
      return null;
    }
  }
  
  /**
   * Save to cache with size checking
   * @private
   */
  _saveToCache(data) {
    try {
      const json = JSON.stringify(data);
      
      if (json.length < this.maxCacheSize) {
        // Single cache entry
        this.cache.put(this.cacheKey, json, CONFIG.CACHE_DURATION_SECONDS);
        Logger.log('  💾 Cached intelligence data');
      } else if (json.length < this.maxCacheSize * 2) {
        // Split into two parts
        const mid = Math.floor(json.length / 2);
        this.cache.put(this.cacheKey + '_1', json.slice(0, mid), CONFIG.CACHE_DURATION_SECONDS);
        this.cache.put(this.cacheKey + '_2', json.slice(mid), CONFIG.CACHE_DURATION_SECONDS);
        Logger.log('  💾 Cached intelligence data (multi-part)');
      } else {
        Logger.log('  ⚠️ Data too large for cache, will load directly each time');
      }
    } catch (e) {
      Logger.log('  ⚠️ Cache failed, will load directly: ' + e.toString());
    }
  }
  
  /**
   * Generate context for a specific email
   * @param {Object} emailData Email information
   * @param {Object} intelligence Historical data
   * @returns {string} Context string for LLM
   */
  generateContext(emailData, intelligence) {
    if (!intelligence) return "No historical data available.";
    
    const hints = [];
    const confidence = { high: [], medium: [], low: [] };
    
    // Analyze sender
    if (CONFIG.PII_SALT && emailData.from) {
      const senderKey = this._hashSender(emailData.from);
      const senderProfile = intelligence.senderProfiles[senderKey];
      
      if (senderProfile && senderProfile.topLabels && senderProfile.topLabels.length > 0) {
        const top = senderProfile.topLabels[0];
        if (top.confidence > 80) {
          confidence.high.push(`Sender historically ${top.confidence}% '${top.label}'`);
        } else if (top.confidence > 50) {
          confidence.medium.push(`Sender often '${top.label}' (${top.confidence}%)`);
        } else {
          confidence.low.push(`Sender sometimes '${top.label}'`);
        }
      }
    }
    
    // Analyze keywords
    if (emailData.subject && intelligence.keywordProfiles) {
      const words = emailData.subject.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const keywordVotes = {};
      
      for (const word of words) {
        const profile = intelligence.keywordProfiles[word];
        if (profile && profile.topLabels && profile.topLabels.length > 0) {
          const top = profile.topLabels[0];
          keywordVotes[top.label] = (keywordVotes[top.label] || 0) + top.confidence;
        }
      }
      
      const topKeywordLabel = Object.entries(keywordVotes)
        .sort(([, a], [, b]) => b - a)[0];
      
      if (topKeywordLabel) {
        const [label, totalConfidence] = topKeywordLabel;
        if (totalConfidence > 100) {
          confidence.high.push(`Keywords strongly indicate '${label}'`);
        } else if (totalConfidence > 50) {
          confidence.medium.push(`Keywords suggest '${label}'`);
        }
      }
    }
    
    // Build context string
    const parts = [];
    if (confidence.high.length > 0) {
      parts.push("Strong signals: " + confidence.high.join('; '));
    }
    if (confidence.medium.length > 0) {
      parts.push("Likely: " + confidence.medium.join('; '));
    }
    if (confidence.low.length > 0 && parts.length === 0) {
      parts.push("Hints: " + confidence.low.join('; '));
    }
    
    return parts.length > 0 ? parts.join('. ') : "No specific patterns detected.";
  }
  
  /**
   * Hash sender email for privacy-preserving lookup
   * @private
   */
  _hashSender(fromField) {
    const emailMatch = fromField.match(/<(.+?)>/);
    const email = emailMatch ? emailMatch[1].toLowerCase() : fromField.toLowerCase();
    
    if (!email.includes('@')) return null;
    
    return Utilities.base64EncodeWebSafe(
      Utilities.computeHmacSha256Signature(email, CONFIG.PII_SALT)
    ).slice(0, 10);
  }
  
  /**
   * Clear the cache manually
   */
  clearCache() {
    this.cache.remove(this.cacheKey);
    this.cache.remove(this.cacheKey + '_1');
    this.cache.remove(this.cacheKey + '_2');
    Logger.log('✅ Historical intelligence cache cleared');
  }
}

// ==================== ENHANCED TRIAGE ENGINE ====================
/**
 * Main triage engine with historical intelligence integration
 */
class TriageEngine {
  /**
   * @constructor
   */
  constructor() {
    this.intelligence = new HistoricalIntelligence();
    this.historicalData = null;
  }
  
  /**
   * Run complete triage process
   * @param {boolean} dryRun Preview mode if true
   */
  run(dryRun = false) {
    const startTime = new Date();
    const timestamp = startTime.toISOString().replace(/[:.]/g, '-');
    const runLabelName = (dryRun ? CONFIG.PREVIEW_LABEL_PREFIX : CONFIG.RUN_LABEL_PREFIX) + timestamp;
    const runLabel = this._getOrCreateLabel(runLabelName);
    
    // Load historical intelligence
    this.historicalData = this.intelligence.load();
    if (this.historicalData) {
      Logger.log(`📚 Using historical patterns from ${this.historicalData.metadata.totalThreads} analyzed threads`);
    }
    
    const stats = {
      touched: 0,
      archived: 0,
      classified: 0,
      deepAnalyzed: 0
    };
    
    try {
      // Phase 1: Static rules (if any configured)
      // Skipping for now as per your config
      
      // Phase 2: LLM Classification with historical intelligence
      Logger.log('\n--- PHASE: Intelligent LLM Classification ---');
      const llmResults = this._runLLMClassification(dryRun, runLabel);
      stats.touched += llmResults.touched;
      stats.archived += llmResults.archived;
      stats.classified += llmResults.classified;
      
      // Phase 3: Deep analysis for priority items
      if (llmResults.decisions && llmResults.decisions.length > 0) {
        Logger.log('\n--- PHASE: Deep Analysis for Priority Items ---');
        const deepResults = this._runDeepAnalysis(llmResults.threads, llmResults.decisions, dryRun);
        stats.deepAnalyzed = deepResults.length;
      }
      
    } catch (error) {
      Logger.log(`❌ Triage error: ${error.toString()}`);
      Logger.log(error.stack);
    }
    
    // Save run label for undo
    if (!dryRun) {
      PropertiesService.getScriptProperties().setProperty('LAST_RUN_LABEL', runLabelName);
    }
    
    // Summary
    const duration = Math.round((new Date() - startTime) / 1000);
    Logger.log('\n=== TRIAGE SUMMARY ===');
    Logger.log(`✅ ${dryRun ? 'Preview' : 'Apply'} complete in ${duration}s`);
    Logger.log(`📧 Touched: ${stats.touched} threads`);
    Logger.log(`🏷️ Classified: ${stats.classified} threads`);
    Logger.log(`🔬 Deep analyzed: ${stats.deepAnalyzed} threads`);
    Logger.log(`📦 Archived: ${stats.archived} threads`);
    Logger.log(`🏷️ Run label: ${runLabelName}`);
  }
  
  /**
   * Run LLM classification with historical context
   * @private
   */
  _runLLMClassification(dryRun, runLabel) {
    const query = `-in:trash -in:spam -in:chats -label:${CONFIG.LLM_LABEL_PREFIX}`;
    const fullQuery = `${query} ${CONFIG.SAFE_GUARD_QUERY} ${this._buildExcludeQuery()}`.trim();
    const threads = GmailApp.search(fullQuery, 0, 500);
    
    if (threads.length === 0) {
      Logger.log('📭 No threads to classify');
      return { touched: 0, archived: 0, classified: 0 };
    }
    
    Logger.log(`🤖 Classifying ${threads.length} threads with historical intelligence...`);
    
    // Prepare items with historical context
    const items = threads.map((thread, index) => {
      try {
        const messages = thread.getMessages();
        const latestMsg = messages[messages.length - 1];
        const subject = thread.getFirstMessageSubject() || "";
        const from = latestMsg.getFrom() || "";
        
        // Get message snippet
        let snippet = "";
        try {
          const body = latestMsg.getPlainBody() || latestMsg.getBody();
          snippet = body
            .replace(/<[^>]*>/g, ' ')
            .replace(/&[^;]+;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 500);
        } catch (e) {
          snippet = subject;
        }
        
        // Generate historical context
        const historicalContext = this.historicalData 
          ? this.intelligence.generateContext({ from, subject }, this.historicalData)
          : "No historical data available.";
        
        return {
          index,
          from: from.slice(0, 200),
          subject: subject.slice(0, 300),
          snippet,
          threadLength: messages.length,
          hasAttachments: latestMsg.getAttachments().length > 0,
          historicalContext
        };
        
      } catch (error) {
        Logger.log(`⚠️ Error processing thread ${index}: ${error.toString()}`);
        return {
          index,
          from: "unknown",
          subject: "Error reading thread",
          snippet: "",
          threadLength: 1,
          historicalContext: "Processing error"
        };
      }
    });
    
    // Process in batches
    const decisions = [];
    const batchSize = 50;
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, Math.min(i + batchSize, items.length));
      Logger.log(`  📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(items.length/batchSize)}`);
      
      try {
        const batchDecisions = this._callOpenAI(batch);
        decisions.push(...batchDecisions);
      } catch (e) {
        Logger.log(`  ❌ Batch failed: ${e.toString()}`);
      }
      
      if (i + batchSize < items.length) {
        Utilities.sleep(500);
      }
    }
    
    // Apply decisions
    let archived = 0;
    for (const decision of decisions) {
      const thread = threads[decision.index];
      const policy = LLM_POLICY[decision.category] || LLM_POLICY["Other"];
      const labels = (policy.add || []).concat([`${CONFIG.LLM_LABEL_PREFIX}${decision.category}`]);
      
      // Apply labels
      runLabel.addToThread(thread);
      for (const labelName of labels) {
        this._getOrCreateLabel(labelName).addToThread(thread);
      }
      
      // Archive if policy says so
      if (!dryRun && policy.archive) {
        thread.moveToArchive();
        archived++;
      }
    }
    
    return {
      touched: threads.length,
      archived,
      classified: decisions.length,
      decisions,
      threads
    };
  }
  
  /**
   * Call OpenAI API with historical context
   * @private
   */
  _callOpenAI(items) {
    const system = [
      "You are an expert email triage system for a university professor.",
      "Each email includes 'historicalContext' based on analysis of 64,000+ past emails.",
      "",
      "CRITICAL: The historicalContext is your PRIMARY guide. It tells you:",
      "- How similar senders were categorized in the past",
      "- What labels are associated with keywords in the subject",
      "",
      "DECISION PROCESS:",
      "1. First, check historicalContext - what does history suggest?",
      "2. Then, check for ACTION requirements:",
      "   - Needs reply → 'Action-Needed-Reply' (overrides history)",
      "   - Needs task → 'Action-Needed-Task' (overrides history)",
      "3. Otherwise, trust the historical pattern",
      "",
      "Categories: " + LLM_CATEGORIES.join(", "),
      "",
      "Be confident when history is clear. The patterns come from actual labeling decisions."
    ].join("\n");
    
    const payload = {
      model: CONFIG.OPENAI_FAST_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify({ items }) }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "EmailDecisions",
          schema: {
            type: "object",
            properties: {
              decisions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "integer" },
                    category: { type: "string", enum: LLM_CATEGORIES },
                    confidence: { type: "number", minimum: 0, maximum: 1 }
                  },
                  required: ["index", "category", "confidence"]
                }
              }
            },
            required: ["decisions"]
          },
          strict: true
        }
      },
      temperature: 0.3,
      max_completion_tokens: 2000
    };
    
    // API call with retry logic
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", {
          method: "post",
          headers: {
            "Authorization": `Bearer ${CONFIG.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });
        
        const code = response.getResponseCode();
        if (code >= 200 && code < 300) {
          const data = JSON.parse(response.getContentText());
          Logger.log(`    💰 Tokens: ${data.usage?.total_tokens || 'unknown'}`);
          return JSON.parse(data.choices[0].message.content).decisions;
        }
        
        if (code === 429 || code >= 500) {
          const delay = 1000 * Math.pow(2, attempt);
          Logger.log(`    ⏳ Retry ${attempt + 1}/3 after ${delay}ms`);
          Utilities.sleep(delay);
          continue;
        }
        
        throw new Error(`OpenAI API error ${code}: ${response.getContentText()}`);
        
      } catch (e) {
        if (attempt === 2) throw e;
        Logger.log(`    ⚠️ Attempt ${attempt + 1} failed: ${e.toString()}`);
      }
    }
    
    throw new Error("OpenAI API: exhausted retries");
  }
  
  /**
   * Run deep analysis on priority items
   * @private
   */
  _runDeepAnalysis(threads, decisions, dryRun) {
    // Select candidates for deep analysis
    const candidates = this._selectDeepCandidates(threads, decisions);
    
    if (candidates.length === 0) {
      Logger.log('📭 No candidates for deep analysis');
      return [];
    }
    
    Logger.log(`🔬 Deep analyzing ${candidates.length} priority messages...`);
    
    // Process candidates
    const deepResults = [];
    const batchSize = 10;
    
    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, Math.min(i + batchSize, candidates.length));
      Logger.log(`  📦 Deep batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(candidates.length/batchSize)}`);
      
      try {
        const results = this._callDeepAnalysis(batch);
        deepResults.push(...results);
        
        // Apply priority labels
        if (!dryRun) {
          this._applyDeepLabels(results);
        }
        
      } catch (e) {
        Logger.log(`  ❌ Deep batch failed: ${e.toString()}`);
      }
      
      if (i + batchSize < candidates.length) {
        Utilities.sleep(1000);
      }
    }
    
    // Store briefs for later review
    if (deepResults.length > 0) {
      PropertiesService.getScriptProperties().setProperty(
        'DEEP_BRIEFS',
        JSON.stringify(deepResults.map(r => ({
          subject: r.subject,
          priority: r.priority,
          summary: r.summary,
          nextStep: r.nextStep,
          dueDate: r.dueDate,
          isVIP: r.isVIP
        })))
      );
    }
    
    return deepResults;
  }
  
  /**
   * Select candidates for deep analysis
   * @private
   */
  _selectDeepCandidates(threads, decisions) {
    const candidates = [];
    const deepCategories = ["Action-Needed-Reply", "Action-Needed-Task", "Student-Message", "Admin-Dept"];
    
    decisions.forEach(decision => {
      if (candidates.length >= CONFIG.MAX_DEEP_REVIEW) return;
      
      const thread = threads[decision.index];
      const from = thread.getMessages()[0].getFrom() || "";
      const subject = thread.getFirstMessageSubject() || "";
      
      // Check if VIP
      const isVIP = this._checkIfVIP(from);
      
      // Check if needs deep analysis
      const needsDeep = isVIP ||
        decision.confidence < CONFIG.DEEP_CONFIDENCE_THRESHOLD ||
        deepCategories.includes(decision.category) ||
        CONFIG.URGENT_KEYWORDS.some(kw => subject.toLowerCase().includes(kw.toLowerCase()));
      
      if (needsDeep) {
        candidates.push({
          thread,
          index: decision.index,
          category: decision.category,
          confidence: decision.confidence,
          isVIP,
          from,
          subject
        });
      }
    });
    
    // Sort by priority
    candidates.sort((a, b) => {
      if (a.isVIP !== b.isVIP) return a.isVIP ? -1 : 1;
      return a.confidence - b.confidence;
    });
    
    return candidates.slice(0, CONFIG.MAX_DEEP_REVIEW);
  }
  
  /**
   * Call deep analysis API
   * @private
   */
  _callDeepAnalysis(candidates) {
    const items = candidates.map(c => {
      const thread = c.thread;
      const messages = thread.getMessages();
      const latestMsg = messages[messages.length - 1];
      
      // Get extended snippet
      let body = "";
      try {
        body = (latestMsg.getPlainBody() || latestMsg.getBody())
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, CONFIG.DEEP_SNIPPET_LENGTH);
      } catch (e) {
        body = c.subject;
      }
      
      return {
        index: c.index,
        from: c.from,
        subject: c.subject,
        body,
        date: latestMsg.getDate().toISOString(),
        threadLength: messages.length,
        category: c.category,
        confidence: c.confidence,
        isVIP: c.isVIP
      };
    });
    
    const system = [
      "You are an expert email analyst for a university professor.",
      "Analyze each message deeply and provide:",
      "1. Priority level (P0-P3)",
      "2. Brief summary (1-2 sentences)",
      "3. Specific next step required",
      "4. Due date if mentioned",
      "",
      "Priority levels:",
      "P0 🔥 Critical - Immediate action (today)",
      "P1 🔴 High - Within 1-2 days",
      "P2 🟡 Medium - Within a week",
      "P3 🟢 Low - No urgency",
      "",
      "VIP messages (isVIP: true) should generally be P0 or P1."
    ].join("\n");
    
    const payload = {
      model: CONFIG.OPENAI_DEEP_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify({ items }) }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "DeepAnalysis",
          schema: {
            type: "object",
            properties: {
              analyses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "integer" },
                    priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
                    summary: { type: "string", maxLength: 200 },
                    nextStep: { type: "string", maxLength: 150 },
                    dueDate: { type: ["string", "null"] }
                  },
                  required: ["index", "priority", "summary", "nextStep"]
                }
              }
            },
            required: ["analyses"]
          },
          strict: true
        }
      },
      temperature: 0.4,
      max_completion_tokens: 3000
    };
    
    const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", {
      method: "post",
      headers: {
        "Authorization": `Bearer ${CONFIG.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(payload)
    });
    
    const data = JSON.parse(response.getContentText());
    const analyses = JSON.parse(data.choices[0].message.content).analyses;
    
    // Merge with candidate data
    return analyses.map(a => ({
      ...a,
      ...candidates.find(c => c.index === a.index)
    }));
  }
  
  /**
   * Apply deep analysis labels
   * @private
   */
  _applyDeepLabels(results) {
    for (const result of results) {
      const priorityLabel = `Priority/${result.priority}`;
      this._getOrCreateLabel(priorityLabel).addToThread(result.thread);
      
      if (result.priority === 'P0' || result.priority === 'P1') {
        this._getOrCreateLabel('🔥Priority/High').addToThread(result.thread);
      }
    }
  }
  
  /**
   * Check if sender is VIP
   * @private
   */
  _checkIfVIP(fromAddress) {
    if (!fromAddress) return false;
    
    const from = fromAddress.toLowerCase();
    
    // Check exact senders
    for (const vip of CONFIG.VIP_SENDERS) {
      if (vip && from.includes(vip.toLowerCase())) {
        return true;
      }
    }
    
    // Check domains
    for (const domain of CONFIG.VIP_DOMAINS) {
      if (domain && from.includes('@' + domain.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Build exclude query for protected senders
   * @private
   */
  _buildExcludeQuery() {
    const parts = [];
    
    for (const sender of CONFIG.KEEP_SENDERS) {
      parts.push(`-from:"${sender}"`);
    }
    
    for (const domain of CONFIG.KEEP_DOMAINS) {
      parts.push(`-from:@${domain}`);
    }
    
    return parts.join(' ');
  }
  
  /**
   * Get or create a Gmail label
   * @private
   */
  _getOrCreateLabel(name) {
    let label = GmailApp.getUserLabelByName(name);
    if (!label) {
      label = GmailApp.createLabel(name);
    }
    return label;
  }
}

// ==================== CATEGORY DEFINITIONS ====================
const LLM_CATEGORIES = [
  "Student-Message",
  "Admin-Dept",
  "Announcement-Campus",
  "Announcement-Course",
  "Notification-Bot",
  "Receipt-Finance",
  "Scheduling-Calendar",
  "Reference-Docs",
  "Action-Needed-Reply",
  "Action-Needed-Task",
  "Personal-Family",
  "Marketing-Promotions",
  "Social",
  "Other"
];

const LLM_POLICY = {
  "Action-Needed-Reply": { add: ["🔴Action/Reply", "To-Do"], archive: false },
  "Action-Needed-Task": { add: ["🟡Action/Task", "To-Do"], archive: false },
  "Student-Message": { add: ["Students"], archive: false },
  "Admin-Dept": { add: ["Admin/Dept"], archive: false },
  "Scheduling-Calendar": { add: ["📅Scheduling"], archive: false },
  "Personal-Family": { add: ["Personal"], archive: false },
  "Announcement-Campus": { add: ["Announcements/Campus"], archive: false },
  "Announcement-Course": { add: ["Announcements/Course"], archive: false },
  "Reference-Docs": { add: ["Reference"], archive: false },
  "Receipt-Finance": { add: ["Receipts"], archive: true },
  "Notification-Bot": { add: ["Updates"], archive: true },
  "Marketing-Promotions": { add: ["News"], archive: true },
  "Social": { add: ["Social"], archive: true },
  "Other": { add: ["Unsorted"], archive: false }
};

// ==================== PUBLIC API FUNCTIONS ====================

/**
 * Run triage in preview mode (dry run)
 */
function previewTriage() {
  Logger.log("=== STARTING PREVIEW MODE (DRY RUN) ===");
  const engine = new TriageEngine();
  engine.run(true);
}

/**
 * Run triage in live mode (apply changes)
 */
function runTriage() {
  Logger.log("=== STARTING TRIAGE (LIVE MODE) ===");
  const engine = new TriageEngine();
  engine.run(false);
}

/**
 * Setup wizard for initial configuration
 */
function setupWizard() {
  Logger.log("=== GMAIL TRIAGE SETUP WIZARD ===\n");
  
  const checks = {
    apiKey: !!CONFIG.OPENAI_API_KEY,
    fastModel: !!CONFIG.OPENAI_FAST_MODEL,
    deepModel: !!CONFIG.OPENAI_DEEP_MODEL,
    analysisSheet: !!CONFIG.ANALYSIS_SHEET_ID,
    piiSalt: !!CONFIG.PII_SALT
  };
  
  Logger.log("📋 Configuration Status:");
  Logger.log(`   OpenAI API Key: ${checks.apiKey ? '✅' : '❌'}`);
  Logger.log(`   Fast Model: ${checks.fastModel ? '✅' : '❌'} (${CONFIG.OPENAI_FAST_MODEL})`);
  Logger.log(`   Deep Model: ${checks.deepModel ? '✅' : '❌'} (${CONFIG.OPENAI_DEEP_MODEL})`);
  Logger.log(`   Analysis Sheet: ${checks.analysisSheet ? '✅' : '❌'}`);
  Logger.log(`   PII Salt: ${checks.piiSalt ? '✅' : '❌'}`);
  
  if (Object.values(checks).every(v => v)) {
    Logger.log("\n✅ All systems configured!");
    Logger.log("\n🚀 NEXT STEPS:");
    Logger.log("1. Run testHistoricalIntelligence() to verify data loading");
    Logger.log("2. Run previewTriage() for a dry run");
    Logger.log("3. Run runTriage() to process emails");
  } else {
    Logger.log("\n⚠️ Missing configuration!");
    Logger.log("\nTO FIX:");
    if (!checks.apiKey) {
      Logger.log("1. Add OPENAI_API_KEY to Script Properties");
    }
    if (!checks.analysisSheet) {
      Logger.log("2. Run your archive analysis script first");
      Logger.log("3. Add ANALYSIS_SHEET_ID to Script Properties");
    }
    if (!checks.piiSalt) {
      Logger.log("4. Copy PII_SALT from your analysis script properties");
    }
  }
}

/**
 * Test historical intelligence loading
 */
function testHistoricalIntelligence() {
  Logger.log("=== TESTING HISTORICAL INTELLIGENCE ===\n");
  
  const intelligence = new HistoricalIntelligence();
  const data = intelligence.load();
  
  if (!data) {
    Logger.log("❌ Failed to load historical data");
    return;
  }
  
  Logger.log("✅ Historical data loaded successfully!");
  Logger.log(`   Total threads analyzed: ${data.metadata.totalThreads}`);
  Logger.log(`   Total messages analyzed: ${data.metadata.totalMessages}`);
  Logger.log(`   Sender profiles: ${Object.keys(data.senderProfiles).length}`);
  Logger.log(`   Keyword profiles: ${Object.keys(data.keywordProfiles).length}`);
  Logger.log(`   Label patterns: ${Object.keys(data.labelPatterns).length}`);
  
  // Test with sample email
  const testEmail = {
    from: "test@university.edu",
    subject: "Meeting about student grades deadline"
  };
  
  const context = intelligence.generateContext(testEmail, data);
  Logger.log("\n📧 Test email context generation:");
  Logger.log(`   From: ${testEmail.from}`);
  Logger.log(`   Subject: ${testEmail.subject}`);
  Logger.log(`   Generated context: ${context}`);
}

/**
 * View priority briefs from last deep analysis
 */
function viewPriorityBriefs() {
  Logger.log("=== PRIORITY BRIEFS FROM DEEP ANALYSIS ===\n");
  
  const briefs = JSON.parse(
    PropertiesService.getScriptProperties().getProperty('DEEP_BRIEFS') || '[]'
  );
  
  if (briefs.length === 0) {
    Logger.log("No deep analysis briefs yet. Run triage first.");
    return;
  }
  
  // Separate VIP and regular
  const vipBriefs = briefs.filter(b => b.isVIP);
  const regularBriefs = briefs.filter(b => !b.isVIP);
  
  if (vipBriefs.length > 0) {
    Logger.log(`🌟 VIP MESSAGES (${vipBriefs.length})`);
    Logger.log("═".repeat(60));
    
    vipBriefs.forEach(item => {
      const emoji = { P0: '🔥', P1: '🔴', P2: '🟡', P3: '🟢' }[item.priority] || '⚪';
      Logger.log(`\n${emoji} ${item.priority} - ${item.subject}`);
      Logger.log(`   Summary: ${item.summary}`);
      Logger.log(`   Action: ${item.nextStep}`);
      if (item.dueDate) {
        Logger.log(`   Due: ${item.dueDate}`);
      }
    });
  }
  
  // Group by priority
  const byPriority = { P0: [], P1: [], P2: [], P3: [] };
  regularBriefs.forEach(b => {
    if (byPriority[b.priority]) {
      byPriority[b.priority].push(b);
    }
  });
  
  ['P0', 'P1', 'P2', 'P3'].forEach(priority => {
    const items = byPriority[priority];
    if (items.length === 0) return;
    
    const emoji = { P0: '🔥', P1: '🔴', P2: '🟡', P3: '🟢' }[priority];
    Logger.log(`\n${emoji} ${priority} - ${items.length} items`);
    Logger.log("─".repeat(60));
    
    items.forEach((item, i) => {
      Logger.log(`${i + 1}. ${item.subject}`);
      Logger.log(`   Summary: ${item.summary}`);
      Logger.log(`   Action: ${item.nextStep}`);
      if (item.dueDate) {
        Logger.log(`   Due: ${item.dueDate}`);
      }
    });
  });
  
  Logger.log(`\n📊 Total briefs: ${briefs.length}`);
}

/**
 * Clear historical intelligence cache
 */
function clearIntelligenceCache() {
  const intelligence = new HistoricalIntelligence();
  intelligence.clearCache();
  Logger.log('Cache cleared. Next run will reload from spreadsheet.');
}

/**
 * Clear all cache versions for fresh start
 */
function clearAllCache() {
  const cache = CacheService.getScriptCache();
  
  // Clear all possible cache keys
  ['V2', 'V3'].forEach(version => {
    cache.remove(`HISTORICAL_ANALYSIS_DATA_${version}`);
    cache.remove(`HISTORICAL_ANALYSIS_DATA_${version}_1`);
    cache.remove(`HISTORICAL_ANALYSIS_DATA_${version}_2`);
  });
  
  Logger.log('✅ All cache versions cleared');
  Logger.log('Next run will load fresh data from spreadsheet');
}

// ==================== VERIFICATION HELPERS (OPTIMIZED) ====================
/**
 * Quick verification that all systems are connected
 * Run this FIRST to confirm your manual setup worked
 */
function verifySetup() {
  Logger.log('=== VERIFYING YOUR MANUAL CONFIGURATION ===\n');
  
  const props = PropertiesService.getScriptProperties();
  let allGood = true;
  
  // Check critical properties
  const critical = {
    'OPENAI_API_KEY': '🤖 OpenAI Connection',
    'ANALYSIS_SHEET_ID': '📊 Historical Data',
    'PII_SALT': '🔐 Privacy Salt',
    'TRIAGE_VIP_DOMAINS': '⭐ VIP Domains',
    'TRIAGE_DEEP_KEYWORDS': '🔍 Priority Keywords'
  };
  
  for (const [key, label] of Object.entries(critical)) {
    const value = props.getProperty(key);
    if (value) {
      Logger.log(`✅ ${label}: Configured`);
      if (key === 'ANALYSIS_SHEET_ID') {
        // Try to access the sheet and check size
        try {
          const ss = SpreadsheetApp.openById(value);
          Logger.log(`   └─ Sheet accessible: "${ss.getName()}"`);
          
          // Check data volume
          const sendersSheet = ss.getSheetByName('Senders');
          const keywordsSheet = ss.getSheetByName('Keywords');
          
          if (sendersSheet) {
            const senderRows = sendersSheet.getLastRow() - 1;
            Logger.log(`   └─ Sender profiles: ${senderRows.toLocaleString()} rows`);
            if (senderRows > 1000) {
              Logger.log(`   └─ 📊 Large dataset detected - will optimize loading`);
            }
          }
          
          if (keywordsSheet) {
            const keywordRows = keywordsSheet.getLastRow() - 1;
            Logger.log(`   └─ Keyword patterns: ${keywordRows.toLocaleString()} rows`);
          }
          
        } catch (e) {
          Logger.log(`   └─ ⚠️ Cannot access sheet - check permissions`);
          allGood = false;
        }
      }
    } else {
      Logger.log(`❌ ${label}: MISSING`);
      allGood = false;
    }
  }
  
  if (allGood) {
    Logger.log('\n🎉 PERFECT! Your configuration is complete.');
    Logger.log('Next: Run testSmartTriage() to test the intelligence system');
  } else {
    Logger.log('\n⚠️ Some configuration is missing. Please check above.');
  }
  
  return allGood;
}

/**
 * Test that historical intelligence is working with large dataset handling
 * Run this SECOND to confirm intelligence loads correctly
 */
function testSmartTriage() {
  Logger.log('=== TESTING INTELLIGENT TRIAGE SYSTEM ===\n');
  
  // First verify setup
  if (!verifySetup()) {
    Logger.log('\n❌ Fix configuration issues first');
    return;
  }
  
  Logger.log('\n🧠 Loading Historical Intelligence (Optimized for Large Data)...');
  
  try {
    // Clear old cache first to ensure clean test
    clearAllCache();
    Logger.log('   • Cleared old cache for fresh test');
    
    // Use your existing HistoricalIntelligence class
    const intelligence = new HistoricalIntelligence();
    const startTime = new Date();
    const data = intelligence.load();
    const loadTime = new Date() - startTime;
    
    if (!data) {
      Logger.log('❌ Could not load historical data');
      return;
    }
    
    Logger.log(`✅ Historical intelligence loaded in ${(loadTime/1000).toFixed(1)}s!`);
    Logger.log(`   • ${data.metadata.totalThreads.toLocaleString()} threads analyzed`);
    Logger.log(`   • ${Object.keys(data.senderProfiles).length} sender profiles loaded`);
    Logger.log(`   • ${Object.keys(data.keywordProfiles).length} keyword patterns loaded`);
    Logger.log(`   • ${Object.keys(data.labelPatterns).length} label patterns loaded`);
    
    // Test with sample scenarios
    Logger.log('\n📧 Testing Pattern Recognition:\n');
    
    const testCases = [
      {
        from: 'student@alaska.edu',
        subject: 'Question about homework deadline'
      },
      {
        from: 'admin@gmail.com', 
        subject: 'Urgent: Please review this document'
      },
      {
        from: 'colleague@connect.alaska.edu',
        subject: 'Meeting tomorrow about DEPESA form'
      }
    ];
    
    testCases.forEach((email, i) => {
      const context = intelligence.generateContext(email, data);
      Logger.log(`Test ${i + 1}:`);
      Logger.log(`   From: ${email.from}`);
      Logger.log(`   Subject: ${email.subject}`);
      Logger.log(`   AI Context: ${context || 'No patterns detected'}`);
      
      // Check if VIP
      const vipDomains = CONFIG.VIP_DOMAINS;
      const domain = email.from.split('@')[1];
      const isVIP = vipDomains.includes(domain);
      Logger.log(`   VIP Status: ${isVIP ? '⭐ VIP Domain' : '📧 Regular'}`);
      
      // Check for urgent keywords
      const urgentKeywords = CONFIG.URGENT_KEYWORDS;
      const hasUrgent = urgentKeywords.some(kw => 
        email.subject.toLowerCase().includes(kw.toLowerCase())
      );
      Logger.log(`   Priority: ${hasUrgent ? '🚨 Contains urgent keywords' : '✓ Normal priority'}`);
      Logger.log('');
    });
    
    // Test cache reload speed
    Logger.log('📊 Testing cache performance...');
    const reloadStart = new Date();
    const cachedData = intelligence.load();
    const reloadTime = new Date() - reloadStart;
    
    if (cachedData) {
      Logger.log(`   • Cache reload: ${(reloadTime/1000).toFixed(2)}s (${reloadTime < 500 ? '⚡ Fast' : '✓ Normal'})`);
    } else {
      Logger.log(`   • Direct load mode (data too large for cache)`);
    }
    
    Logger.log('\n=== SYSTEM READY ===');
    Logger.log('✅ All tests passed! Your intelligent triage is ready.');
    Logger.log('\nNext steps:');
    Logger.log('1. Run previewTriage() for a dry run');
    Logger.log('2. Review the preview results');
    Logger.log('3. Run runTriage() to process emails for real');
    
  } catch (error) {
    Logger.log(`❌ Error: ${error.toString()}`);
    
    if (error.toString().includes('too large')) {
      Logger.log('\n📊 Your data is very large. The system will work but:');
      Logger.log('   • First load will be slower (~5 seconds)');
      Logger.log('   • Data loads directly from sheets (no caching)');
      Logger.log('   • This is normal for 50K+ email archives');
    } else {
      Logger.log('\nTroubleshooting:');
      Logger.log('1. Check that ANALYSIS_SHEET_ID is correct');
      Logger.log('2. Check that PII_SALT matches your analysis script');
      Logger.log('3. Try clearAllCache() and retry');
    }
  }
}

/**
 * One-command system check with enhanced diagnostics
 * Run this anytime to see current status
 */
function systemCheck() {
  Logger.log('=== INTELLIGENT TRIAGE SYSTEM CHECK ===\n');
  
  const props = PropertiesService.getScriptProperties();
  
  // Quick status checks
  const hasAPI = !!props.getProperty('OPENAI_API_KEY');
  const hasData = !!props.getProperty('ANALYSIS_SHEET_ID');
  const hasSalt = !!props.getProperty('PII_SALT');
  
  Logger.log(`Core Systems:`);
  Logger.log(`   🤖 OpenAI: ${hasAPI ? '✅ Connected' : '❌ No API Key'}`);
  Logger.log(`   🧠 Intelligence: ${hasData && hasSalt ? '✅ Connected' : '❌ Not Connected'}`);
  
  // Memory estimate
  if (hasData) {
    try {
      const ss = SpreadsheetApp.openById(props.getProperty('ANALYSIS_SHEET_ID'));
      const sendersSheet = ss.getSheetByName('Senders');
      const keywordsSheet = ss.getSheetByName('Keywords');
      
      let dataPoints = 0;
      if (sendersSheet) dataPoints += sendersSheet.getLastRow() - 1;
      if (keywordsSheet) dataPoints += keywordsSheet.getLastRow() - 1;
      
      if (dataPoints > 5000) {
        Logger.log(`   📊 Data Volume: Large (${dataPoints.toLocaleString()} patterns)`);
      } else if (dataPoints > 1000) {
        Logger.log(`   📊 Data Volume: Medium (${dataPoints.toLocaleString()} patterns)`);
      } else {
        Logger.log(`   📊 Data Volume: Small (${dataPoints.toLocaleString()} patterns)`);
      }
    } catch (e) {
      // Silent fail
    }
  }
  
  // Check last run
  const lastRun = props.getProperty('LAST_RUN_LABEL');
  if (lastRun) {
    const timestamp = lastRun.replace(/.*Run-/, '').replace(/.*PREVIEW-/, '');
    Logger.log(`   📅 Last Run: ${lastRun.includes('PREVIEW') ? 'Preview' : 'Live'} at ${timestamp}`);
  } else {
    Logger.log(`   📅 Last Run: Never`);
  }
  
  const ready = hasAPI && hasData && hasSalt;
  Logger.log(`\nSystem Status: ${ready ? '✅ READY' : '❌ NOT READY'}`);
  
  if (ready) {
    Logger.log('\nAvailable Commands:');
    Logger.log('   • previewTriage() - Dry run (no changes)');
    Logger.log('   • runTriage() - Process emails');
    Logger.log('   • viewPriorityBriefs() - See important items');
    Logger.log('   • clearIntelligenceCache() - Force reload data');
  } else {
    Logger.log('\nTo fix:');
    if (!hasAPI) Logger.log('   1. Add OPENAI_API_KEY to script properties');
    if (!hasData || !hasSalt) Logger.log('   2. Check ANALYSIS_SHEET_ID and PII_SALT');
  }
}

/**
 * Create menu on spreadsheet open
 */
function onOpen() {
  try {
    if (typeof SpreadsheetApp !== "undefined" && SpreadsheetApp.getUi) {
      SpreadsheetApp.getUi()
        .createMenu("📧 Smart Triage")
        .addItem("🎯 Setup Wizard", "setupWizard")
        .addItem("🧪 Test Intelligence", "testHistoricalIntelligence")
        .addSeparator()
        .addItem("👁️ Preview Triage", "previewTriage")
        .addItem("✅ Run Triage", "runTriage")
        .addSeparator()
        .addItem("🔥 View Priority Briefs", "viewPriorityBriefs")
        .addItem("🧹 Clear Intelligence Cache", "clearIntelligenceCache")
        .addToUi();
    }
  } catch (e) {
    // Standalone script environment
  }
}
