const fs = require('fs');
const path = require('path');

async function pushV45() {
  const apiKey = process.env.CODEBAKERS_ADMIN_KEY || 'cb_8417b96d_1348ff738073e7fc495540d6cd4f8e50a91da2bf5c9c2f2e';
  const apiUrl = 'https://codebakers.ai';

  // Read the files
  const claudeMdPath = path.join(__dirname, '..', '..', 'CLAUDE.md');
  const cursorRulesPath = path.join(__dirname, '..', '.cursorrules');

  console.log('Reading CLAUDE.md from:', claudeMdPath);
  console.log('Reading .cursorrules from:', cursorRulesPath);

  const claudeMdContent = fs.readFileSync(claudeMdPath, 'utf-8');
  const cursorRulesContent = fs.readFileSync(cursorRulesPath, 'utf-8');

  console.log('CLAUDE.md size:', (claudeMdContent.length / 1024).toFixed(1), 'KB');
  console.log('.cursorrules size:', (cursorRulesContent.length / 1024).toFixed(1), 'KB');

  const changelog = `v5.9 Two-Gate Enforcement: Added discover_patterns MCP tool (START gate) that must be called BEFORE writing code. Searches codebase for existing patterns and code to follow. Enhanced validate_complete (END gate) to verify discover_patterns was called. Compliance tracking in .codebakers.json.`;

  console.log('\nPushing to', apiUrl + '/api/admin/content/push');

  try {
    const response = await fetch(`${apiUrl}/api/admin/content/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        version: '5.9',
        claudeMdContent,
        cursorRulesContent,
        changelog,
        autoPublish: true,
      }),
    });

    console.log('\nResponse status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));

    const text = await response.text();
    console.log('\nRaw response:', text.substring(0, 500));

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('\nFailed to parse JSON:', e.message);
      console.error('Full response:', text);
      process.exit(1);
    }

    if (!response.ok) {
      console.error('\nPush failed:', data);
      process.exit(1);
    }

    console.log('\n✓ Push successful!');
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('\nError:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

pushV45();
