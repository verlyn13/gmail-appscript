/**
 * Gmail Triage Testing Suite
 * Safe testing functions for work email
 */

// ==================== DRY RUN MODE ====================
/**
 * Process inbox in DRY RUN mode - no changes made
 * Logs all actions that WOULD be taken
 */
function testDryRun() {
  Logger.log('🧪 STARTING DRY RUN TEST - No emails will be modified');
  Logger.log('================================================');
  
  const intelligenceSystem = new HistoricalIntelligence();
  const intelligence = intelligenceSystem.load();
  
  if (!intelligence) {
    Logger.log('⚠️ No historical intelligence loaded - check spreadsheet access');
    return;
  }
  
  Logger.log(`✅ Loaded intelligence from ${intelligence.metadata.emailCount} emails`);
  
  const classifier = new EmailClassifier(intelligence);
  
  // Get LIMITED test batch
  const threads = GmailApp.search(CONFIG.SAFE_GUARD_QUERY + ' newer_than:1d', 0, 5);
  Logger.log(`\n📧 Testing with ${threads.length} recent threads (max 5)`);
  
  const results = [];
  
  for (const thread of threads) {
    const firstMessage = thread.getMessages()[0];
    const sender = classifier._extractSenderEmail(firstMessage.getFrom());
    const subject = thread.getFirstMessageSubject();
    
    const classification = classifier.classifyThread(thread);
    
    const result = {
      subject: subject.substring(0, 50),
      sender: sender,
      currentLabels: thread.getLabels().map(l => l.getName()),
      proposedAction: classification.action,
      proposedLabel: classification.label,
      confidence: classification.confidence,
      reason: classification.reason
    };
    
    results.push(result);
    
    Logger.log('\n------- Email Analysis -------');
    Logger.log(`Subject: ${result.subject}`);
    Logger.log(`From: ${result.sender}`);
    Logger.log(`Current Labels: ${result.currentLabels.join(', ') || 'none'}`);
    Logger.log(`WOULD: ${classification.action}`);
    if (classification.label) {
      Logger.log(`WOULD ADD LABEL: ${classification.label}`);
    }
    Logger.log(`Confidence: ${(classification.confidence * 100).toFixed(0)}%`);
    Logger.log(`Reason: ${classification.reason}`);
  }
  
  Logger.log('\n================================================');
  Logger.log('🧪 DRY RUN COMPLETE - No changes were made');
  Logger.log(`Analyzed ${results.length} emails`);
  
  // Summary stats
  const actions = results.reduce((acc, r) => {
    acc[r.proposedAction] = (acc[r.proposedAction] || 0) + 1;
    return acc;
  }, {});
  
  Logger.log('\nProposed Actions Summary:');
  for (const [action, count] of Object.entries(actions)) {
    Logger.log(`  ${action}: ${count}`);
  }
  
  return results;
}

// ==================== PREVIEW MODE ====================
/**
 * Process with preview labels only - adds PREVIEW- labels but doesn't archive
 */
function testPreviewMode() {
  Logger.log('👁️ STARTING PREVIEW MODE - Will add preview labels only');
  Logger.log('================================================');
  
  const intelligenceSystem = new HistoricalIntelligence();
  const intelligence = intelligenceSystem.load();
  
  if (!intelligence) {
    Logger.log('⚠️ No historical intelligence loaded');
    return;
  }
  
  const classifier = new EmailClassifier(intelligence);
  
  // Get small batch for testing
  const threads = GmailApp.search(CONFIG.SAFE_GUARD_QUERY + ' -label:_Triage/PREVIEW', 0, 10);
  Logger.log(`📧 Processing ${threads.length} threads in preview mode`);
  
  let processed = 0;
  
  for (const thread of threads) {
    try {
      const classification = classifier.classifyThread(thread);
      
      // Add PREVIEW labels only
      const previewLabel = GmailApp.createLabel(`_Triage/PREVIEW-${classification.action}`);
      thread.addLabel(previewLabel);
      
      if (classification.label) {
        const labelPreview = GmailApp.createLabel(`_Triage/PREVIEW-${classification.label}`);
        thread.addLabel(labelPreview);
      }
      
      Logger.log(`✅ Preview labeled: ${thread.getFirstMessageSubject().substring(0, 50)}`);
      Logger.log(`   Action: ${classification.action}, Label: ${classification.label || 'none'}`);
      
      processed++;
      
    } catch (error) {
      Logger.log(`❌ Error: ${error.toString()}`);
    }
  }
  
  Logger.log('\n================================================');
  Logger.log(`👁️ PREVIEW COMPLETE - ${processed} emails labeled for review`);
  Logger.log('Review emails with _Triage/PREVIEW labels');
  Logger.log('Run clearPreviewLabels() to remove preview labels');
}

// ==================== SINGLE EMAIL TEST ====================
/**
 * Test classification on a single email by subject
 * @param {string} subjectKeyword - Part of subject to search for
 */
