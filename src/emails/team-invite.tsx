import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface TeamInviteEmailProps {
  inviteUrl: string;
  teamName: string;
  inviterName?: string;
  expiresIn?: string;
}

export function TeamInviteEmail({
  inviteUrl = 'https://codebakers.ai/invite/abc123',
  teamName = 'Acme Inc',
  inviterName = 'John',
  expiresIn = '7 days',
}: TeamInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Join {teamName} on CodeBakers</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Join {teamName} on CodeBakers</Heading>

          <Text style={text}>
            {inviterName ? `${inviterName} has invited you` : "You've been invited"} to join <strong>{teamName}</strong> on CodeBakers.
          </Text>

          <Text style={text}>
            CodeBakers helps development teams build production-ready code faster with AI-powered patterns and best practices.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={inviteUrl}>
              Accept Invitation
            </Button>
          </Section>

          <Text style={text}>
            Or copy and paste this URL into your browser:
          </Text>
          <Text style={link}>
            <Link href={inviteUrl} style={link}>
              {inviteUrl}
            </Link>
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            This invitation expires in {expiresIn}. If you didn't expect this email, you can safely ignore it.
          </Text>

          <Text style={footer}>
            — The CodeBakers Team
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default TeamInviteEmail;

const main = {
  backgroundColor: '#0a0a0a',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: '#171717',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '560px',
  borderRadius: '8px',
};

const h1 = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.25',
  marginBottom: '24px',
  textAlign: 'center' as const,
};

const text = {
  color: '#a3a3a3',
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
  backgroundColor: '#dc2626',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '12px 24px',
  display: 'inline-block',
};

const link = {
  color: '#dc2626',
  fontSize: '14px',
  wordBreak: 'break-all' as const,
};

const hr = {
  borderColor: '#404040',
  marginTop: '32px',
  marginBottom: '32px',
};

const footer = {
  color: '#737373',
  fontSize: '14px',
  lineHeight: '1.5',
  marginBottom: '8px',
};
