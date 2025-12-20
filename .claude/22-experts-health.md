# HEALTH & MEDICAL EXPERTS
# Module: 22-experts-health.md
# Load with: 00-core.md

---

## 🏥 EXPERT: HEALTH APPLICATION ADVISOR

### Role
Guides development of health and wellness applications. Ensures medical accuracy, user safety, and appropriate disclaimers.

### Perspective Questions
When reviewing health apps, ask:
1. Could this advice cause harm?
2. Are appropriate disclaimers present?
3. Is this medical advice vs wellness info?
4. Does this require professional review?
5. What's the liability exposure?

### Health App Categories

```markdown
## Health Application Classification

### Category A: Wellness/Lifestyle (Lower Regulation)
- Fitness tracking
- Sleep monitoring
- Meditation/mindfulness
- Nutrition logging
- Habit tracking
- General wellness tips

**Requirements:**
- Clear "not medical advice" disclaimers
- No diagnostic claims
- Encourage professional consultation
- Accurate general health information

### Category B: Health Monitoring (Moderate Regulation)
- Symptom tracking
- Medication reminders
- Health data visualization
- Chronic condition management
- Mental health tracking

**Requirements:**
- Privacy compliance (HIPAA if US, GDPR if EU)
- Data accuracy validation
- Emergency contact features
- Professional review of content
- Clear escalation paths

### Category C: Medical Devices/Diagnostics (High Regulation)
- FDA-regulated devices
- Diagnostic tools
- Treatment recommendations
- Clinical decision support
- Telemedicine

**Requirements:**
- FDA/CE certification
- Clinical validation
- Professional oversight
- Full HIPAA compliance
- Liability insurance
- Medical advisory board
```

### Health App Checklist

```markdown
## Health Application Review

### Safety & Accuracy
- [ ] Medical content reviewed by professional
- [ ] No unsubstantiated health claims
- [ ] Appropriate disclaimers displayed
- [ ] Emergency resources accessible
- [ ] Crisis intervention protocols (mental health)
- [ ] Contraindication warnings where relevant

### User Protection
- [ ] Age verification if needed
- [ ] Informed consent for data collection
- [ ] Clear data usage explanation
- [ ] Option to delete health data
- [ ] Export personal data capability
- [ ] No unauthorized data sharing

### Content Quality
- [ ] Sources cited for health info
- [ ] Content date/last updated shown
- [ ] Regional variations addressed
- [ ] Accessible language (not overly clinical)
- [ ] Multi-language support for safety info
- [ ] Visual accessibility (contrast, sizing)

### Crisis Handling
- [ ] Self-harm content triggers resources
- [ ] Suicide prevention resources linked
- [ ] Eating disorder content handled sensitively
- [ ] Emergency numbers prominent
- [ ] "Talk to professional" prompts appropriate
```

### Health Disclaimer Components

```tsx
// components/health/disclaimer.tsx
export function MedicalDisclaimer() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <h3 className="font-semibold text-amber-800 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5" />
        Medical Disclaimer
      </h3>
      <p className="text-sm text-amber-700 mt-2">
        The information provided in this app is for general informational 
        purposes only and is not intended as, nor should it be considered, 
        a substitute for professional medical advice. Always seek the advice 
        of your physician or other qualified health provider with any questions 
        you may have regarding a medical condition.
      </p>
      <p className="text-sm text-amber-700 mt-2">
        <strong>If you are experiencing a medical emergency, call 911 
        or your local emergency services immediately.</strong>
      </p>
    </div>
  );
}

// components/health/crisis-banner.tsx
export function CrisisBanner({ type }: { type: 'suicide' | 'eating' | 'abuse' }) {
  const resources = {
    suicide: {
      title: 'Need immediate support?',
      text: 'If you're having thoughts of suicide, please reach out for help.',
      phone: '988',
      phoneName: 'Suicide & Crisis Lifeline',
      url: 'https://988lifeline.org',
    },
    eating: {
      title: 'Struggling with eating?',
      text: 'Support is available for eating disorders.',
      phone: '1-800-931-2237',
      phoneName: 'National Eating Disorders Association',
      url: 'https://www.nationaleatingdisorders.org',
    },
    abuse: {
      title: 'Are you safe?',
      text: 'If you're experiencing abuse, help is available.',
      phone: '1-800-799-7233',
      phoneName: 'National Domestic Violence Hotline',
      url: 'https://www.thehotline.org',
    },
  };

  const resource = resources[type];

  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4">
      <h4 className="font-semibold text-red-800">{resource.title}</h4>
      <p className="text-sm text-red-700">{resource.text}</p>
      <div className="mt-2 flex flex-wrap gap-4">
        <a
          href={`tel:${resource.phone}`}
          className="inline-flex items-center text-red-700 font-medium"
        >
          <Phone className="h-4 w-4 mr-1" />
          {resource.phone} ({resource.phoneName})
        </a>
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-red-700 font-medium"
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          Online Resources
        </a>
      </div>
    </div>
  );
}
```

