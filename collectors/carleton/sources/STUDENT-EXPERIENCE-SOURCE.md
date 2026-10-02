# Student Experience Office

Verified 2026-10-02. The supplied https://carleton.ca/seo/events/ page identifies
itself as the Student Experience Office, so the source name is
`Carleton Student Experience Office`.

Discovery chain:

- The page advertises https://carleton.ca/seo/wp-json/ via `rel="https://api.w.org/"`.
- This public REST index advertises GET `/cutheme/v1/cu-calendar` and
  `/wp/v2/cu_event/(?P<id>[\d]+)` and reports `America/Toronto`.
- https://carleton.ca/seo/wp-json/cutheme/v1/cu-calendar returns all event records
  in `posts`, with `pagination.total` and `per_page: -1`. At verification there
  were 73 records, one upcoming: Campus to Community – Post Panda Cleanup.
- https://carleton.ca/seo/event/campus-to-community-post-panda-cleanup/ directly
  advertises https://carleton.ca/seo/wp-json/wp/v2/cu_event/36840 as its JSON record.
  Details are fetched using `/seo/wp-json/wp/v2/cu_event/{id}?_fields=id,content`.

The calendar supplies title, canonical link, start/end wall times, location type,
building label and room. For off-campus locations, the full address may be a string
or an ACF map object; use its `address` field for the latter. The observed event's
address is 1005 Bank St, Ottawa. Missing room/end/description values stay null.
Convert Toronto dates to UTC with DST handling and filter out ended events before
requesting details. Descriptions come from REST `content.rendered`, converted to
plain text with forms/scripts removed.

JSON-LD on the listing describes the webpage, not event occurrences. Individual
Apple calendar links also exist, but the REST calendar already provides event
discovery and separate location fields. No HTML page scraping or guessed endpoint
is used. Fixtures contain the public calendar entry and its REST description.

The shared WordPress calendar collector checks total record count, retries failed
requests three times with 15-second timeouts and 2/4-second delays, limits detail
concurrency to four, and retains successful details after partial failures.
Existing collection and persistence duplicate checks apply: exact URLs plus
conservative cross-source matches on normalized title, zoned start and building.
Differently worded titles or location aliases are not fuzzy-matched.

Cross-source identity excludes room: different publications can omit or describe
it differently. Events with the same normalized title, start instant and building
are one occurrence even when rooms differ. Missing buildings and unzoned start
times remain excluded from cross-source matching.
