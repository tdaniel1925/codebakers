'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const callback = searchParams.get('callback');

      // Build GitHub OAuth URL
      const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

      console.log('vscode-login: clientId exists?', !!clientId);
      console.log('vscode-login: callback?', callback?.substring(0, 50));

      if (!clientId) {
        setError('GitHub OAuth not configured');
        return;
      }

      // Create state with callback info for VS Code extension
      // Using btoa() instead of Buffer for browser compatibility
      let state = 'web_login';
      if (callback) {
        try {
          const stateObj = JSON.stringify({
            type: 'vscode_login',
            callback
          });
          // btoa() only works with ASCII, so we first encode to UTF-8 via encodeURIComponent
          // Then convert to base64url format (replace + with -, / with _, strip =)
          state = btoa(unescape(encodeURIComponent(stateObj)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        } catch (encodeErr) {
          console.error('vscode-login: Failed to encode state:', encodeErr);
          // Fallback to simple state
          state = 'vscode_login';
        }
      }

      // Always use www.codebakers.ai to match GitHub OAuth callback URL
      const redirectUri = 'https://www.codebakers.ai/api/auth/github/callback';

      const githubUrl = new URL('https://github.com/login/oauth/authorize');
      githubUrl.searchParams.set('client_id', clientId);
      githubUrl.searchParams.set('redirect_uri', redirectUri);
      githubUrl.searchParams.set('scope', 'user:email');
      githubUrl.searchParams.set('state', state);

      const finalUrl = githubUrl.toString();
      console.log('vscode-login: Redirecting to:', finalUrl.substring(0, 100));

      // Redirect to GitHub
      window.location.href = finalUrl;
    } catch (err) {
      console.error('vscode-login: Error in redirect:', err);
      setError(`Redirect failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
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