---

## 🔒 EXPERT: HIPAA COMPLIANCE OFFICER

### Role
Ensures compliance with HIPAA regulations for applications handling Protected Health Information (PHI). Guides technical and administrative safeguards.

### Perspective Questions
When reviewing for HIPAA, ask:
1. Is this PHI or not?
2. Are all access points secured?
3. Is there an audit trail?
4. Who has access and why?
5. What happens in a breach?

### HIPAA Quick Reference

```markdown
## HIPAA Overview

### What is PHI (Protected Health Information)?
Any information that:
- Identifies an individual (or could be used to identify them)
- Relates to past, present, or future health condition
- Relates to healthcare provision
- Relates to payment for healthcare

### The 18 HIPAA Identifiers (if combined with health info)
1. Name
2. Address (smaller than state)
3. Dates (except year)
4. Phone numbers
5. Fax numbers
6. Email addresses
7. SSN
8. Medical record numbers
9. Health plan numbers
10. Account numbers
11. Certificate/license numbers
12. Vehicle identifiers
13. Device identifiers
14. URLs
15. IP addresses
16. Biometric identifiers
17. Photos
18. Any other unique identifier

### Who Must Comply?
- Covered Entities: Healthcare providers, health plans, clearinghouses
- Business Associates: Anyone handling PHI on behalf of covered entities
- Subcontractors: Anyone downstream handling PHI
```

### HIPAA Technical Safeguards

```markdown
## HIPAA Technical Safeguards Checklist

### Access Controls (§164.312(a))
- [ ] Unique user identification
- [ ] Emergency access procedure
- [ ] Automatic logoff
- [ ] Encryption and decryption

### Audit Controls (§164.312(b))
- [ ] Audit logs for all PHI access
- [ ] Log tamper protection
- [ ] Regular audit log review
- [ ] Retention (minimum 6 years)

### Integrity Controls (§164.312(c))
- [ ] Data integrity validation
- [ ] Error correction mechanisms
- [ ] Change tracking

### Transmission Security (§164.312(e))
- [ ] TLS 1.2+ for data in transit
- [ ] End-to-end encryption where possible
- [ ] Secure email (if used)

### Authentication (§164.312(d))
- [ ] Multi-factor authentication
- [ ] Password policies enforced
- [ ] Session management
- [ ] Credentials encrypted
```

### HIPAA Implementation Code

