# EMAIL INTEGRATION
# Module: 06b-email.md
# Load with: 00-core.md
# Covers: Nylas, Resend, React Email templates

---

## NYLAS EMAIL INTEGRATION

### Nylas Setup

```typescript
// lib/nylas/client.ts
import Nylas from 'nylas';

if (!process.env.NYLAS_API_KEY) {
  throw new Error('NYLAS_API_KEY is not set');
}

export const nylas = new Nylas({
  apiKey: process.env.NYLAS_API_KEY,
  apiUri: process.env.NYLAS_API_URI || 'https://api.us.nylas.com',
});
```

### Nylas Service

```typescript
// services/nylas-service.ts
import { nylas } from '@/lib/nylas/client';

interface SendEmailParams {
  grantId: string;
  to: { email: string; name?: string }[];
  subject: string;
  body: string;
  cc?: { email: string; name?: string }[];
  bcc?: { email: string; name?: string }[];
  replyTo?: { email: string; name?: string }[];
  attachments?: {
    filename: string;
    contentType: string;
    content: string; // base64
  }[];
}

interface ListMessagesParams {
  grantId: string;
  limit?: number;
  pageToken?: string;
  folderId?: string;
  unread?: boolean;
  from?: string;
  to?: string;
  subject?: string;
}

export class NylasService {
  /**
   * Get OAuth authorization URL
   */
  static getAuthUrl(redirectUri: string, state: string) {
    return nylas.auth.urlForOAuth2({
      clientId: process.env.NYLAS_CLIENT_ID!,
      redirectUri,
      state,
      loginHint: '',
      provider: 'google', // or 'microsoft', 'imap'
    });
  }

  /**
   * Exchange code for grant
   */
  static async exchangeCodeForGrant(code: string, redirectUri: string) {
    return nylas.auth.exchangeCodeForToken({
      clientId: process.env.NYLAS_CLIENT_ID!,
      clientSecret: process.env.NYLAS_CLIENT_SECRET!,
      code,
      redirectUri,
    });
  }

  /**
   * Send email
   */
  static async sendEmail(params: SendEmailParams) {
    return nylas.messages.send({
      identifier: params.grantId,
      requestBody: {
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        replyTo: params.replyTo,
        subject: params.subject,
        body: params.body,
        attachments: params.attachments?.map((att) => ({
          filename: att.filename,
          contentType: att.contentType,
          content: att.content,
        })),
      },
    });
  }

  /**
   * List messages
   */
  static async listMessages(params: ListMessagesParams) {
    const queryParams: any = {
      limit: params.limit || 50,
    };

    if (params.pageToken) queryParams.pageToken = params.pageToken;
    if (params.folderId) queryParams.in = params.folderId;
    if (params.unread !== undefined) queryParams.unread = params.unread;
    if (params.from) queryParams.from = params.from;
    if (params.to) queryParams.to = params.to;
    if (params.subject) queryParams.subject = params.subject;

    return nylas.messages.list({
      identifier: params.grantId,
      queryParams,
    });
  }

  /**
   * Get single message
   */
  static async getMessage(grantId: string, messageId: string) {
    return nylas.messages.find({
      identifier: grantId,
      messageId,
    });
  }

  /**
   * List folders
   */
  static async listFolders(grantId: string) {
    return nylas.folders.list({
      identifier: grantId,
    });
  }

  /**
   * Create draft
   */
  static async createDraft(
    grantId: string,
    draft: {
      to: { email: string; name?: string }[];
      subject: string;
      body: string;
    }
  ) {
    return nylas.drafts.create({
      identifier: grantId,
      requestBody: draft,
    });
  }

  /**
   * List calendar events
   */
  static async listEvents(
    grantId: string,
    calendarId: string,
    startTime: number,
    endTime: number
  ) {
    return nylas.events.list({
      identifier: grantId,
      queryParams: {
        calendarId,
        start: startTime.toString(),
        end: endTime.toString(),
      },
    });
  }

  /**
   * Create calendar event
   */
  static async createEvent(
    grantId: string,
    calendarId: string,
    event: {
      title: string;
      description?: string;
      when: {
        startTime: number;
        endTime: number;
      };
      participants?: { email: string; name?: string }[];
      location?: string;
    }
  ) {
    return nylas.events.create({
      identifier: grantId,
      queryParams: { calendarId },
      requestBody: {
        title: event.title,
        description: event.description,
        when: {
          startTime: event.when.startTime,
          endTime: event.when.endTime,
        },
        participants: event.participants,
        location: event.location,
      },
    });
  }
}
```

---

## RESEND EMAIL INTEGRATION

### Resend Setup

```typescript
// lib/email/client.ts
import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not set');
}

export const resend = new Resend(process.env.RESEND_API_KEY);

export const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@yourdomain.com';
```

### Email Service

