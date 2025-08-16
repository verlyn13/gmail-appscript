#!/usr/bin/env node

/**
 * Check pnpm version enforcement
 */

const { execSync } = require('child_process');
const semver = require('semver');

const MINIMUM_PNPM_VERSION = '10.14.0';

try {
  const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' }).trim();
  
  if (!semver.gte(pnpmVersion, MINIMUM_PNPM_VERSION)) {
    console.error(`❌ pnpm version ${pnpmVersion} is too old.`);
    console.error(`   Minimum required version is ${MINIMUM_PNPM_VERSION}`);
    console.error(`   Please upgrade: npm install -g pnpm@latest`);
    process.exit(1);
  }
  
  console.log(`✅ pnpm version ${pnpmVersion} meets requirements`);
  
} catch (error) {
  if (error.code === 'ENOENT' || error.message.includes('not found')) {
    console.error('❌ pnpm is not installed.');
    console.error('   Please install: npm install -g pnpm@latest');
  } else {
    console.error('❌ Error checking pnpm version:', error.message);
  }
  process.exit(1);
}