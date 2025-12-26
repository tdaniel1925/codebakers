const fs = require('fs');
const path = require('path');

async function pushV45() {
  const apiKey = 'cb_b45e0612_45cf7c78c36c57cbfb3c5ca21565fc3d7ca9b9a7c3dbf5f1';
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

  const changelog = `v4.5 Enforcement Rules: Added MANDATORY COMPLIANCE section preventing AI from skipping patterns. Added SESSION CONTEXT CHECK for proper session resumption. Added TASK SIZE DETECTION (TRIVIAL/SMALL/MEDIUM/LARGE) for appropriate process scaling. Added DEBUG/QUICK MODE for faster iteration. Added ANNOUNCE YOUR CLASSIFICATION with escalation triggers for security, payments, and compliance-sensitive tasks.`;

  console.log('\nPushing to', apiUrl + '/api/admin/content/push');

  try {
    const response = await fetch(`${apiUrl}/api/admin/content/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        version: '4.5',
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
