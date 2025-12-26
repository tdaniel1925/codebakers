# Email Design Module
# HTML Emails, MJML, Responsive Templates, Transactional & Marketing

---

## Email Development Reality

Email HTML is stuck in 1999. What works:
- Tables for layout (not divs)
- Inline styles (not CSS classes)
- Limited CSS support (especially Outlook)
- Max width ~600px for mobile

---

## MJML (Recommended Framework)

### Setup

```bash
npm install mjml mjml-react
```

### Basic MJML Template

```typescript
// emails/welcome.mjml
import mjml2html from 'mjml';

const welcomeEmail = `
<mjml>
  <mj-head>
    <mj-title>Welcome to {{company}}</mj-title>
    <mj-preview>Thanks for signing up!</mj-preview>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
      <mj-text font-size="14px" color="#333333" line-height="1.5" />
      <mj-button background-color="#007bff" color="#ffffff" border-radius="4px" />
    </mj-attributes>
    <mj-style>
      .footer-link { color: #666666; text-decoration: underline; }
    </mj-style>
  </mj-head>

  <mj-body background-color="#f4f4f4">
    <!-- Header -->
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-image
          src="{{logoUrl}}"
          alt="{{company}}"
          width="150px"
          align="center"
        />
      </mj-column>
    </mj-section>

    <!-- Main Content -->
    <mj-section background-color="#ffffff" padding="30px 20px">
      <mj-column>
        <mj-text font-size="24px" font-weight="bold" align="center">
          Welcome, {{firstName}}!
        </mj-text>

        <mj-text padding-top="20px">
          Thanks for joining {{company}}. We're excited to have you on board.
        </mj-text>

        <mj-text>
          Here's what you can do next:
        </mj-text>

        <mj-text padding-left="20px">
          • Complete your profile<br/>
          • Explore our features<br/>
          • Invite your team
        </mj-text>

        <mj-button href="{{dashboardUrl}}" padding-top="20px">
          Go to Dashboard
        </mj-button>
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section padding="20px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#666666">
          {{company}} | 123 Street, City, Country
        </mj-text>
        <mj-text align="center" font-size="12px" color="#666666">
          <a href="{{unsubscribeUrl}}" class="footer-link">Unsubscribe</a> |
          <a href="{{preferencesUrl}}" class="footer-link">Email Preferences</a>
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;

export function renderWelcomeEmail(data: {
  company: string;
  firstName: string;
  logoUrl: string;
  dashboardUrl: string;
  unsubscribeUrl: string;
  preferencesUrl: string;
}) {
  // Replace placeholders
  let template = welcomeEmail;
  for (const [key, value] of Object.entries(data)) {
    template = template.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  // Compile to HTML
  const { html, errors } = mjml2html(template, {
    validationLevel: 'soft',
    minify: true,
  });

  if (errors.length > 0) {
    console.error('MJML errors:', errors);
  }

  return html;
}
```

---

## React Email (Modern Alternative)

### Setup

```bash
npm install @react-email/components react-email
```

### React Email Template

```tsx
// emails/welcome.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface WelcomeEmailProps {
  firstName: string;
  company: string;
  dashboardUrl: string;
  logoUrl: string;
}

export function WelcomeEmail({
  firstName,
  company,
  dashboardUrl,
  logoUrl,
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to {company}!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Img src={logoUrl} alt={company} width="150" height="40" />
          </Section>

          {/* Content */}
          <Section style={content}>
            <Heading style={h1}>Welcome, {firstName}!</Heading>

            <Text style={text}>
              Thanks for joining {company}. We're excited to have you on board.
            </Text>

            <Text style={text}>Here's what you can do next:</Text>

            <ul style={list}>
              <li>Complete your profile</li>
              <li>Explore our features</li>
              <li>Invite your team</li>
            </ul>

            <Button href={dashboardUrl} style={button}>
              Go to Dashboard
            </Button>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              {company} | 123 Street, City, Country
            </Text>
            <Text style={footerText}>
              <Link href="#" style={footerLink}>Unsubscribe</Link>
              {' | '}
              <Link href="#" style={footerLink}>Email Preferences</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: '#f4f4f4',
  fontFamily: 'Arial, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  maxWidth: '600px',
};

const header = {
  padding: '20px',
  textAlign: 'center' as const,
};

const content = {
  padding: '30px 20px',
};

const h1 = {
  color: '#333333',
  fontSize: '24px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '0 0 20px',
};

const text = {
  color: '#333333',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 15px',
};

const list = {
  color: '#333333',
  fontSize: '14px',
  lineHeight: '1.8',
  paddingLeft: '20px',
};

const button = {
  backgroundColor: '#007bff',
  borderRadius: '4px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: 'bold',
  padding: '12px 24px',
  textDecoration: 'none',
  textAlign: 'center' as const,
};

const footer = {
  backgroundColor: '#f4f4f4',
  padding: '20px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#666666',
  fontSize: '12px',
  margin: '0 0 5px',
};

const footerLink = {
  color: '#666666',
  textDecoration: 'underline',
};

export default WelcomeEmail;
```

### Render React Email

```typescript
// lib/email/render.ts
import { render } from '@react-email/render';
import { WelcomeEmail } from '@/emails/welcome';

export async function renderWelcomeEmail(props: Parameters<typeof WelcomeEmail>[0]) {
  return render(WelcomeEmail(props));
}

// Usage with Resend
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWelcomeEmail(to: string, firstName: string) {
  const html = await renderWelcomeEmail({
    firstName,
    company: 'Acme Inc',
    dashboardUrl: 'https://app.acme.com/dashboard',
    logoUrl: 'https://acme.com/logo.png',
  });

  await resend.emails.send({
    from: 'Acme <hello@acme.com>',
    to,
    subject: 'Welcome to Acme!',
    html,
  });
}
```

---

## Common Email Templates

### Password Reset

```tsx
// emails/password-reset.tsx
export function PasswordResetEmail({ resetUrl, expiresIn }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Reset your password</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Reset Your Password</Heading>

          <Text style={text}>
            We received a request to reset your password. Click the button below
            to create a new password.
          </Text>

          <Button href={resetUrl} style={button}>
            Reset Password
          </Button>

          <Text style={textSmall}>
            This link expires in {expiresIn}. If you didn't request this,
            you can safely ignore this email.
          </Text>

          <Text style={textSmall}>
            Or copy this link: {resetUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

### Invoice / Receipt

```tsx
// emails/invoice.tsx
interface InvoiceEmailProps {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  tax: number;
  total: number;
  paymentUrl: string;
}

export function InvoiceEmail({
  invoiceNumber,
  items,
  subtotal,
  tax,
  total,
  paymentUrl
}: InvoiceEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Invoice #{invoiceNumber}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Invoice #{invoiceNumber}</Heading>

          {/* Items table */}
          <Section>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Item</th>
                  <th style={th}>Qty</th>
                  <th style={thRight}>Price</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td style={td}>{item.name}</td>
                    <td style={td}>{item.quantity}</td>
                    <td style={tdRight}>${item.price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} style={td}>Subtotal</td>
                  <td style={tdRight}>${subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={td}>Tax</td>
                  <td style={tdRight}>${tax.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={tdBold}>Total</td>
                  <td style={tdRightBold}>${total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </Section>

          <Button href={paymentUrl} style={button}>
            Pay Now
          </Button>
        </Container>
      </Body>
    </Html>
  );
}

const table = {
  width: '100%',
  borderCollapse: 'collapse' as const,
};

const th = {
  borderBottom: '1px solid #dddddd',
  padding: '10px',
  textAlign: 'left' as const,
};

const thRight = { ...th, textAlign: 'right' as const };

const td = {
  borderBottom: '1px solid #eeeeee',
  padding: '10px',
};

const tdRight = { ...td, textAlign: 'right' as const };
const tdBold = { ...td, fontWeight: 'bold' };
const tdRightBold = { ...tdRight, fontWeight: 'bold' };
```

### Team Invitation

```tsx
// emails/team-invite.tsx
export function TeamInviteEmail({
  inviterName,
  teamName,
  inviteUrl,
  expiresIn
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>{inviterName} invited you to join {teamName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>You're Invited!</Heading>

          <Text style={text}>
            <strong>{inviterName}</strong> has invited you to join{' '}
            <strong>{teamName}</strong>.
          </Text>

          <Button href={inviteUrl} style={button}>
            Accept Invitation
          </Button>

          <Text style={textSmall}>
            This invitation expires in {expiresIn}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

---

## Outlook Compatibility

Outlook uses Word as its rendering engine. Here are fixes:

```typescript
// Outlook-specific fixes
const outlookButton = `
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:w="urn:schemas-microsoft-com:office:word"
  href="${url}"
  style="height:40px;v-text-anchor:middle;width:200px;"
  arcsize="10%"
  strokecolor="#007bff"
  fillcolor="#007bff">
  <w:anchorlock/>
  <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">
    ${text}
  </center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<a href="${url}" style="...">
  ${text}
</a>
<!--<![endif]-->
`;

// Outlook image fix (prevents scaling)
const outlookImage = `
<!--[if gte mso 9]>
<v:image xmlns:v="urn:schemas-microsoft-com:vml"
  src="${imageUrl}"
  style="width:600px;height:auto;" />
<![endif]-->
<!--[if !mso]><!-->
<img src="${imageUrl}" width="600" style="max-width:100%;" />
<!--<![endif]-->
`;
```

### Safe CSS Properties

```typescript
// CSS that works everywhere
const safeStyles = {
  // Typography
  fontFamily: 'Arial, Helvetica, sans-serif', // Web-safe fonts only
  fontSize: '14px',
  fontWeight: 'bold',
  lineHeight: '1.5',
  color: '#333333',
  textAlign: 'center',
  textDecoration: 'none',

  // Box model
  padding: '20px',
  margin: '0',
  width: '100%',
  maxWidth: '600px',

  // Background
  backgroundColor: '#ffffff',

  // Borders (no border-radius in Outlook)
  border: '1px solid #dddddd',
  borderTop: '1px solid #dddddd',
  borderBottom: '1px solid #dddddd',

  // Display
  display: 'block', // or 'inline-block'
};

// CSS that DOESN'T work in Outlook
const unsafeStyles = {
  // AVOID these
  borderRadius: '4px',     // No support
  boxShadow: '...',        // No support
  flexbox: '...',          // No support
  grid: '...',             // No support
  position: 'absolute',    // Broken
  float: 'left',           // Broken
  backgroundImage: '...',  // Broken in some versions
};
```

---

## Dark Mode Support

```tsx
// Dark mode meta tag
<Head>
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <style>{`
    @media (prefers-color-scheme: dark) {
      .dark-mode-bg { background-color: #1a1a1a !important; }
      .dark-mode-text { color: #ffffff !important; }
    }

    /* Outlook.com dark mode */
    [data-ogsc] .dark-mode-bg { background-color: #1a1a1a !important; }
    [data-ogsc] .dark-mode-text { color: #ffffff !important; }
  `}</style>
</Head>

<Body>
  <Container className="dark-mode-bg">
    <Text className="dark-mode-text">
      This text adapts to dark mode
    </Text>
  </Container>
</Body>
```

---

## Email Testing

### Preview in Development

```typescript
// emails/preview.tsx
// Run: npx email dev
import { WelcomeEmail } from './welcome';

export function WelcomePreview() {
  return (
    <WelcomeEmail
      firstName="John"
      company="Acme Inc"
      dashboardUrl="https://app.acme.com"
      logoUrl="https://via.placeholder.com/150x40"
    />
  );
}
```

### Test with Mailtrap

```typescript
// lib/email/test.ts
import nodemailer from 'nodemailer';

const testTransport = nodemailer.createTransport({
  host: 'sandbox.smtp.mailtrap.io',
  port: 2525,
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASS,
  },
});

export async function sendTestEmail(html: string, subject: string) {
  await testTransport.sendMail({
    from: 'test@example.com',
    to: 'test@example.com',
    subject: `[TEST] ${subject}`,
    html,
  });
}
```

### Litmus / Email on Acid Testing Checklist

Before sending:
- [ ] Gmail (web + mobile)
- [ ] Outlook 365 / 2019 / 2016
- [ ] Outlook.com
- [ ] Apple Mail (macOS + iOS)
- [ ] Yahoo Mail
- [ ] Samsung Mail (Android)
- [ ] Dark mode in all clients

---

## Marketing Email Best Practices

### CAN-SPAM Compliance

```tsx
// Required elements
<Section style={footer}>
  {/* 1. Physical address */}
  <Text>Company Name, 123 Street, City, State 12345</Text>

  {/* 2. Unsubscribe link */}
  <Link href="{{unsubscribeUrl}}">Unsubscribe</Link>

  {/* 3. Why they're receiving this */}
  <Text>
    You're receiving this because you signed up at example.com
  </Text>
</Section>
```

### Subject Lines

```typescript
// Good subject lines
const goodSubjects = [
  'Your order has shipped',          // Clear, actionable
  'John, your report is ready',      // Personalized
  '3 tips to improve your workflow', // Value-focused
  'Quick question about your account', // Curiosity
];

// Bad subject lines
const badSubjects = [
  'Newsletter #47',                  // Boring
  'AMAZING DEAL!!!',                 // Spammy
  'Open this email',                 // Vague
  'Re: Re: Fwd:',                   // Deceptive
];
```

### Preheader Text

```tsx
// Preheader = preview text in inbox
<Preview>
  {/* Good: Extends the subject line */}
  Your weekly analytics report is ready. See what's trending.

  {/* Add invisible spacer to prevent body text showing */}
  {'\u00A0'.repeat(150)}
</Preview>
```

---

## Email Template System

```typescript
// lib/email/templates.ts
import { render } from '@react-email/render';
import * as templates from '@/emails';

type TemplateProps = {
  welcome: Parameters<typeof templates.WelcomeEmail>[0];
  'password-reset': Parameters<typeof templates.PasswordResetEmail>[0];
  invoice: Parameters<typeof templates.InvoiceEmail>[0];
  'team-invite': Parameters<typeof templates.TeamInviteEmail>[0];
};

export async function renderEmail<T extends keyof TemplateProps>(
  template: T,
  props: TemplateProps[T]
): Promise<{ html: string; text: string }> {
  const Component = templates[templateMap[template]];

  const html = render(Component(props));
  const text = render(Component(props), { plainText: true });

  return { html, text };
}

const templateMap = {
  welcome: 'WelcomeEmail',
  'password-reset': 'PasswordResetEmail',
  invoice: 'InvoiceEmail',
  'team-invite': 'TeamInviteEmail',
} as const;

// Usage
const { html, text } = await renderEmail('welcome', {
  firstName: 'John',
  company: 'Acme',
  dashboardUrl: 'https://app.acme.com',
  logoUrl: 'https://acme.com/logo.png',
});
```

---

## Quality Checklist

Before sending:
- [ ] Tested in Gmail, Outlook, Apple Mail
- [ ] Dark mode looks acceptable
- [ ] Links work and track correctly
- [ ] Images have alt text
- [ ] Unsubscribe link works
- [ ] Physical address included
- [ ] Preheader text is set
- [ ] Mobile responsive (stacks on small screens)
- [ ] Plain text version exists
- [ ] Subject line under 50 chars
- [ ] From name is recognizable
