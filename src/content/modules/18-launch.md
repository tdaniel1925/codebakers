# LAUNCH PLAYBOOK
# Module: 18-launch.md
# Load when: BUSINESS project, Launch phase

---

## 🚀 LAUNCH FRAMEWORK

### When to Use This Module

```
✅ BUSINESS projects → Full launch sequence
✅ CLIENT projects → If launching product
❌ PERSONAL projects → Skip unless requested
```

### Launch Phase Outputs

| Document | Contents |
|----------|----------|
| /docs/LAUNCH-CHECKLIST.md | Pre-launch requirements |
| /docs/LAUNCH-DAY.md | Day-of playbook |
| /docs/POST-LAUNCH.md | First 30 days plan |

---

## ✅ PRE-LAUNCH CHECKLIST

```markdown
# Pre-Launch Checklist: [App Name]

**Target Launch Date:** [Date]
**Launch Type:** Soft Launch / Public Launch / Product Hunt

---

## 🔧 Technical Readiness (T-14 Days)

### Infrastructure
- [ ] Production environment deployed
- [ ] Domain configured and SSL active
- [ ] CDN configured (Vercel/Cloudflare)
- [ ] Database backups automated
- [ ] Error monitoring active (Sentry)
- [ ] Logging configured
- [ ] Load testing completed
- [ ] Rate limiting in place

### Security
- [ ] Security audit completed
- [ ] Penetration testing done (if applicable)
- [ ] HTTPS everywhere
- [ ] Secrets rotated for production
- [ ] Auth flows tested thoroughly
- [ ] Password requirements enforced
- [ ] Session management secure
- [ ] CORS properly configured

### Performance
- [ ] Core Web Vitals passing
- [ ] Page load < 3 seconds
- [ ] API response times acceptable
- [ ] Images optimized
- [ ] Caching strategy implemented
- [ ] Database queries optimized

### Testing
- [ ] All critical paths tested
- [ ] Cross-browser testing done
- [ ] Mobile responsiveness verified
- [ ] Accessibility audit passed (WCAG 2.1 AA)
- [ ] Email deliverability tested
- [ ] Payment flows tested (live mode)
- [ ] Edge cases handled

---

## 💰 Business Readiness (T-14 Days)

### Payments
- [ ] Stripe live mode configured
- [ ] Products/prices created
- [ ] Webhooks configured and tested
- [ ] Tax settings configured
- [ ] Invoice emails customized
- [ ] Refund policy documented
- [ ] Test transactions completed

### Legal
- [ ] Terms of Service published
- [ ] Privacy Policy published
- [ ] Cookie consent implemented
- [ ] GDPR compliance verified
- [ ] Data retention policy defined
- [ ] Business entity established
- [ ] Business insurance (if needed)

### Support
- [ ] Help documentation written
- [ ] FAQ page live
- [ ] Contact/support email configured
- [ ] Support ticket system ready
- [ ] Response time SLA defined
- [ ] Escalation path documented
- [ ] Status page configured

---

## 📝 Content Readiness (T-7 Days)

### Website
- [ ] Landing page live and polished
- [ ] Pricing page accurate
- [ ] About page complete
- [ ] Blog posts ready (3+)
- [ ] Changelog page started
- [ ] Screenshots/demos current

### SEO
- [ ] Title tags and meta descriptions
- [ ] Sitemap.xml submitted
- [ ] Robots.txt configured
- [ ] Structured data (JSON-LD)
- [ ] Open Graph tags
- [ ] Twitter Card tags

### Marketing
- [ ] Social profiles created
- [ ] Launch announcement drafted
- [ ] Press kit ready
- [ ] Email sequences configured
- [ ] Social posts scheduled
- [ ] Influencer outreach started

---

## 👥 Team Readiness (T-3 Days)

### Roles & Responsibilities
| Role | Person | Responsibilities |
|------|--------|------------------|
| Launch Lead | [Name] | Coordinate all activities |
| Tech Lead | [Name] | Monitor systems, fix issues |
| Marketing | [Name] | Execute launch campaign |
| Support | [Name] | Handle user inquiries |
| Comms | [Name] | Social media, community |

### Communication
- [ ] Launch day war room setup
- [ ] Communication channels ready (Slack/Discord)
- [ ] Escalation contacts shared
- [ ] Status update schedule defined
- [ ] Emergency procedures documented

### Contingency
- [ ] Rollback plan documented
- [ ] Key contacts available
- [ ] On-call schedule set
- [ ] Issue triage process defined

---

## 📊 Analytics Readiness (T-3 Days)

### Tracking
- [ ] Google Analytics configured
- [ ] Product analytics installed (Mixpanel/PostHog)
- [ ] Conversion tracking setup
- [ ] Funnel tracking configured
- [ ] Custom events defined
- [ ] Error tracking active

### Dashboards
- [ ] Real-time traffic dashboard
- [ ] Conversion metrics dashboard
- [ ] Error rate monitoring
- [ ] Revenue tracking
- [ ] User feedback collection

---

## 🎯 Launch Criteria

### Must Have (Go/No-Go)
- [ ] Core functionality works
- [ ] Payment processing works
- [ ] Auth/login works
- [ ] Critical bugs fixed
- [ ] Legal pages published
- [ ] Support ready

### Should Have
- [ ] All nice-to-have features
- [ ] All minor bugs fixed
- [ ] Performance optimized
- [ ] Full documentation

### Deferred
- [Listed items] - Reason: [Why]

---

## Final Sign-off

| Area | Owner | Ready | Date |
|------|-------|-------|------|
| Technical | [Name] | ⬜ | |
| Business | [Name] | ⬜ | |
| Marketing | [Name] | ⬜ | |
| Support | [Name] | ⬜ | |
| Legal | [Name] | ⬜ | |

**Launch Approved By:** _____________ **Date:** _____________
```

