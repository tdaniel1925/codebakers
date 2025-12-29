#!/usr/bin/env node

/**
 * Automatically registers a new CLI version with the CodeBakers server
 * Called automatically after npm publish via postpublish hook
 */

const fs = require('fs');
const path = require('path');

const API_URL = process.env.CODEBAKERS_API_URL || 'https://codebakers.ai';
const ADMIN_API_KEY = process.env.CODEBAKERS_ADMIN_KEY;

async function registerVersion() {
  // Read version from package.json
  const packagePath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  const version = pkg.version;

  console.log(`\n📦 Registering CLI version ${version} with CodeBakers server...\n`);

  if (!ADMIN_API_KEY) {
    console.log('⚠️  CODEBAKERS_ADMIN_KEY not set - skipping auto-registration');
    console.log('   You can manually add this version in Admin → CLI Versions\n');
    return;
  }

  try {
    // Read changelog if it exists
    let changelog = '';
    const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
    if (fs.existsSync(changelogPath)) {
      const content = fs.readFileSync(changelogPath, 'utf-8');
      // Extract the latest version's changes
      const match = content.match(/## \[?\d+\.\d+\.\d+\]?[^\n]*\n([\s\S]*?)(?=## \[?\d+\.\d+\.\d+|$)/);
      if (match) {
        changelog = match[1].trim().slice(0, 2000); // Limit length
      }
    }

    const response = await fetch(`${API_URL}/api/cli/register-version`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_API_KEY}`,
      },
      body: JSON.stringify({
        version,
        npmTag: 'latest',
        changelog,
        minNodeVersion: '18',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Version ${version} registered successfully!`);
      console.log(`   Status: ${data.data?.version?.status || 'draft'}`);
      console.log(`\n   Next steps:`);
      console.log(`   1. Test the version`);
      console.log(`   2. Go to Admin → CLI Versions`);
      console.log(`   3. Promote to "testing" then "stable"`);
      console.log(`   4. Enable auto-update when ready\n`);
    } else {
      const error = await response.json().catch(() => ({}));
      if (error.error?.includes('already exists')) {
        console.log(`ℹ️  Version ${version} already registered\n`);
      } else {
        console.log(`⚠️  Failed to register: ${error.error || response.statusText}`);
        console.log(`   You can manually add this version in Admin → CLI Versions\n`);
      }
    }
  } catch (error) {
    console.log(`⚠️  Could not reach server: ${error.message}`);
    console.log(`   You can manually add this version in Admin → CLI Versions\n`);
  }
}

registerVersion();
