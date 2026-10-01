# Engineering and Design source

Verified against the public site on 2026-10-01.

1. https://carleton.ca/engineering-design/news-and-events/ advertises
   `https://carleton.ca/engineering-design/wp-json/` using `rel="https://api.w.org/"`.
2. That REST index explicitly advertises GET `/cutheme/v1/cu-calendar` and
   `/wp/v2/cu_event/(?P<id>[\d]+)` and specifies `America/Toronto`.
3. https://carleton.ca/engineering-design/wp-json/cutheme/v1/cu-calendar
   returns `pagination` and `posts`. At inspection it returned all 45 records
   (`per_page: -1`), including past events. Each record provides `id`, `title`,
   `link`, `cu_event_start_date`, `cu_event_end_date`, and structured location
   fields. Filter by end time (start time if no end is supplied). Validate the
   reported total to avoid silently accepting a truncated response.
4. Fetch descriptions from
   `https://carleton.ca/engineering-design/wp-json/wp/v2/cu_event/{id}?_fields=id,content`.
   The public FED Pride detail page also directly advertises the JSON record
   `/wp-json/wp/v2/cu_event/44419`. Its calendar dates match the public calendar
   export: October 14, 2026, 15:30–17:30 UTC (11:30–13:30 Toronto).

Use the calendar's `link` as the source URL even for links to other Carleton
sites; the numeric ID still identifies the Engineering WordPress detail record.
Map on-campus building labels and rooms separately. Do not retain physical
locations for virtual/TBD events. Convert Toronto wall times with DST awareness;
reject ambiguous/nonexistent local times rather than inventing an offset.

The page's JSON-LD describes WebPage/BreadcrumbList, not Event. Event detail pages
also advertise an individual Apple calendar export, but the discovered JSON API
provides discovery and structured location fields together. No page scraping or
undocumented endpoint is needed. HTML parsing only converts `content.rendered`
to plain text and removes scripts, registration forms and styles.

The fixture is one public calendar record captured on the verification date;
network behavior and descriptions are tested with deterministic synthetic data.

Exact source URLs retain existing last-source-wins behavior and database upserts.
Different Carleton sources also match on normalized title, explicitly zoned start
instant, nonempty building and room. First configured source wins. Ingestion
checks persisted events in the collected time window, with pagination, and skips
cross-source matches. This is intentionally conservative: changed titles,
location aliases, missing locations, and unzoned dates are not fuzzy-matched.
Concurrent ingestion runs should remain serialized (the existing scheduled job);
only source URL uniqueness is enforced by the database.