function testSingleEmail(subjectKeyword) {
  if (!subjectKeyword) {
    Logger.log('❌ Please provide a subject keyword');
    return;
  }
  
  const threads = GmailApp.search(`subject:"${subjectKeyword}"`, 0, 1);
  
  if (threads.length === 0) {
    Logger.log(`❌ No email found with subject containing: ${subjectKeyword}`);
    return;
  }
  
  const thread = threads[0];
  const firstMessage = thread.getMessages()[0];
  
  Logger.log('📧 Email Details:');
  Logger.log(`Subject: ${thread.getFirstMessageSubject()}`);
  Logger.log(`From: ${firstMessage.getFrom()}`);
  Logger.log(`Date: ${firstMessage.getDate()}`);
  Logger.log(`Labels: ${thread.getLabels().map(l => l.getName()).join(', ')}`);
  Logger.log(`Snippet: ${firstMessage.getPlainBody().substring(0, 200)}...`);
  
  // Load intelligence and classify
  const intelligenceSystem = new HistoricalIntelligence();
  const intelligence = intelligenceSystem.load();
  const classifier = new EmailClassifier(intelligence);
  
  const classification = classifier.classifyThread(thread);
  
  Logger.log('\n🎯 Classification Result:');
  Logger.log(`Action: ${classification.action}`);
  Logger.log(`Label: ${classification.label || 'none'}`);
  Logger.log(`Confidence: ${(classification.confidence * 100).toFixed(0)}%`);
  Logger.log(`Reason: ${classification.reason}`);
  
  return classification;
}

// ==================== VERIFICATION TESTS ====================
/**
 * Verify historical intelligence is loading correctly
 */
function testIntelligenceLoading() {
  Logger.log('🧠 Testing Historical Intelligence Loading...');
  
  const intelligenceSystem = new HistoricalIntelligence();
  const intelligence = intelligenceSystem.load();
  
  if (!intelligence) {
    Logger.log('❌ Failed to load intelligence');
    Logger.log('Check ANALYSIS_SHEET_ID in Script Properties');
    return false;
  }
  
  Logger.log('✅ Intelligence loaded successfully');
  Logger.log(`Email count: ${intelligence.metadata.emailCount}`);
  Logger.log(`Sender profiles: ${Object.keys(intelligence.senderProfiles).length}`);
  Logger.log(`Keyword profiles: ${Object.keys(intelligence.keywordProfiles).length}`);
  Logger.log(`Label patterns: ${Object.keys(intelligence.labelPatterns).length}`);
  
  // Show top senders
  Logger.log('\nTop 5 Senders:');
  const topSenders = Object.entries(intelligence.senderProfiles)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);
  
  for (const [sender, profile] of topSenders) {
    Logger.log(`  ${sender}: ${profile.count} emails`);
  }
  
  // Show top keywords
  Logger.log('\nTop 5 Keywords:');
  const topKeywords = Object.entries(intelligence.keywordProfiles)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);
  
  for (const [keyword, profile] of topKeywords) {
    Logger.log(`  "${keyword}": ${profile.count} occurrences → ${profile.commonLabel}`);
  }
  
  return true;
}

/**
 * Test VIP detection
 */
function testVIPDetection() {
  Logger.log('⭐ Testing VIP Detection...');
  
  const classifier = new EmailClassifier(null);
  
  const testCases = [
    'provost@alaska.edu',
    'dean@alaska.edu',
    'someone@alaska.edu',
    'external@gmail.com'
  ];
  
  for (const email of testCases) {
    const isVIP = classifier._isVIP(email);
    Logger.log(`${email}: ${isVIP ? '⭐ VIP' : '  Regular'}`);
  }
}

/**
 * Verify label creation
 */
function testLabelCreation() {
  Logger.log('🏷️ Testing Label Creation...');
  
  const testLabels = [
    '_Triage/TEST-Label1',
    '_Triage/TEST-Label2'
  ];
  
  for (const labelName of testLabels) {
    try {
      const label = GmailApp.createLabel(labelName);
      Logger.log(`✅ Created: ${labelName}`);
    } catch (e) {
      Logger.log(`Label exists: ${labelName}`);
    }
  }
  
  Logger.log('Clean up test labels with clearTestLabels()');
}

// ==================== CLEANUP FUNCTIONS ====================
/**
 * Remove all preview labels
 */
function clearPreviewLabels() {
  const labels = GmailApp.getUserLabels();
  let removed = 0;
  
  for (const label of labels) {
    if (label.getName().startsWith('_Triage/PREVIEW')) {
      label.deleteLabel();
      removed++;
      Logger.log(`Removed: ${label.getName()}`);
    }
  }
  
  Logger.log(`✅ Removed ${removed} preview labels`);
}

/**
 * Remove test labels
 */
function clearTestLabels() {
  const labels = GmailApp.getUserLabels();
  let removed = 0;
  
  for (const label of labels) {
    if (label.getName().includes('TEST')) {
      label.deleteLabel();
      removed++;
      Logger.log(`Removed: ${label.getName()}`);
    }
  }
  
  Logger.log(`✅ Removed ${removed} test labels`);
}

// ==================== SAFETY CHECK ====================
/**
 * Count emails that would be processed
 */
function countProcessableEmails() {
  const count = GmailApp.search(CONFIG.SAFE_GUARD_QUERY, 0, 500).length;
  Logger.log(`📊 ${count} emails match processing criteria`);
  
  if (count > 100) {
    Logger.log('⚠️ Large batch detected - consider adjusting MAX_PER_RUN');
  }
  
  return count;
}

// ==================== TEST RUNNER ====================
/**
 * Run all verification tests
 */
function runAllTests() {
  Logger.log('🚀 RUNNING ALL TESTS');
  Logger.log('===================\n');
  
  // 1. Test intelligence loading
  if (!testIntelligenceLoading()) {
    Logger.log('❌ CRITICAL: Intelligence loading failed');
    return;
  }
  
  // 2. Test VIP detection
  testVIPDetection();
  
  // 3. Count processable emails
  countProcessableEmails();
  
  // 4. Dry run test
  const results = testDryRun();
  
  Logger.log('\n===================');
  Logger.log('✅ ALL TESTS COMPLETE');
  Logger.log('Review results above before enabling production');
  
  return results;
}