# CodeBakers Server

Production patterns delivery platform for AI-assisted development.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase + Drizzle ORM
- **Auth**: Supabase Auth
- **Payments**: Stripe
- **UI**: shadcn/ui + Tailwind CSS
- **Testing**: Playwright

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account
- Stripe account

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Fill in your keys in .env.local

# Run database migrations
npm run db:push

# Start development server
npm run dev
```

### Environment Variables

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
DATABASE_URL=your_database_url

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRO_PRICE_ID=price_xxx
STRIPE_TEAM_PRICE_ID=price_xxx
STRIPE_AGENCY_PRICE_ID=price_xxx

# Content Protection
ENCODER_KEY=your_32_byte_hex_key
```

## Project Structure

```
codebakers-server/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── (auth)/          # Auth pages (login, signup)
│   │   ├── (dashboard)/     # Dashboard pages
│   │   ├── (admin)/         # Admin pages
│   │   ├── (marketing)/     # Marketing pages
│   │   └── api/             # API routes
│   ├── components/          # React components
│   ├── lib/                 # Utilities and configs
│   ├── db/                  # Database schema
│   ├── services/            # Business logic
│   └── content/             # Pattern files
├── cli/                     # CLI tool source
├── encoder/                 # Content encoder
└── tests/                   # Playwright tests
```

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Check TypeScript
npm run test         # Run Playwright tests
npm run test:ui      # Run tests with UI
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio
```

## CLI Tool

The CLI is in the `cli/` directory:

```bash
cd cli
npm install
npm run build
npm link

# Now you can use:
codebakers login     # Login with API key
codebakers install   # Install patterns
codebakers status    # Check status
codebakers uninstall # Remove patterns
```

## Testing

```bash
# Run all tests
npm run test

# Run with UI
npm run test:ui

# Run specific test file
npx playwright test tests/e2e/homepage.spec.ts
```

## Deployment

### Vercel

```bash
vercel
vercel env add STRIPE_SECRET_KEY
# Add all other environment variables
```

### Supabase Setup

1. Create a new Supabase project
2. Run the migrations in `src/db/migrations/`
3. Enable Email auth in Supabase dashboard
4. Copy the project URL and anon key

### Stripe Setup

1. Create products for Pro ($49), Team ($149), Agency ($349)
2. Copy price IDs to environment variables
3. Add webhook endpoint: `https://your-domain.com/api/webhooks/stripe`
4. Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

## License

MIT