```typescript
// services/email-service.ts
import { resend, EMAIL_FROM } from '@/lib/email/client';
import {
  WelcomeEmail,
  PasswordResetEmail,
  InviteEmail,
  InvoiceEmail,
  NotificationEmail,
} from '@/lib/email/templates';

type EmailTemplate =
  | 'welcome'
  | 'password-reset'
  | 'invite'
  | 'invoice'
  | 'notification';

interface SendEmailParams {
  to: string | string[];
  template: EmailTemplate;
  variables: Record<string, any>;
  subject?: string;
}

export class EmailService {
  /**
   * Send email using template
   */
  static async send(params: SendEmailParams): Promise<{ id: string }> {
    const { to, template, variables, subject } = params;

    let emailComponent: React.ReactElement;
    let emailSubject: string;

    switch (template) {
      case 'welcome':
        emailSubject = subject || `Welcome to ${variables.appName}!`;
        emailComponent = WelcomeEmail(variables);
        break;

      case 'password-reset':
        emailSubject = subject || 'Reset your password';
        emailComponent = PasswordResetEmail(variables);
        break;

      case 'invite':
        emailSubject = subject || `You've been invited to join ${variables.organizationName}`;
        emailComponent = InviteEmail(variables);
        break;

      case 'invoice':
        emailSubject = subject || `Invoice #${variables.invoiceNumber}`;
        emailComponent = InvoiceEmail(variables);
        break;

      case 'notification':
        emailSubject = subject || variables.title;
        emailComponent = NotificationEmail(variables);
        break;

      default:
        throw new Error(`Unknown email template: ${template}`);
    }

    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: Array.isArray(to) ? to : [to],
      subject: emailSubject,
      react: emailComponent,
    });

    if (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return { id: data!.id };
  }

  /**
   * Send bulk emails
   */
  static async sendBulk(
    recipients: { email: string; variables: Record<string, any> }[],
    template: EmailTemplate,
    baseSubject?: string
  ): Promise<{ sent: number; failed: number }> {
    const results = await Promise.allSettled(
      recipients.map((recipient) =>
        this.send({
          to: recipient.email,
          template,
          variables: recipient.variables,
          subject: baseSubject,
        })
      )
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return { sent, failed };
  }
}
```

---

## REACT EMAIL TEMPLATES

### Welcome Email

```typescript
// lib/email/templates/welcome.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface WelcomeEmailProps {
  name: string;
  appName: string;
  loginUrl: string;
}

export function WelcomeEmail({ name, appName, loginUrl }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to {appName}!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to {appName}!</Heading>

          <Text style={text}>Hi {name},</Text>

          <Text style={text}>
            Thanks for signing up! We're excited to have you on board.
          </Text>

          <Text style={text}>
            Get started by logging into your account:
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={loginUrl}>
              Go to Dashboard
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            If you didn't create an account, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '560px',
};

const h1 = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.25',
  marginBottom: '24px',
};

const text = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '1.5',
  marginBottom: '16px',
};

const buttonContainer = {
  textAlign: 'center' as const,
  marginTop: '32px',
  marginBottom: '32px',
};

const button = {
  backgroundColor: '#000000',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '12px 24px',
};

const hr = {
  borderColor: '#e6e6e6',
  margin: '32px 0',
};

const footer = {
  color: '#8c8c8c',
  fontSize: '14px',
  lineHeight: '1.5',
};
```

### Password Reset Email

```typescript
// lib/email/templates/password-reset.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface PasswordResetEmailProps {
  name: string;
  resetUrl: string;
  expiresIn: string;
}

export function PasswordResetEmail({
  name,
  resetUrl,
  expiresIn,
}: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your password</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Reset your password</Heading>

          <Text style={text}>Hi {name},</Text>

          <Text style={text}>
            We received a request to reset your password. Click the button
            below to choose a new password:
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={resetUrl}>
              Reset Password
            </Button>
          </Section>

          <Text style={text}>
            This link will expire in {expiresIn}.
          </Text>

          <Text style={footer}>
            If you didn't request a password reset, you can safely ignore
            this email. Your password will remain unchanged.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '560px',
};

const h1 = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '600',
  marginBottom: '24px',
};

const text = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '1.5',
  marginBottom: '16px',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#000000',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  padding: '12px 24px',
};

const footer = {
  color: '#8c8c8c',
  fontSize: '14px',
  marginTop: '32px',
};
```

### Team Invite Email

```typescript
// lib/email/templates/invite.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface InviteEmailProps {
  inviterName: string;
  organizationName: string;
  inviteUrl: string;
  role: string;
}

export function InviteEmail({
  inviterName,
  organizationName,
  inviteUrl,
  role,
}: InviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>You've been invited to join {organizationName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>You're invited!</Heading>

          <Text style={text}>
            {inviterName} has invited you to join <strong>{organizationName}</strong> as
            a {role}.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={inviteUrl}>
              Accept Invitation
            </Button>
          </Section>

          <Text style={footer}>
            This invitation will expire in 7 days.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '560px',
};

const h1 = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '600',
  marginBottom: '24px',
};

const text = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '1.5',
  marginBottom: '16px',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#000000',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  padding: '12px 24px',
};

const footer = {
  color: '#8c8c8c',
  fontSize: '14px',
  marginTop: '32px',
};
```

---

## Environment Variables

```env
# Nylas Integration
NYLAS_API_KEY=
NYLAS_CLIENT_ID=
NYLAS_CLIENT_SECRET=
NYLAS_API_URI=https://api.us.nylas.com

# Resend Integration
RESEND_API_KEY=
EMAIL_FROM=noreply@yourdomain.com
```

---
