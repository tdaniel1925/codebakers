import { Resend } from 'resend';

const FROM_EMAIL = 'CodeBakers <hello@codebakers.dev>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://codebakers.dev';

// Lazy-load Resend client to avoid initialization errors during build
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// Base email template with consistent branding
function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <a href="${APP_URL}" style="text-decoration: none;">
                <span style="font-size: 28px; font-weight: bold; color: #dc2626;">CodeBakers</span>
              </a>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td style="background-color: #171717; border-radius: 16px; padding: 40px; border: 1px solid #262626;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #525252;">
                Questions? Reply to this email or visit our
                <a href="${APP_URL}" style="color: #dc2626; text-decoration: none;">website</a>.
              </p>
              <p style="margin: 0; font-size: 12px; color: #404040;">
                &copy; ${new Date().getFullYear()} CodeBakers. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// Reusable button component
function ctaButton(text: string, url: string): string {
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
  <tr>
    <td align="center" style="padding: 8px 0;">
      <a href="${url}"
         style="display: inline-block; background-color: #dc2626; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; min-width: 200px; text-align: center;">
        ${text}
      </a>
    </td>
  </tr>
</table>
  `.trim();
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  /**
   * Send a generic email
   */
  static async send({ to, subject, html, text }: SendEmailOptions) {
    const resend = getResendClient();
    if (!resend) {
      console.warn('[EmailService] RESEND_API_KEY not configured, skipping email');
      return { success: false, error: 'Email not configured' };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
      });

      if (error) {
        console.error('[EmailService] Send failed:', error);
        return { success: false, error: error.message };
      }

      console.log('[EmailService] Email sent:', data?.id);
      return { success: true, id: data?.id };
    } catch (err) {
      console.error('[EmailService] Error:', err);
      return { success: false, error: 'Failed to send email' };
    }
  }

  /**
   * Send magic link / email confirmation
   */
  static async sendMagicLink(email: string, confirmUrl: string) {
    const content = `
<h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: bold; color: #ffffff; text-align: center;">
  Confirm your email
</h1>

<p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #a3a3a3; text-align: center;">
  Click the button below to confirm your email address and sign in to CodeBakers.
</p>

${ctaButton('Confirm Email', confirmUrl)}

<p style="margin: 32px 0 0 0; font-size: 14px; color: #525252; text-align: center;">
  This link expires in 24 hours. If you didn't request this, you can safely ignore this email.
</p>

<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #262626;">
  <p style="margin: 0; font-size: 12px; color: #404040; text-align: center;">
    If the button doesn't work, copy and paste this link into your browser:
  </p>
  <p style="margin: 8px 0 0 0; font-size: 12px; color: #dc2626; word-break: break-all; text-align: center;">
    ${confirmUrl}
  </p>
</div>
    `.trim();

    return this.send({
      to: email,
      subject: 'Confirm your email - CodeBakers',
      html: baseTemplate(content),
      text: `Confirm your email\n\nClick this link to confirm your email and sign in: ${confirmUrl}\n\nThis link expires in 24 hours.`,
    });
  }

  /**
   * Send password reset email
   */
  static async sendPasswordReset(email: string, resetUrl: string) {
    const content = `
<h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: bold; color: #ffffff; text-align: center;">
  Reset your password
</h1>

<p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #a3a3a3; text-align: center;">
  We received a request to reset your password. Click the button below to create a new password.
</p>

${ctaButton('Reset Password', resetUrl)}

<p style="margin: 32px 0 0 0; font-size: 14px; color: #525252; text-align: center;">
  This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
</p>

<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #262626;">
  <p style="margin: 0; font-size: 12px; color: #404040; text-align: center;">
    If the button doesn't work, copy and paste this link into your browser:
  </p>
  <p style="margin: 8px 0 0 0; font-size: 12px; color: #dc2626; word-break: break-all; text-align: center;">
    ${resetUrl}
  </p>
</div>
    `.trim();

    return this.send({
      to: email,
      subject: 'Reset your password - CodeBakers',
      html: baseTemplate(content),
      text: `Reset your password\n\nClick this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
    });
  }

  /**
   * Send email change confirmation
   */
  static async sendEmailChange(email: string, confirmUrl: string) {
    const content = `
<h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: bold; color: #ffffff; text-align: center;">
  Confirm your new email
</h1>

<p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #a3a3a3; text-align: center;">
  You requested to change your email address. Click the button below to confirm this change.
</p>

${ctaButton('Confirm New Email', confirmUrl)}

<p style="margin: 32px 0 0 0; font-size: 14px; color: #525252; text-align: center;">
  This link expires in 24 hours. If you didn't request this, please contact support immediately.
</p>

<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #262626;">
  <p style="margin: 0; font-size: 12px; color: #404040; text-align: center;">
    If the button doesn't work, copy and paste this link into your browser:
  </p>
  <p style="margin: 8px 0 0 0; font-size: 12px; color: #dc2626; word-break: break-all; text-align: center;">
    ${confirmUrl}
  </p>
</div>
    `.trim();

    return this.send({
      to: email,
      subject: 'Confirm your new email - CodeBakers',
      html: baseTemplate(content),
      text: `Confirm your new email\n\nClick this link to confirm: ${confirmUrl}\n\nThis link expires in 24 hours.`,
    });
  }

  /**
   * Send welcome email to new users
   */
  static async sendWelcome(email: string, teamName: string) {
    const content = `
<h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: bold; color: #ffffff; text-align: center;">
  Welcome to CodeBakers!
</h1>

<p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #a3a3a3; text-align: center;">
  You're all set to build faster with production-ready patterns.
</p>

<!-- Quick Start Section -->
<div style="background-color: #0a0a0a; border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 1px solid #262626;">
  <h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #ffffff;">
    Get Started in 2 Steps
  </h2>

  <!-- Step 1 -->
  <div style="margin-bottom: 20px;">
    <div style="display: flex; align-items: center; margin-bottom: 8px;">
      <span style="display: inline-block; width: 24px; height: 24px; background-color: #dc2626; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold; margin-right: 12px;">1</span>
      <span style="font-size: 14px; color: #ffffff; font-weight: 500;">Run setup command</span>
    </div>
    <code style="display: block; background-color: #171717; border-radius: 8px; padding: 14px 16px; font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 13px; color: #22c55e; border: 1px solid #262626;">
      npx @codebakers/cli setup
    </code>
  </div>

  <!-- Step 2 -->
  <div>
    <div style="display: flex; align-items: center; margin-bottom: 8px;">
      <span style="display: inline-block; width: 24px; height: 24px; background-color: #dc2626; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold; margin-right: 12px;">2</span>
      <span style="font-size: 14px; color: #ffffff; font-weight: 500;">Enable in Claude Code</span>
    </div>
    <code style="display: block; background-color: #171717; border-radius: 8px; padding: 14px 16px; font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 13px; color: #22c55e; border: 1px solid #262626;">
      /mcp add codebakers npx -y @codebakers/cli serve
    </code>
  </div>
</div>

${ctaButton('Go to Dashboard', `${APP_URL}/dashboard`)}

<!-- What You Get -->
<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #262626;">
  <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
    What's included in your free trial:
  </h3>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td style="padding: 8px 0; color: #a3a3a3; font-size: 14px;">
        <span style="color: #22c55e; margin-right: 8px;">&#10003;</span>
        Unlimited usage for one project
      </td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #a3a3a3; font-size: 14px;">
        <span style="color: #22c55e; margin-right: 8px;">&#10003;</span>
        Access to all 34 production-ready modules
      </td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #a3a3a3; font-size: 14px;">
        <span style="color: #22c55e; margin-right: 8px;">&#10003;</span>
        Claude Code MCP integration
      </td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #a3a3a3; font-size: 14px;">
        <span style="color: #22c55e; margin-right: 8px;">&#10003;</span>
        Smart Prompt Optimizer
      </td>
    </tr>
  </table>
</div>
    `.trim();

    const text = `
Welcome to CodeBakers!

You're all set to build faster with production-ready patterns.

Get Started in 2 Steps:

1. Run setup command:
   npx @codebakers/cli setup

2. Enable in Claude Code:
   /mcp add codebakers npx -y @codebakers/cli serve

Go to Dashboard: ${APP_URL}/dashboard

What's included in your free trial:
- Unlimited usage for one project
- Access to all 34 production-ready modules
- Claude Code MCP integration
- Smart Prompt Optimizer

Questions? Reply to this email.
    `.trim();

    return this.send({
      to: email,
      subject: 'Welcome to CodeBakers - Get Started in 2 Steps',
      html: baseTemplate(content),
      text,
    });
  }

  /**
   * Send upgrade reminder when using multiple projects
   */
  static async sendUpgradeReminder(email: string, currentProject: string) {
    const content = `
<h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: bold; color: #ffffff; text-align: center;">
  Unlock unlimited projects
</h1>

<p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #a3a3a3; text-align: center;">
  Your free trial is locked to <strong style="color: #ffffff;">${currentProject}</strong>.
  Upgrade to Pro to use CodeBakers across all your projects.
</p>

${ctaButton('Upgrade to Pro', `${APP_URL}/billing`)}

<!-- Pro Benefits -->
<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #262626;">
  <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #ffffff; text-align: center;">
    Pro includes:
  </h3>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td style="padding: 8px 0; color: #a3a3a3; font-size: 14px; text-align: center;">
        <span style="color: #22c55e; margin-right: 8px;">&#10003;</span>
        Unlimited projects
      </td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #a3a3a3; font-size: 14px; text-align: center;">
        <span style="color: #22c55e; margin-right: 8px;">&#10003;</span>
        Priority support
      </td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #a3a3a3; font-size: 14px; text-align: center;">
        <span style="color: #22c55e; margin-right: 8px;">&#10003;</span>
        Early access to new patterns
      </td>
    </tr>
  </table>
</div>
    `.trim();

    return this.send({
      to: email,
      subject: 'Unlock unlimited projects - Upgrade to Pro',
      html: baseTemplate(content),
    });
  }

  /**
   * Send team invite email
   */
  static async sendInvite(email: string, inviteUrl: string) {
    const content = `
<h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: bold; color: #ffffff; text-align: center;">
  You've been invited!
</h1>

<p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #a3a3a3; text-align: center;">
  You've been invited to join a team on CodeBakers. Click below to accept the invitation and get started.
</p>

${ctaButton('Accept Invitation', inviteUrl)}

<p style="margin: 32px 0 0 0; font-size: 14px; color: #525252; text-align: center;">
  This invitation expires in 7 days.
</p>

<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #262626;">
  <p style="margin: 0; font-size: 12px; color: #404040; text-align: center;">
    If the button doesn't work, copy and paste this link into your browser:
  </p>
  <p style="margin: 8px 0 0 0; font-size: 12px; color: #dc2626; word-break: break-all; text-align: center;">
    ${inviteUrl}
  </p>
</div>
    `.trim();

    return this.send({
      to: email,
      subject: "You've been invited to CodeBakers",
      html: baseTemplate(content),
      text: `You've been invited to CodeBakers!\n\nClick this link to accept: ${inviteUrl}\n\nThis invitation expires in 7 days.`,
    });
  }

  /**
   * Send subscription confirmation
   */
  static async sendSubscriptionConfirmation(email: string, plan: string) {
    const content = `
<h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: bold; color: #ffffff; text-align: center;">
  You're now on ${plan}!
</h1>

<p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #a3a3a3; text-align: center;">
  Thank you for upgrading. You now have access to all CodeBakers features across unlimited projects.
</p>

${ctaButton('Go to Dashboard', `${APP_URL}/dashboard`)}

<!-- What's Unlocked -->
<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #262626;">
  <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #ffffff; text-align: center;">
    What's unlocked:
  </h3>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td style="padding: 8px 0; color: #a3a3a3; font-size: 14px; text-align: center;">
        <span style="color: #22c55e; margin-right: 8px;">&#10003;</span>
        Unlimited projects
      </td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #a3a3a3; font-size: 14px; text-align: center;">
        <span style="color: #22c55e; margin-right: 8px;">&#10003;</span>
        All 34 production modules
      </td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #a3a3a3; font-size: 14px; text-align: center;">
        <span style="color: #22c55e; margin-right: 8px;">&#10003;</span>
        Priority support
      </td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #a3a3a3; font-size: 14px; text-align: center;">
        <span style="color: #22c55e; margin-right: 8px;">&#10003;</span>
        Early access to new features
      </td>
    </tr>
  </table>
</div>

<p style="margin: 24px 0 0 0; font-size: 14px; color: #525252; text-align: center;">
  Manage your subscription anytime at <a href="${APP_URL}/billing" style="color: #dc2626; text-decoration: none;">codebakers.dev/billing</a>
</p>
    `.trim();

    return this.send({
      to: email,
      subject: `You're now on ${plan} - CodeBakers`,
      html: baseTemplate(content),
    });
  }
}
