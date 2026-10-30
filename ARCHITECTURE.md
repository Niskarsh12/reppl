# Architecture

Reppl has two experiences: the primary event partnership workspace at `/workspace`, and retained
brand-side campaign tools at `/campaign`. They share the Qloo client but have different data flows.

## Partnership workspace

| Layer | Location | Responsibility |
| --- | --- | --- |
| Marketing | `src/components/studio/Marketing.tsx` | Product story and interactive workflow preview. |
| Workspace | `src/components/studio/Workspace.tsx` | Event, research, drafts, navigation and persistence. |
| Fit check | `src/components/studio/Investigation.tsx` | Proposed role, cultural assessment and expandable evidence. |
| Approach | `src/components/studio/Approach.tsx` | Editable idea, opening email, proposal and print appendix. |
| Discovery | `src/lib/partnerships/research.ts` | Validated brief, entity resolution and brand retrieval. |
| Investigation | `src/lib/partnerships/investigate.ts` | Follow-up queries, direct connections and limitations. |
| Planning | `src/lib/partnerships/strategy.ts` | Available experiences, role suggestions, drafts and exports. |
| Qloo client | `src/lib/qloo/client.ts` | Server-only API requests, parsing, retries and private memory cache. |

### Discovery

`POST /api/partnerships` validates the event brief, resolves cultural interests through Qloo `/v2/tags`,
and resolves optional reference artists through `/search`. Canonical interest labels and unambiguous
exact-name artist matches become seeds. Unresolved inputs are excluded and reported. The server requests
`/v2/insights` with `filter.type=urn:entity:brand`; location is optional. Free-text descriptions and
ambitions inform proposal drafts rather than being passed off as Qloo signals.

The response retains entity IDs, tags, optional raw affinity, resolved seed IDs, query scope and retrieval
time. This workspace has no sample-brand fallback. Missing configuration, API errors and empty results
have explicit states. `GET /api/partnerships` exposes configuration status without exposing the key.

### Brand investigation

`POST /api/partnerships/investigate` accepts `{ brief, candidateId }`. The server verifies that the brand
belongs to the event's discovery results before running brand-seeded music and lifestyle queries.
Missing direct connections or supplied reference artists trigger an artist cross-check. Exact IDs and
canonical labels identify connections; failed, empty and skipped branches remain visible in the evidence.
The assessment distinguishes a retrieved connection from a case that needs validation.

### From evidence to an approach

The organizer confirms available experiences, such as a listening space, makers workshop or hospitality
area. Role suggestions match retrieved descriptors against only that inventory. This is a transparent
planning heuristic, not an LLM, a Qloo fit score or a prediction of conversion. The idea, contribution,
questions, measurement plan and email remain editable. Manually edited fields survive role changes.

Markdown export includes the approach, email, complete returned records and query parameters. The
formatted proposal includes a source appendix that opens for printing and restores its prior state
afterward. Nothing sends outreach automatically.

### State and navigation

The URL retains step and brand context. Prerequisite guards, browser Back/Forward and reload preserve
the workflow. Example and real projects use separate browser stores. The previous workspace store is
read for migration without being deleted. Changing an event brief resets dependent research and drafts
after the editor explains that consequence. Browser storage is local persistence, not an account,
collaboration service or shared database.

## Retained campaign tools

`/campaign` supports brand review, actual offer recording, comparison, decision briefs, pitches, tracked
links and reported outcomes. Qloo discovery and the illustrative catalogue are labeled separately.
Its sample fallback behavior does not apply to the event partnership workspace.

Actual offers record deliverables, market, dates, prices and evidence sources. Unknown prices stay
unknown. Standard eligibility uses sourced quote/published pricing checked within 30 days,
partner-confirmed availability checked within 14 days, and checked extras. These are explicit planning
rules in `src/lib/offers/evidence.ts`, not independently verified commercial facts or industry standards.
Conditional scenarios can include provisional evidence; expired, unavailable and ineligible offers stay
excluded. JSON export/import supports backups; validated imports are capped at 40 offers.

`src/lib/campaign/optimizer.ts` evaluates feasible subsets of up to six partners for pools of at most
20 eligible candidates. Larger pools use deterministic marginal-value greedy selection, retaining the
individual-ranking baseline if it scores better. Unknown costs are excluded until a planning assumption
is supplied. Cultural coverage, redundancy and objective alignment are heuristics, not ROI forecasts.

Tracked links redirect with UTM tags and record clicks. Preview crawlers are excluded. The JSON link
store in `src/lib/links/store.ts` suits a single server; a multi-instance deployment needs shared durable
storage. Reported outcomes retain sources, distinguish zero from missing data, and remain separate from
pre-campaign recommendations.

## API map

| Route | Purpose |
| --- | --- |
| `GET /api/partnerships` | Qloo configuration status. |
| `POST /api/partnerships` | Event-seeded brand research. |
| `POST /api/partnerships/investigate` | Validated brand investigation. |
| `POST /api/brand` | Fetch and infer an editable profile from a public brand page. |
| `POST /api/discover` | Stream campaign discovery events. |
| `POST /api/offers/evaluate` | Validate and compare recorded offers. |
| `GET /api/links?campaign=` | Campaign link statistics. |
| `POST /api/links` | Create tracked links. |
| `GET /r/[code]` | Count an eligible click and redirect. |

## Operational boundaries

Qloo credentials stay server-side. The client caches responses in memory for 30 minutes, with bounded
entries and retries; application API responses use no-store headers. Workspace data and drafts also
persist privately in the user's browser. Demo captures, exported research, local state and credentials
are excluded from version control. Dependencies, fonts, API access and provider data retain their own
licenses or terms; the project's MIT license does not relicense them.
