# PRE-FLIGHT AUDIT
# Module: 19-audit.md
# Load when: BUSINESS project, Audit phase (before launch)

---

## 🔍 100-POINT INSPECTION

### Audit Framework

```
✅ Pass - Meets requirements
⚠️ Warning - Needs attention
❌ Fail - Must fix before launch
⏭️ N/A - Not applicable to this project
```

### How to Use This Module

1. Run this audit 1-2 weeks before launch
2. Score each item honestly
3. Fix all ❌ items before launch
4. Address ⚠️ items by launch or have plan
5. Document exceptions with justification

---

## 📊 AUDIT SCORECARD

```markdown
# Pre-Flight Audit: [App Name]

**Audit Date:** [Date]
**Auditor:** [Name]
**Target Launch:** [Date]

## Summary

| Category | Score | Max | % |
|----------|-------|-----|---|
| Security | /20 | 20 | % |
| Performance | /15 | 15 | % |
| Reliability | /10 | 10 | % |
| UX/Accessibility | /15 | 15 | % |
| Code Quality | /10 | 10 | % |
| Business | /15 | 15 | % |
| Operations | /15 | 15 | % |
| **TOTAL** | **/100** | **100** | **%** |

### Launch Readiness
- [ ] 90%+ → Green light
- [ ] 75-89% → Proceed with caution
- [ ] <75% → Do not launch
```

---

## 🔐 SECURITY (20 Points)

### Authentication (6 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 1 | Password requirements enforced (8+ chars, complexity) | ⬜ 1 | |
| 2 | Password hashing (bcrypt/argon2) | ⬜ 1 | |
| 3 | Session management secure (httpOnly, secure, sameSite) | ⬜ 1 | |
| 4 | JWT tokens expire appropriately | ⬜ 1 | |
| 5 | 2FA option available (if handling sensitive data) | ⬜ 1 | |
| 6 | Account lockout after failed attempts | ⬜ 1 | |

### Authorization (4 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 7 | Row-level security (RLS) on multi-tenant data | ⬜ 1 | |
| 8 | API endpoints check user permissions | ⬜ 1 | |
| 9 | Admin functions properly protected | ⬜ 1 | |
| 10 | CORS configured correctly | ⬜ 1 | |

### Data Protection (5 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 11 | HTTPS everywhere (no mixed content) | ⬜ 1 | |
| 12 | Sensitive data encrypted at rest | ⬜ 1 | |
| 13 | PII handling compliant | ⬜ 1 | |
| 14 | Database connection encrypted | ⬜ 1 | |
| 15 | Secrets not in code/git | ⬜ 1 | |

### Attack Prevention (5 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 16 | SQL injection prevented (parameterized queries) | ⬜ 1 | |
| 17 | XSS prevented (input sanitization, CSP) | ⬜ 1 | |
| 18 | CSRF protection enabled | ⬜ 1 | |
| 19 | Rate limiting on auth endpoints | ⬜ 1 | |
| 20 | Dependency vulnerabilities fixed (npm audit) | ⬜ 1 | |

**Security Score: ___/20**

---

## ⚡ PERFORMANCE (15 Points)

### Page Speed (5 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 21 | LCP < 2.5s | ⬜ 1 | |
| 22 | FID < 100ms | ⬜ 1 | |
| 23 | CLS < 0.1 | ⬜ 1 | |
| 24 | TTFB < 200ms | ⬜ 1 | |
| 25 | Lighthouse score > 90 | ⬜ 1 | |

### Optimization (5 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 26 | Images optimized (WebP, lazy loading) | ⬜ 1 | |
| 27 | JavaScript bundle < 200KB (gzipped) | ⬜ 1 | |
| 28 | Critical CSS inlined | ⬜ 1 | |
| 29 | Fonts optimized (subset, swap) | ⬜ 1 | |
| 30 | No render-blocking resources | ⬜ 1 | |

### Backend Performance (5 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 31 | API response < 500ms (p95) | ⬜ 1 | |
| 32 | Database queries optimized (N+1 fixed) | ⬜ 1 | |
| 33 | Caching strategy implemented | ⬜ 1 | |
| 34 | CDN configured | ⬜ 1 | |
| 35 | Connection pooling enabled | ⬜ 1 | |

**Performance Score: ___/15**

---

## 🛡️ RELIABILITY (10 Points)