---

## 📅 LAUNCH DAY PLAYBOOK

```markdown
# Launch Day Playbook: [App Name]

**Launch Date:** [Date]
**Launch Time:** [Time + Timezone]

---

## Timeline

### Pre-Launch (Morning of)

**6:00 AM** - Final Systems Check
- [ ] All services running
- [ ] Database healthy
- [ ] Monitoring dashboards open
- [ ] Team online in war room

**7:00 AM** - Content Ready
- [ ] Launch posts queued
- [ ] Email blast ready to send
- [ ] Product Hunt page final review
- [ ] Website final check

### Launch Hour

**8:00 AM** - GO LIVE
- [ ] Product Hunt post live
- [ ] Social media posts published
- [ ] Email announcement sent
- [ ] Hacker News post (if applicable)

**8:15 AM** - Initial Monitoring
- [ ] Check site uptime
- [ ] Monitor error rates
- [ ] Watch traffic patterns
- [ ] Check payment flow

### Active Launch Period

**Every 30 minutes:**
- [ ] Respond to Product Hunt comments
- [ ] Reply to social mentions
- [ ] Check error dashboard
- [ ] Update team on metrics

**Every Hour:**
- [ ] Team sync on status
- [ ] Review key metrics
- [ ] Address any issues
- [ ] Plan next activities

### End of Day

**6:00 PM** - Day 1 Wrap-up
- [ ] Post thank-you messages
- [ ] Compile day 1 stats
- [ ] Document issues/learnings
- [ ] Plan day 2 activities

---

## War Room Setup

### Channels
- **#launch-general** - Main coordination
- **#launch-tech** - Technical issues
- **#launch-support** - User questions
- **#launch-marketing** - Comms coordination

### Dashboards to Monitor
1. Vercel/hosting dashboard
2. Sentry error tracking
3. Analytics real-time
4. Stripe dashboard
5. Product Hunt metrics
6. Social mentions

### Quick Links
- Production: [URL]
- Status page: [URL]
- Product Hunt: [URL]
- Analytics: [URL]
- Support inbox: [URL]

---

## Response Templates

### Product Hunt Comments

**For feature requests:**
> Thanks for the suggestion, [Name]! This is definitely on our radar. We're focusing on [current focus] first, but I've added this to our backlog. Would love to hear more about your use case!

**For praise:**
> Thank you so much, [Name]! 🙏 We're thrilled you're finding value. If there's anything we can do better, we're all ears!

**For questions:**
> Great question! [Answer]. Let me know if you have any other questions - happy to help!

**For criticism:**
> Thanks for the honest feedback, [Name]. We hear you on [issue]. We're [action we're taking]. Would love to chat more if you're open to it.

### Social Media

**Thank you post:**
> Wow! We're overwhelmed by the response to our launch! 🚀 Thank you to everyone who's checked us out so far. Your feedback means everything. #launch

**Milestone post:**
> Just hit [milestone]! Thank you to everyone who's supporting us on this journey. This is just the beginning. 🎉

---

## Issue Response Matrix

| Issue Type | Severity | Response Time | Escalate To |
|------------|----------|---------------|-------------|
| Site down | Critical | Immediate | Tech Lead |
| Payments broken | Critical | Immediate | Tech Lead |
| Auth issues | Critical | 15 min | Tech Lead |
| Feature bug | High | 1 hour | Dev team |
| UX issue | Medium | 4 hours | Product |
| Question | Low | Same day | Support |

### Critical Incident Procedure

1. **Detect** - Alert fires or user reports
2. **Assess** - Determine severity
3. **Communicate** - Update status page, notify team
4. **Fix** - Implement solution
5. **Verify** - Confirm resolution
6. **Document** - Post-incident review

---

## Metrics to Track

### Real-time
- Active users on site
- Sign-ups per hour
- Error rate
- Response times

### Daily
- Total sign-ups
- Conversion rate
- Revenue
- Support tickets
- NPS/feedback

### Goals for Day 1
| Metric | Target | Stretch |
|--------|--------|---------|
| Sign-ups | [X] | [X] |
| Paid conversions | [X] | [X] |
| Product Hunt rank | Top 10 | Top 5 |
| Website visitors | [X] | [X] |

---

## Post-Launch (Same Day)

### Evening Tasks
- [ ] Thank the team
- [ ] Share wins publicly
- [ ] Plan tomorrow's activities
- [ ] Turn on alerts for overnight
- [ ] Write day 1 retrospective

### Day 1 Retrospective
- What went well?
- What didn't go well?
- What surprised us?
- What do we change for next time?
```