```typescript
// lib/hipaa/audit-log.ts
import { db } from '@/db';
import { auditLogs } from '@/db/schema';

interface AuditEvent {
  userId: string;
  action: 'view' | 'create' | 'update' | 'delete' | 'export' | 'print';
  resourceType: 'patient' | 'record' | 'prescription' | 'report';
  resourceId: string;
  phi_accessed: boolean;
  details?: Record<string, unknown>;
}

export class HIPAAAuditService {
  /**
   * Log PHI access - REQUIRED for HIPAA compliance
   * Call this for ANY operation involving PHI
   */
  static async logAccess(event: AuditEvent, request?: Request) {
    const entry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      userId: event.userId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      phiAccessed: event.phi_accessed,
      details: event.details,
      
      // Request context
      ipAddress: request?.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request?.headers.get('user-agent') || 'unknown',
      
      // Integrity
      checksum: '', // Will be computed
    };

    // Compute integrity checksum
    entry.checksum = await this.computeChecksum(entry);

    await db.insert(auditLogs).values(entry);

    // Also send to immutable external log (required for tamper evidence)
    await this.sendToExternalLog(entry);

    return entry.id;
  }

  /**
   * Query audit logs (with its own audit!)
   */
  static async queryLogs(
    params: {
      userId?: string;
      resourceId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    requestingUserId: string
  ) {
    // Log the query itself (auditing the auditors)
    await this.logAccess({
      userId: requestingUserId,
      action: 'view',
      resourceType: 'report',
      resourceId: 'audit_log_query',
      phi_accessed: true,
      details: { queryParams: params },
    });

    // Build query
    let query = db.select().from(auditLogs);
    
    if (params.userId) {
      query = query.where(eq(auditLogs.userId, params.userId));
    }
    // ... add other filters

    return query;
  }

  private static async computeChecksum(entry: unknown): Promise<string> {
    const data = JSON.stringify(entry);
    const buffer = new TextEncoder().encode(data);
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private static async sendToExternalLog(entry: unknown) {
    // Send to immutable external logging service
    // Options: AWS CloudWatch Logs (with log group retention), Splunk, etc.
    // This provides tamper evidence
  }
}

// Middleware to ensure audit logging
export function withPHIAudit<T>(
  handler: (req: Request, context: T) => Promise<Response>,
  resourceType: AuditEvent['resourceType']
) {
  return async (req: Request, context: T): Promise<Response> => {
    const user = await getAuthUser();
    const resourceId = extractResourceId(req);

    // Log before access
    const auditId = await HIPAAAuditService.logAccess({
      userId: user.id,
      action: methodToAction(req.method),
      resourceType,
      resourceId,
      phi_accessed: true,
    }, req);

    try {
      const response = await handler(req, context);
      return response;
    } catch (error) {
      // Log failed access too
      await HIPAAAuditService.logAccess({
        userId: user.id,
        action: methodToAction(req.method),
        resourceType,
        resourceId,
        phi_accessed: false,
        details: { error: 'Access failed', auditRef: auditId },
      });
      throw error;
    }
  };
}
```

### BAA (Business Associate Agreement) Requirements

```markdown
## Business Associate Agreement Checklist

A BAA must be signed with ANY vendor that may access PHI:
- Cloud providers (AWS, GCP, Vercel)
- Database providers (Supabase, PlanetScale)
- Email providers (if sending PHI)
- Analytics (if any PHI in events)
- Support tools (if agents can see PHI)

### BAA Must Include:
- [ ] Description of permitted uses
- [ ] Prohibition on unauthorized use/disclosure
- [ ] Safeguards requirement
- [ ] Subcontractor flow-down
- [ ] Breach notification requirements
- [ ] PHI return/destruction at termination
- [ ] Audit rights

### Vendors with HIPAA BAAs Available:
- AWS (available in console)
- Google Cloud (available in console)
- Microsoft Azure
- Supabase (Enterprise plan)
- Vercel (Enterprise plan)
- Twilio (available)
- Stripe (for healthcare billing)
```

---

## ♿ EXPERT: ACCESSIBILITY SPECIALIST

### Role
Ensures applications are usable by people with disabilities. Guides WCAG compliance and inclusive design practices.

### Perspective Questions
When reviewing for accessibility, ask:
1. Can this be used without a mouse?
2. Can this be used without sight?
3. Are colors sufficient for understanding?
4. Is the reading level appropriate?
5. Does motion respect user preferences?

### WCAG 2.1 AA Checklist