### Error Handling (4 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 36 | Global error boundary in frontend | ⬜ 1 | |
| 37 | API errors return consistent format | ⬜ 1 | |
| 38 | Error logging to monitoring service | ⬜ 1 | |
| 39 | Graceful degradation for failures | ⬜ 1 | |

### Infrastructure (3 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 40 | Database backups automated | ⬜ 1 | |
| 41 | Zero-downtime deployments | ⬜ 1 | |
| 42 | Health check endpoint exists | ⬜ 1 | |

### Recovery (3 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 43 | Rollback procedure documented | ⬜ 1 | |
| 44 | Database migration strategy | ⬜ 1 | |
| 45 | Incident response plan exists | ⬜ 1 | |

**Reliability Score: ___/10**

---

## ♿ UX & ACCESSIBILITY (15 Points)

### Accessibility (6 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 46 | Keyboard navigation works | ⬜ 1 | |
| 47 | Focus indicators visible | ⬜ 1 | |
| 48 | Alt text on images | ⬜ 1 | |
| 49 | Color contrast passes (WCAG AA) | ⬜ 1 | |
| 50 | Form labels associated | ⬜ 1 | |
| 51 | ARIA labels where needed | ⬜ 1 | |

### Mobile (4 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 52 | Responsive design works | ⬜ 1 | |
| 53 | Touch targets 44x44px minimum | ⬜ 1 | |
| 54 | No horizontal scroll | ⬜ 1 | |
| 55 | Viewport meta tag set | ⬜ 1 | |

### User Experience (5 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 56 | Loading states shown | ⬜ 1 | |
| 57 | Error messages helpful | ⬜ 1 | |
| 58 | Success feedback provided | ⬜ 1 | |
| 59 | Empty states designed | ⬜ 1 | |
| 60 | Confirmation on destructive actions | ⬜ 1 | |

**UX Score: ___/15**

---

## 🧪 CODE QUALITY (10 Points)

### Code Standards (4 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 61 | TypeScript strict mode enabled | ⬜ 1 | |
| 62 | ESLint passing | ⬜ 1 | |
| 63 | No console.log in production | ⬜ 1 | |
| 64 | Consistent code formatting (Prettier) | ⬜ 1 | |

### Testing (4 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 65 | Critical paths have tests | ⬜ 1 | |
| 66 | Auth flows tested | ⬜ 1 | |
| 67 | Payment flows tested | ⬜ 1 | |
| 68 | CI pipeline runs tests | ⬜ 1 | |

### Documentation (2 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 69 | README up to date | ⬜ 1 | |
| 70 | Environment variables documented | ⬜ 1 | |

**Code Quality Score: ___/10**

---

## 💼 BUSINESS (15 Points)

### Payments (5 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 71 | Stripe live mode configured | ⬜ 1 | |
| 72 | All products/prices created | ⬜ 1 | |
| 73 | Webhooks handling all events | ⬜ 1 | |
| 74 | Tax settings configured | ⬜ 1 | |
| 75 | Test transaction successful | ⬜ 1 | |

### Legal (5 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 76 | Terms of Service published | ⬜ 1 | |
| 77 | Privacy Policy published | ⬜ 1 | |
| 78 | Cookie consent implemented | ⬜ 1 | |
| 79 | GDPR data export ready | ⬜ 1 | |
| 80 | Data deletion process works | ⬜ 1 | |

### Content (5 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 81 | Landing page complete | ⬜ 1 | |
| 82 | Pricing page accurate | ⬜ 1 | |
| 83 | Help documentation exists | ⬜ 1 | |
| 84 | FAQ answers common questions | ⬜ 1 | |
| 85 | Contact information visible | ⬜ 1 | |

**Business Score: ___/15**

---

## 🔧 OPERATIONS (15 Points)

### Monitoring (5 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 86 | Error tracking active (Sentry) | ⬜ 1 | |
| 87 | Uptime monitoring configured | ⬜ 1 | |
| 88 | Analytics installed | ⬜ 1 | |
| 89 | Alerts configured for critical issues | ⬜ 1 | |
| 90 | Logs accessible and searchable | ⬜ 1 | |

### Communication (5 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 91 | Transactional emails work | ⬜ 1 | |
| 92 | Email deliverability good (SPF/DKIM) | ⬜ 1 | |
| 93 | Support channel exists | ⬜ 1 | |
| 94 | Status page configured | ⬜ 1 | |
| 95 | Social media profiles created | ⬜ 1 | |

