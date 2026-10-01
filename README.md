# CF3 — Carleton Free Food Finder

CF3 is a real-time free food discovery platform for Carleton University students.

It combines official Carleton event feeds with community-submitted food sightings to help students quickly find free food available on campus.

Live app:

https://carleton-free-food-finder.vercel.app/

---

## Overview

CF3 was built as a full-stack campus utility focused on real-time data ingestion, event classification, community reporting, and live availability feedback.

The system automatically checks public Carleton event feeds, identifies events that explicitly mention free food, stores valid opportunities in Supabase, and displays them in a responsive Next.js interface.

Students can also submit community food sightings and confirm whether previously reported food is still available.

---

## Features

### Official Carleton event ingestion

CF3 automatically retrieves events from multiple public Carleton event feeds, including:

- Current Students events
- Varsity events
- Academic events

Events from the feeds are normalized into a common internal event structure before processing.

### Rule-based free-food classification

CF3 uses a deterministic classifier to identify events that explicitly advertise free food.

Examples of recognized phrases include:

- `free lunch`
- `free pizza`
- `lunch will be provided`
- `refreshments provided`
- `complimentary snacks`

Paid-food phrases are also detected to reduce false positives.

No paid AI or LLM API is required.

### Scheduled ingestion

GitHub Actions runs the ingestion pipeline automatically on a recurring schedule.

The workflow:

```text
Carleton public event feeds
        ↓
CF3 event collector
        ↓
Rule-based food classifier
        ↓
Supabase
        ↓
Next.js / Vercel frontend
```

Events are upserted using their source URL to avoid duplicate records.

Event filtering

Students can browse food opportunities using:

Now
Today
Upcoming
All

Times are displayed in the America/Toronto timezone.

Community food reports

Students can report food they find around campus by providing:

Building
Room
Food type
Estimated quantity remaining
Optional notes

Community reports automatically expire so outdated sightings do not remain active indefinitely.

Food Survival Score

Each community report includes a deterministic Food Survival Score.

The score considers:

Initial quantity reported
Time elapsed
Positive confirmations
Gone confirmations
Recent positive confirmations

Students can vote:

Still here
Gone

These confirmations update the score and help other students judge whether the food is likely still available.

Browser notifications

Users can optionally enable browser notifications.

While CF3 is open, the app periodically checks for newly discovered official events and community reports.

The first load establishes a baseline so existing events do not trigger a flood of notifications.

Responsive interface

CF3 includes a mobile-friendly dark interface with:

Event status badges
Food-type badges
Community report cards
Survival score indicators
Loading states
Empty states
Source links
Responsive layouts
Tech Stack
Frontend
Next.js
React
TypeScript
Tailwind CSS
Backend
Next.js Route Handlers
Supabase PostgreSQL
Supabase server and admin clients
Automation
GitHub Actions
Scheduled event ingestion
Deployment
Vercel
Architecture
┌──────────────────────────────┐
│ Carleton Event Feeds        │
│                              │
│ Current Students             │
│ Varsity                      │
│ Academics                    │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ CF3 Collector               │
│                              │
│ Fetch + normalize events     │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Food Classifier             │
│                              │
│ Rule-based detection         │
│ Free / paid classification  │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Supabase                    │
│                              │
│ food_events                  │
│ food_reports                 │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Next.js Application         │
│                              │
│ Official events              │
│ Community reports            │
│ Survival scores              │
│ Browser notifications        │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Vercel                      │
└──────────────────────────────┘
Project Structure
app/
├── api/
│   ├── events/
│   └── reports/
├── layout.tsx
└── page.tsx

collectors/
├── carleton/
│   ├── sources/
│   │   └── current-students.ts
│   ├── collect-all.ts
│   ├── current-students.ts (compatibility entry point)
│   └── ingest.ts
├── deduplication.ts
├── food-detector.ts
└── types.ts

components/
├── events/
├── notifications/
└── reports/

lib/
├── reports/
└── supabase/

scripts/
├── ingest-current-students.ts
└── test-current-students-collector.ts

.github/
└── workflows/
    └── ingest-events.yml
Environment Variables

Create a .env.local file:

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

SUPABASE_SERVICE_ROLE_KEY must remain server-side only.

Never expose the service-role key in browser code or commit it to GitHub.

Running Locally

Install dependencies:

npm install

Start the development server:

npm run dev

Open:

http://localhost:3000
Event Collector

Each configured source implements `EventSource` (`name` and `collect()`).
The three existing feeds are defined in `carleton/sources/current-students.ts`.
`carleton/collect-all.ts` runs them independently with `Promise.allSettled`,
logs each outcome, and merges successful results. Empty successful feeds are
valid; the run fails only when every configured source fails.

Collection retains three attempts, a 15-second timeout per request, and
2-second / 4-second retry delays. Exact `sourceUrl` duplicates use the last
configured source. Cross-source Carleton duplicates additionally match normalized
title, explicitly zoned start time, nonempty building, and room; these preserve
the first configured source. Ingestion also checks previously stored events before
upserting. Matching is conservative and does not infer title or location aliases.

