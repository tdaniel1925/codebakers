const fs = require('fs');
const path = require('path');

/**
 * Decode all base64-encoded patterns in .claude/ to plain text
 * This makes patterns directly readable by AI without MCP
 */
function decodePatterns() {
  const claudeDir = path.join(process.cwd(), '.claude');

  if (!fs.existsSync(claudeDir)) {
    console.log('No .claude/ directory found');
    return;
  }

  const files = fs.readdirSync(claudeDir).filter(f => f.endsWith('.md'));
  console.log(`Found ${files.length} pattern files in .claude/`);

  let decoded = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of files) {
    const filePath = path.join(claudeDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check if it's base64 encoded
    if (content.trim().startsWith('<<CB64>>')) {
      try {
        // Extract base64 content between markers
        const match = content.match(/<<CB64>>\n([\s\S]*?)\n<<\/CB64>>/);
        if (match) {
          const base64Content = match[1].trim();
          const decodedContent = Buffer.from(base64Content, 'base64').toString('utf-8');

          // Write decoded content back
          fs.writeFileSync(filePath, decodedContent);
          console.log(`✓ Decoded: ${file}`);
          decoded++;
        } else {
          console.log(`⚠ Invalid format: ${file}`);
          errors++;
        }
      } catch (err) {
        console.log(`✗ Error decoding ${file}: ${err.message}`);
        errors++;
      }
    } else {
      console.log(`- Already plain text: ${file}`);
      skipped++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Decoded: ${decoded}`);
  console.log(`  Already plain: ${skipped}`);
  console.log(`  Errors: ${errors}`);
}

decodePatterns();