### Processes (5 points)

| # | Check | Score | Notes |
|---|-------|-------|-------|
| 96 | Deployment process documented | ⬜ 1 | |
| 97 | Secrets management in place | ⬜ 1 | |
| 98 | On-call rotation defined | ⬜ 1 | |
| 99 | Escalation path documented | ⬜ 1 | |
| 100 | Runbook for common issues | ⬜ 1 | |

**Operations Score: ___/15**

---

## 📋 AUDIT REPORT

```markdown
# Audit Report: [App Name]
**Date:** [Date]
**Final Score:** [X]/100

## Critical Issues (Must Fix)
| # | Issue | Category | Owner | ETA |
|---|-------|----------|-------|-----|
| | | | | |

## Warnings (Should Fix)
| # | Issue | Category | Priority | Plan |
|---|-------|----------|----------|------|
| | | | | |

## Exemptions
| # | Check | Reason for Exemption | Approved By |
|---|-------|---------------------|-------------|
| | | | |

## Recommendations
1. [Recommendation 1]
2. [Recommendation 2]
3. [Recommendation 3]

## Sign-off

**Launch Decision:** ✅ Approved / ❌ Not Approved

**Conditions:** [Any conditions for approval]

**Signed:** _____________ **Date:** _____________
```

---

## 🔄 QUICK AUDIT SCRIPTS

### Security Check Script

```bash
#!/bin/bash
# security-audit.sh

echo "🔐 Running Security Audit..."

# Check for secrets in git history
echo "Checking for leaked secrets..."
git log --all -p | grep -E "(STRIPE_SECRET|API_KEY|PASSWORD|SECRET)" && echo "⚠️ Potential secrets in git history"

# Check npm vulnerabilities
echo "Checking npm vulnerabilities..."
npm audit --production

# Check for console.log statements
echo "Checking for console.log..."
grep -r "console.log" src/ --include="*.ts" --include="*.tsx" | grep -v "console.log.*error" && echo "⚠️ console.log found"

# Check HTTPS redirect
echo "Checking HTTPS..."
curl -s -o /dev/null -w "%{http_code}" http://yourdomain.com | grep -q "301\|302" && echo "✅ HTTP redirects to HTTPS" || echo "❌ No HTTPS redirect"

echo "Security audit complete!"
```

### Performance Check Script

```bash
#!/bin/bash
# performance-audit.sh

echo "⚡ Running Performance Audit..."

# Run Lighthouse
echo "Running Lighthouse..."
npx lighthouse https://yourdomain.com --output json --output-path ./lighthouse-report.json --chrome-flags="--headless"

# Check bundle size
echo "Checking bundle size..."
du -sh .next/static/chunks/*.js | sort -h

# Check image optimization
echo "Checking for unoptimized images..."
find public -type f \( -name "*.jpg" -o -name "*.png" \) -size +100k -exec ls -lh {} \;

echo "Performance audit complete!"
```

### Accessibility Check Script

```bash
#!/bin/bash
# a11y-audit.sh

echo "♿ Running Accessibility Audit..."

# Run axe-core
npx @axe-core/cli https://yourdomain.com --save a11y-report.json

# Check for missing alt tags
echo "Checking alt tags..."
grep -r "<img" src/ --include="*.tsx" | grep -v "alt=" && echo "⚠️ Images missing alt tags"

# Check for form labels
echo "Checking form labels..."
grep -r "<input" src/ --include="*.tsx" | grep -v "aria-label\|id=" && echo "⚠️ Inputs may need labels"

echo "Accessibility audit complete!"
```

---

## 🎯 AUDIT CHECKLIST BY PHASE

```markdown
## When to Run

### Alpha (Internal Testing)
- [ ] Security basics (#1-10)
- [ ] Error handling (#36-39)
- [ ] Code standards (#61-64)

### Beta (External Testing)
- [ ] Full security audit (#1-20)
- [ ] Performance basics (#21-30)
- [ ] UX fundamentals (#46-60)

### Pre-Launch
- [ ] Complete 100-point audit
- [ ] All critical issues fixed
- [ ] Warning items addressed

### Post-Launch
- [ ] Re-audit after major releases
- [ ] Quarterly security review
- [ ] Annual compliance audit
```

---