Engineering & Design is registered alongside the three existing feeds. It uses
the site's advertised WordPress calendar JSON for discovery, times, and locations,
and REST event details for descriptions. See
[the verified endpoints and field mapping](collectors/carleton/sources/SOURCE.md).
Run `npm run collector:unit` for deterministic fixture and error-handling tests.

Student Experience Office is also registered, using the advertised calendar and
event REST endpoints linked from `https://carleton.ca/seo/events/`. It shares the
WordPress JSON collector with Engineering & Design, including Toronto timezone
handling, retries, and cross-source deduplication. See
[Student Experience source discovery](collectors/carleton/sources/STUDENT-EXPERIENCE-SOURCE.md).

To add a source later, implement `EventSource` and register it in
`carletonSources`. Ingestion and deterministic food classification stay shared.
The legacy collector and ingestion exports remain available for compatibility.

Run offline collector unit tests:

npm run collector:unit

Test collection without storing events:

npm run collector:test

Run the full ingestion pipeline:

npm run collector:ingest

The ingestion pipeline:

Fetches events from Carleton feeds
Normalizes event data
Classifies events for free food
Filters out non-free events
Upserts valid events into Supabase
Database
food_events

Stores automatically discovered official food opportunities.

Important fields include:

title
description
start_time
end_time
building
room
food_type
source_name
source_url
confidence

source_url is unique and is used for ingestion deduplication.

food_reports

Stores community-submitted food sightings.

Important fields include:

building
room
food_type
quantity
status
created_at
expires_at
still_here_count
gone_count
last_confirmed_at
Security

CF3 uses Supabase Row Level Security.

Public users can read official events and active reports.

Community report submissions are accepted through the application, while privileged database operations such as confirmation updates use a server-side Supabase admin client.

The Supabase service-role key is never exposed to the browser.

Current Limitations

CF3 is currently a portfolio/MVP deployment.

Known limitations include:

Community submissions are anonymous.
Duplicate community voting protection uses browser local storage and is not intended as strong anti-abuse protection.
Community reports expire logically through query filtering rather than requiring a separate cleanup worker.
Carleton location formatting is not fully standardized across event feeds.
Browser notifications currently work while the application is open; CF3 does not yet implement full background Web Push notifications.
Rule-based food detection prioritizes explainability and zero API cost over semantic AI classification.
Future Improvements

Possible future improvements include:

Full Web Push notifications
Campus building normalization
More Carleton event sources
Community authentication
Stronger abuse prevention
Moderation tools
Analytics
Improved event ranking
PWA support
Deployment

CF3 is deployed on Vercel:

https://carleton-free-food-finder.vercel.app/

The production application reads directly from Supabase, so newly ingested events can appear without requiring a frontend redeployment.

Author

Built by Lucas De la Cruz Zanabria

Systems and Computer Engineering
Carleton University
The Global Opportunities & International Student Services Office collector uses
verified WordPress JSON endpoints linked from `https://carleton.ca/go-isso/events/`.
It shares the calendar collector's timezone handling, retries, and duplicate
checks. See [GO-ISSO source discovery](collectors/carleton/sources/GO-ISSO-SOURCE.md).


## Owner email alerts

Official free-food events can send an HTML and plain-text alert to one owner
using Resend. Community reports do not send email; there is no public subscription UI.

1. Apply `supabase/migrations/20261001143616_add_event_email_notifications.sql`
   in the Supabase SQL editor before enabling alerts. It adds nullable `notified_at`
   without changing existing notification values.
2. Create a [Resend API key](https://resend.com/api-keys) and
   [verify your sending domain](https://resend.com/docs/dashboard/domains/introduction).
3. Set these in `.env.local` for local ingestion and as GitHub Actions repository
   secrets for scheduled ingestion:

   ```dotenv
   RESEND_API_KEY=re_your_key
   CF3_ALERT_EMAIL=owner@example.com
   CF3_FROM_EMAIL=CF3 <alerts@your-verified-domain.com>
   ```

   These are server-only variables. Never use a `NEXT_PUBLIC_` prefix for
   `RESEND_API_KEY`. The helper uses `server-only` to reject browser imports.
   If ingestion later runs on Vercel, configure the same server environment there.
4. Run `npm run collector:ingest`. This command enables Node's `react-server`
   condition for the server-only guard outside Next.js.

Alerts run after successful upserts and retry pending official events even when
those events disappear from a feed. Only free events with `notified_at IS NULL`
and a future start time qualify; already-started and expired events are skipped.
On first enablement, existing future events with null `notified_at` also qualify.
Missing email settings disable alerts without stopping ingestion. Send failures
are logged and leave the timestamp null for a later attempt. A successful Resend
acceptance sets `notified_at`; it does not guarantee inbox delivery.

Completed timestamps prevent repeat sends. Stable event-ID idempotency keys also
protect concurrent sends and retries within [Resend's 24-hour retention window](https://resend.com/docs/dashboard/emails/idempotency-keys).
The scheduled workflow serializes ingestion runs. If Resend accepts a message but
the database update fails, restore the database and retry within 24 hours; beyond
that window a duplicate is possible. If event contents change during a retry,
Resend may reject the reused key until it expires. Check provider logs before
manually retrying an ambiguous delivery. Database writes and external email sends
cannot be committed atomically.

Run `npm run test:notifications` for offline notification tests.
