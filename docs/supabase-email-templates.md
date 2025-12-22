# Supabase Auth Hook Configuration

All emails are sent through Resend via CodeBakers, not Supabase.

## Step 1: Generate a Hook Secret

Generate a random secret for webhook verification:

```bash
openssl rand -hex 32
```

Save this as `SUPABASE_AUTH_HOOK_SECRET` in:
- Vercel environment variables
- Local `.env.local`

## Step 2: Configure Supabase Auth Hook

1. Go to **Supabase Dashboard → Authentication → Hooks**
2. Find **Send Email** hook
3. Enable it and configure:

| Setting | Value |
|---------|-------|
| Hook URL | `https://codebakers.dev/api/auth/email-hook` |
| HTTP Headers | `Content-Type: application/json` |
| Secret | (The secret you generated above) |

## Step 3: Add Environment Variables

### Vercel (Production)
```bash
npx vercel env add SUPABASE_AUTH_HOOK_SECRET
# Paste the secret you generated
```

### Local Development
Add to `.env.local`:
```
SUPABASE_AUTH_HOOK_SECRET=your_generated_secret_here
```

## How It Works

1. User requests signup/login/password reset
2. Supabase calls your webhook (`/api/auth/email-hook`) instead of sending email
3. Webhook receives user info and token
4. Webhook sends email via Resend with CodeBakers branding
5. User clicks link → `/auth/confirm` → verifies token with Supabase

## Email Types Handled

| Supabase Action | Email Sent |
|-----------------|------------|
| `signup` | Confirm Email (magic link style) |
| `magiclink` | Sign In link |
| `recovery` | Password Reset |
| `email_change` | Confirm New Email |
| `invite` | Team Invitation |

## Testing

1. Sign out of CodeBakers
2. Go to login page and request magic link
3. Check email - should have CodeBakers branding (dark theme, red buttons)
4. Click link - should redirect to dashboard

## Troubleshooting

**Emails not sending:**
- Check Vercel logs for `/api/auth/email-hook` errors
- Verify `RESEND_API_KEY` is set
- Verify `SUPABASE_AUTH_HOOK_SECRET` matches in Supabase and Vercel

**Invalid signature errors:**
- Regenerate the secret and update both Supabase and Vercel

**Links not working:**
- Check that `NEXT_PUBLIC_APP_URL` is set to `https://codebakers.dev`
