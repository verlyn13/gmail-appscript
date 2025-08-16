/**
 * Vitest setup file
 * Runs before all test files
 */

import { beforeAll, afterEach, afterAll } from 'vitest';

// Mock Google Apps Script globals
globalThis.GmailApp = {
  search: () => [],
  getThreadById: () => null,
  getUserLabelByName: () => null,
  createLabel: () => ({}),
  sendEmail: () => {},
  getUserLabels: () => []
} as any;

globalThis.SpreadsheetApp = {
  openById: () => ({
    getSheetByName: () => null,
    insertSheet: () => ({
      appendRow: () => {}
    })
  })
} as any;

globalThis.ScriptApp = {
  getProjectTriggers: () => [],
  deleteTrigger: () => {},
  newTrigger: () => ({
    timeBased: () => ({
      everyHours: () => ({ create: () => {} }),
      everyDays: () => ({ create: () => {} }),
      everyMinutes: () => ({ create: () => {} })
    })
  })
} as any;

globalThis.Gmail = {
  Users: {
    Settings: {
      Filters: {
        create: () => ({})
      }
    }
  }
} as any;

beforeAll(() => {
  console.log('🧪 Starting Vitest tests...');
});

afterEach(() => {
  // Clear all mocks after each test
});

afterAll(() => {
  console.log('✅ Tests completed');
});