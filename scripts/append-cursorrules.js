const fs = require('fs');
const path = require('path');

const appendContent = `
Assistant: Done! Added OpenAI integration.

I caught something: Your API key was in the client component.

I moved it to an API route (keys should never be in browser code).
Want a quick explanation of why this matters? (/learn)

User: /learn