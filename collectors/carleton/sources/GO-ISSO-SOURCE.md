# Global Opportunities & International Student Services Office

Verified 2026-10-01 from https://carleton.ca/go-isso/events/. The page title and
WebSite JSON-LD identify this office, rather than Engineering & Design.
`sourceName` is `Carleton Global Opportunities & International Student Services Office`.

## Public source discovery

1. The supplied page advertises https://carleton.ca/go-isso/wp-json/ with
   `rel="https://api.w.org/"`.
2. That index advertises GET `/cutheme/v1/cu-calendar` and
   `/wp/v2/cu_event/(?P<id>[\d]+)` and specifies `America/Toronto`.
3. https://carleton.ca/go-isso/wp-json/cutheme/v1/cu-calendar returns `posts`
   and `pagination`. At verification it returned 478 records (`per_page: -1`),
   including 20 upcoming events. Validate the reported total and filter ended
   events locally before fetching details; no guessed date-query parameters.
4. The linked https://carleton.ca/go-isso/event/global-cafe-26/ page explicitly
   advertises https://carleton.ca/go-isso/wp-json/wp/v2/cu_event/44095 as JSON.
   Fetch each event's description using
   `https://carleton.ca/go-isso/wp-json/wp/v2/cu_event/{id}?_fields=id,content`.

The calendar supplies `title`, `link`, `cu_event_start_date`, `cu_event_end_date`,
and structured location fields. The shared WordPress collector converts Toronto
wall times to UTC, maps building labels and rooms separately, and leaves physical
locations null for virtual events. Off-campus addresses support strings and ACF
map objects. Missing end times and descriptions remain null.

Descriptions come from `content.rendered`, converted to plain text with forms
and scripts removed. The listing's JSON-LD describes a WebPage, not event times.
Individual Apple calendar export links also exist, but JSON provides both event
discovery and separate location fields. No HTML page scraping is needed.

The shared collector provides 15-second request timeouts, three attempts with
2/4-second retry delays, four concurrent detail requests, and partial-failure
isolation. Existing collection and stored-event duplicate checks apply (exact
URLs plus conservative cross-source title/start/building/room matching).
Different title/location wording is not fuzzy-matched.

Fixtures retain public Global Café and virtual work-permit calendar records.
The description fixture preserves the public narrative while replacing generated
registration scripts/forms with minimal representative markup.