---

## 📈 POST-LAUNCH PLAN (30 Days)

```markdown
# Post-Launch Plan: [App Name]

## Week 1: Stabilize & Learn

### Goals
- Fix critical bugs
- Respond to all feedback
- Identify quick wins
- Build customer relationships

### Daily Checklist
- [ ] Review error logs
- [ ] Check support tickets
- [ ] Reply to all feedback
- [ ] Monitor key metrics
- [ ] Team standup

### Tasks
- [ ] Fix top 3 bugs reported
- [ ] Publish customer thank-you
- [ ] Write launch retrospective
- [ ] Prioritize feedback backlog
- [ ] Collect testimonials

---

## Week 2: Iterate & Improve

### Goals
- Ship 2-3 quick improvements
- Improve conversion funnel
- Start content momentum
- Begin onboarding optimization

### Tasks
- [ ] Ship highest-impact fixes
- [ ] A/B test landing page
- [ ] Optimize email sequences
- [ ] Publish 2 blog posts
- [ ] Send first newsletter
- [ ] Record product demo video
- [ ] Analyze user behavior

---

## Week 3: Grow & Engage

### Goals
- Increase activation rate
- Build community engagement
- Expand content reach
- Collect case studies

### Tasks
- [ ] Interview 5+ users
- [ ] Create case study
- [ ] Launch referral program (if ready)
- [ ] Guest post outreach
- [ ] Community engagement
- [ ] Product improvements
- [ ] Paid ads experiment

---

## Week 4: Scale & Plan

### Goals
- Review month 1 performance
- Plan month 2 roadmap
- Optimize operations
- Establish routines

### Tasks
- [ ] Month 1 review meeting
- [ ] Metrics analysis
- [ ] User cohort analysis
- [ ] Churn analysis
- [ ] Plan next features
- [ ] Content calendar for month 2
- [ ] Hiring plan (if needed)

---

## Success Metrics (30 Days)

| Metric | Target | Actual |
|--------|--------|--------|
| Total users | [X] | |
| Paid users | [X] | |
| MRR | $[X] | |
| Churn rate | <[X]% | |
| NPS | >[X] | |
| Support response time | <[X] hrs | |

---

## Common Post-Launch Issues

| Issue | Signs | Action |
|-------|-------|--------|
| High churn | Users cancel quickly | Improve onboarding, survey churned users |
| Low activation | Sign up but don't use | Add in-app guidance, email nudges |
| Support overload | Too many tickets | Improve docs, add in-app help |
| Performance issues | Slow under load | Scale infrastructure, optimize |
| Feature requests | Many similar asks | Prioritize, communicate roadmap |

---

## Communication Cadence

| Type | Frequency | Audience |
|------|-----------|----------|
| Changelog | Weekly | Users |
| Newsletter | Bi-weekly | Subscribers |
| Status updates | As needed | All |
| Team retro | Weekly | Team |
| Investor update | Monthly | Investors |

---

## Month 2 Planning

### Key Questions
1. What features are users asking for most?
2. Where are users dropping off?
3. What's our CAC/LTV looking like?
4. Do we need to adjust pricing?
5. What partnerships should we pursue?

### Planning Session Agenda
1. Review month 1 metrics (30 min)
2. User feedback synthesis (30 min)
3. Technical debt review (20 min)
4. Feature prioritization (40 min)
5. Resource planning (20 min)
6. Goals and OKRs (20 min)
```

