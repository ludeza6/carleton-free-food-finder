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
│   ├── current-students.ts
│   └── ingest.ts
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