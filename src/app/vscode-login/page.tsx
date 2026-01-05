'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const callback = searchParams.get('callback');

    // Build GitHub OAuth URL
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

    if (!clientId) {
      setError('GitHub OAuth not configured');
      return;
    }

    // Create state with callback info for VS Code extension
    // Using btoa() instead of Buffer for browser compatibility
    const state = callback ?
      btoa(JSON.stringify({
        type: 'vscode_login',
        callback
      })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') :
      'web_login';

    // Always use www.codebakers.ai to match GitHub OAuth callback URL
    const redirectUri = 'https://www.codebakers.ai/api/auth/github/callback';

    const githubUrl = new URL('https://github.com/login/oauth/authorize');
    githubUrl.searchParams.set('client_id', clientId);
    githubUrl.searchParams.set('redirect_uri', redirectUri);
    githubUrl.searchParams.set('scope', 'user:email');
    githubUrl.searchParams.set('state', state);

    // Redirect to GitHub
    window.location.href = githubUrl.toString();
  }, [searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">😞</div>
          <h1 className="text-2xl font-bold text-white mb-2">Login Error</h1>
          <p className="text-neutral-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center p-8">
        <div className="text-6xl mb-4 animate-pulse">🍪</div>
        <h1 className="text-2xl font-bold text-white mb-2">Redirecting to GitHub...</h1>
        <p className="text-neutral-400">Please wait while we connect your account.</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-6xl mb-4 animate-pulse">🍪</div>
          <h1 className="text-2xl font-bold text-white mb-2">Loading...</h1>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