---

## 🏆 PRODUCT HUNT LAUNCH GUIDE

```markdown
# Product Hunt Launch Guide

## Pre-Launch (2 Weeks Before)

### Profile Setup
- [ ] Create hunter profile (if hunting yourself)
- [ ] Build relationships with hunters (if being hunted)
- [ ] Join Product Hunt community
- [ ] Engage with other products

### Asset Preparation
- [ ] Thumbnail (240x240)
- [ ] Gallery images (1200x900, 5-8 images)
- [ ] Product video (optional but recommended)
- [ ] GIF showing key feature
- [ ] Maker photos

### Copy
- [ ] Tagline (60 chars) - benefit-focused
- [ ] Description (260 chars) - what + why
- [ ] First comment (story, ask, offer)
- [ ] Topics selected (3)

---

## Launch Day Strategy

### Timing
- Launch at 12:01 AM PT (best)
- Weekday (Tue-Thu typically best)
- Avoid major tech news days
- Avoid holidays

### First Comment Template
```
Hey Product Hunt! 👋

I'm [Name], [role] at [Company].

We built [Product] because [why - personal story].

After [timeframe] of [building/working on this], we're excited to finally share it with the PH community.

[Product] helps you [main benefit] by [how it works].

**What makes us different:**
- [Differentiator 1]
- [Differentiator 2]
- [Differentiator 3]

We'd love your feedback on:
- [Specific question]
- [Specific question]

🎁 **Special for PH:** [Offer - discount, extended trial, etc.]

Ask us anything! We'll be here all day responding to every comment.
```

### Engagement Strategy
1. **Be present** - Respond within minutes
2. **Be authentic** - Show personality
3. **Be helpful** - Answer every question
4. **Be grateful** - Thank supporters
5. **Be interesting** - Share behind-the-scenes

### Don't Do
- ❌ Ask for upvotes directly
- ❌ Share PH link on social (can penalize)
- ❌ Use upvote exchanges
- ❌ Ignore negative feedback
- ❌ Go dark after launch

---

## Post-Launch

### Same Day
- Thank everyone on PH
- Compile feedback
- Follow up with engaged users
- Share results with team

### Week After
- Write retrospective
- Reach out to top commenters
- Implement quick feedback
- Plan follow-up content

---

## Success Metrics

| Outcome | Result | Notes |
|---------|--------|-------|
| Rank | #[X] of day | |
| Upvotes | [X] | |
| Comments | [X] | |
| Sign-ups | [X] | |
| Revenue | $[X] | |
| Press mentions | [X] | |
```

---

## 🎯 LAUNCH CHECKLIST SUMMARY

```markdown
## Quick Launch Checklist

### T-14: Two Weeks Out
- [ ] Technical readiness complete
- [ ] Legal documents published
- [ ] Payment processing live
- [ ] Support system ready

### T-7: One Week Out
- [ ] Content ready
- [ ] SEO configured
- [ ] Marketing assets created
- [ ] Team roles assigned

### T-3: Three Days Out
- [ ] Analytics verified
- [ ] Dashboards ready
- [ ] Contingency plans documented
- [ ] Final testing complete

### T-1: Day Before
- [ ] Team briefing complete
- [ ] All systems green
- [ ] Posts scheduled
- [ ] Everyone knows their role

### T-0: Launch Day
- [ ] Execute playbook
- [ ] Monitor everything
- [ ] Respond to everything
- [ ] Celebrate wins

### T+7: One Week After
- [ ] Bugs fixed
- [ ] Feedback collected
- [ ] Retrospective done
- [ ] Month plan created
```

---