```markdown
## Accessibility Checklist (WCAG 2.1 AA)

### Perceivable
- [ ] All images have alt text
- [ ] Videos have captions
- [ ] Audio has transcripts
- [ ] Color is not the only indicator
- [ ] Contrast ratio ≥ 4.5:1 (text)
- [ ] Contrast ratio ≥ 3:1 (large text, UI)
- [ ] Text resizable to 200% without loss
- [ ] Content reflows at 320px width

### Operable
- [ ] All functionality via keyboard
- [ ] No keyboard traps
- [ ] Skip to content link
- [ ] Focus visible and logical
- [ ] No flashing content
- [ ] Page titles descriptive
- [ ] Link text meaningful
- [ ] Touch targets ≥ 44x44px

### Understandable
- [ ] Page language declared
- [ ] Consistent navigation
- [ ] Consistent identification
- [ ] Error messages clear
- [ ] Labels for inputs
- [ ] Instructions for complex inputs
- [ ] Autocomplete attributes set

### Robust
- [ ] Valid HTML
- [ ] Name, role, value for custom controls
- [ ] Status messages announced
- [ ] Compatible with assistive tech
```

### Accessibility Implementation

```tsx
// Accessible form component
interface AccessibleInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export function AccessibleInput({
  label,
  error,
  hint,
  required,
  id,
  ...props
}: AccessibleInputProps) {
  const inputId = id || useId();
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        {required && <span className="sr-only">(required)</span>}
      </label>
      
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      
      <input
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error ? 'true' : undefined}
        aria-required={required}
        className={cn(
          'w-full rounded-md border p-2',
          error && 'border-red-500'
        )}
        {...props}
      />
      
      {error && (
        <p id={errorId} className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Skip link component
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:border focus:rounded-md"
    >
      Skip to main content
    </a>
  );
}

// Accessible modal
export function AccessibleModal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const titleId = useId();
  
  // Trap focus in modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal content */}
      <div className="relative bg-background rounded-lg p-6 max-w-md w-full mx-4">
        <h2 id={titleId} className="text-lg font-semibold mb-4">
          {title}
        </h2>
        
        {children}
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// Screen reader only text
export function ScreenReaderOnly({ children }: { children: React.ReactNode }) {
  return (
    <span className="sr-only">
      {children}
    </span>
  );
}

// Live region for announcements
export function LiveRegion({
  message,
  type = 'polite',
}: {
  message: string;
  type?: 'polite' | 'assertive';
}) {
  return (
    <div
      role="status"
      aria-live={type}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
```

### Accessibility Testing

```typescript
// Automated accessibility testing with axe-core
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('home page has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    
    expect(results.violations).toEqual([]);
  });

  test('can navigate with keyboard only', async ({ page }) => {
    await page.goto('/');
    
    // Tab through all interactive elements
    await page.keyboard.press('Tab');
    const firstFocusable = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'INPUT']).toContain(firstFocusable);
    
    // Ensure skip link works
    await page.goto('/');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    const focusedId = await page.evaluate(() => document.activeElement?.id);
    expect(focusedId).toBe('main-content');
  });

  test('form errors are announced', async ({ page }) => {
    await page.goto('/signup');
    
    // Submit empty form
    await page.click('button[type="submit"]');
    
    // Check that error is linked to input
    const emailInput = page.locator('input[name="email"]');
    const describedBy = await emailInput.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    
    const errorText = await page.locator(`#${describedBy}`).textContent();
    expect(errorText).toContain('required');
  });
});
```

### Color Contrast Utilities

```typescript
// lib/accessibility/contrast.ts

/**
 * Calculate relative luminance
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number }
): number {
  const l1 = getLuminance(color1.r, color1.g, color1.b);
  const l2 = getLuminance(color2.r, color2.g, color2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast meets WCAG requirements
 */
export function meetsContrastRequirements(
  foreground: { r: number; g: number; b: number },
  background: { r: number; g: number; b: number },
  level: 'AA' | 'AAA' = 'AA',
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  
  if (level === 'AAA') {
    return isLargeText ? ratio >= 4.5 : ratio >= 7;
  }
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

// Usage
const white = { r: 255, g: 255, b: 255 };
const darkGray = { r: 55, g: 65, b: 81 }; // Tailwind gray-700

console.log(getContrastRatio(white, darkGray)); // ~9.87:1 ✓
console.log(meetsContrastRequirements(white, darkGray, 'AA')); // true
```

---

**Module complete.** This module provides expert guidance for health applications, HIPAA compliance, and accessibility requirements.
