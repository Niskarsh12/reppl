# Reppl

### Culture first. Partnerships follow.

**Cultural partnership intelligence for event organizers, rights holders and experiential agencies.**

Finding a brand is only the beginning of sponsorship. Reppl helps you understand why a brand could
belong at your event, give it a specific role, and prepare a credible first approach.

Built with **Next.js**, **React**, **TypeScript** and **Qloo**. Licensed under [MIT](LICENSE).

## From event to conversation

| Step | What you do | What you get |
| --- | --- | --- |
| **1. Event brief** | Define the culture and available event experiences. | A grounded starting point for research. |
| **2. Find partners** | Retrieve brands through Qloo and choose one to explore. | Real brand records with traceable cultural inputs. |
| **3. Check the fit** | Investigate its cultural context and review a proposed role. | Supporting evidence, limitations and a question to resolve next. |
| **4. Prepare the approach** | Edit the idea, contribution and opening email. | A brand-specific approach and an exportable, sourced proposal. |

The workspace keeps the next decision visible. Full evidence, query details and planning fields open
when needed. The goal is a better sponsorship conversation; a recommendation is not a confirmed sponsor.

## How Qloo powers it

Reppl resolves event interests and optional reference artists into Qloo seeds, then retrieves brands
through the Insights API. Follow-up research checks the selected brand's music and lifestyle signals,
with an artist cross-check when needed.

Entity IDs, returned records, query parameters and retrieval times remain available in the evidence
panels and Markdown export. Raw affinity stays raw; it is never presented as a fit percentage or
measured audience overlap. Missing connections and failed queries remain visible.

Role suggestions use transparent planning rules and experiences the organizer has confirmed. Ideas
and drafts are editable hypotheses. No LLM API is required, and nothing sends outreach automatically.

## Run locally

Requires **Node.js 20.9+**, npm and a Qloo API key for live partnership research.

```bash
npm ci
```

Copy [.env.example](.env.example) to `.env.local` and set:

```dotenv
QLOO_API_KEY=your_qloo_api_key
```

Then start the app:

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000). To explore the workflow, open
[the example event](http://localhost:3000/workspace?example=1). After Hours is an illustrative brief;
its research still uses live Qloo calls. Example and real projects save separately.

Without a working key, the event workspace reports the configuration or research error. It does not
substitute sample brands. API keys stay on the server; never prefix them with `NEXT_PUBLIC_`.

## Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `QLOO_API_KEY` | Required for live workspace research. | Unset |
| `QLOO_API_URL` | Qloo API base URL. | `https://hackathon.api.qloo.com` |
| `DISCOVERY_PROVIDER` | Provider selection for the retained `/campaign` tools only: `demo` or `qloo`. | Automatic |
| `LINK_STORE_PATH` | Click-tracking storage for the campaign tools. | `.data/links.json` |

Restart the development server after changing environment variables.

## What is real

- **Retrieved evidence:** Qloo entities, cultural tags and raw affinity when returned.
- **Organizer context:** event details and available experiences supplied by the user.
- **Proposed strategy:** editable role suggestions, activation ideas, emails and proposals.
- **Still to confirm:** brand interest, contacts, availability, budget, fees, rights and outcomes.

Reppl does not invent sponsorship commitments, audience overlap or ROI. Work saves in this browser;
there are no user accounts or shared project storage. Export important work before clearing browser
data. Changing the event brief resets dependent research and drafts after a notice in the editor.

## Project guide

| Location | Purpose |
| --- | --- |
| `/` | Product landing page and workflow preview. |
| `/workspace` | Primary event partnership workflow. |
| `/campaign` | Retained brand-side offer comparison, campaign planning and tracking tools. |
| `src/components/studio/` | Landing, workspace and proposal interfaces. |
| `src/lib/partnerships/` | Event research, brand investigation, planning rules and exports. |
| `src/lib/qloo/` | Shared server-side Qloo integration. |

See [ARCHITECTURE.md](ARCHITECTURE.md) for the data flow, API map, campaign tools and operational
boundaries. Recorded demos, video tooling, presentation notes and local QA artifacts stay outside Git.

## Development checks

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Tests cover research and investigation logic, response parsing, offer validation and campaign
optimization. Mocked tests do not establish live API access or commercial facts.

For a production preview, run `npm run build` followed by `npm start`. The optional campaign link store
uses a local JSON file; a multi-instance deployment needs shared durable storage.

## License

[MIT](LICENSE) © 2026 Niskarsh Dwivedi.

The license covers this project's source code. Third-party dependencies, fonts, Qloo services and
provider data remain subject to their own licenses and terms.
