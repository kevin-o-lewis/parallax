# Parallax

Gather news on any topic from multiple trusted sources and synthesize them into structured facts and opposing interpretations, each with direct quotes and source links.

**Type:** Personal Tool  
**Stack:** Not yet chosen — set during the first design session.

## Constraints

- **Deployment:** Local only. No production infrastructure, multi-user architecture, or database.
- **Deliverable:** Must be video-recordable. The interface must be visible and interactive during a screen recording.
- **API access:** Requires News API key (free tier available) and Anthropic Claude API key (paid).
- **Traceability is non-negotiable:** Every fact and every opposing interpretation must include direct quotes and source links. Hallucinated citations are a product failure.
- **Safety mechanism:** Traceability (direct quotes + source links) is the sole defense against hallucination. No secondary review screen or approval gate in MVP; user responsibility to spot-check sources.

## Out of scope

- Multi-user architecture or authentication
- Production deployment, scaling, or uptime guarantees
- Integration with paywall-protected news APIs
- Social media scraping or politician statement grounding
- Political party labels or ideological framing — perspectives are presented neutrally
- Daily briefing or automated topic discovery
- Caching, search history, or saved topics
- Mobile app (desktop/web only for MVP)

## Conventions

- One MVP feature = one spec, one plan, one branch.
- Specs go in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`.
- Architecture decision records go in `docs/decisions.md` — a single file, index table at the top, full entries below. Reserved for genuine architectural forks.

## Environment notes

Two Claude Code sandbox behaviors worth knowing, found during framework testing — true regardless of stack:

- Dev servers and other long-running network services must not be started inside the sandbox — they become silently unreachable from anywhere, including localhost, with no error shown. Start these unsandboxed from the beginning (`dangerouslyDisableSandbox`, or run outside sandbox mode entirely).
- Commands crossing a WSL2/Windows boundary, if applicable (`wsl.exe`, `powershell.exe` via `/mnt/c/Windows/System32/...`), always need unsandboxed execution — the sandbox's network namespace has no route to the Windows host.

## One-time settings checklist (before the first design session)

Run this once, in the first Claude Code session, after the stack is chosen but before starting `brainstorming`. Skip entirely if a later session finds this has already been done.

State each item below as a decision for the PM to confirm or override — never ask the PM to supply a technical specific themselves. The stack is already known from this file's Stack line; use it.

1. "This project uses [package manager implied by the chosen stack]. I'll pre-approve its routine install, test, and build commands in `.claude/settings.json` so normal tooling doesn't keep prompting — let me know if you'd rather review those individually instead."
2. "Will you want to test this on a phone or another device while building it?" If yes: note that dev servers need to start unsandboxed from the beginning (see Environment notes above), and that Windows/WSL2 port forwarding is worth setting up now rather than mid-feature.
3. "Will this app need to regularly talk to anything outside itself — a third-party service, a shared database — worth pre-approving now instead of getting asked mid-build?" Check the PRD's Technical Constraints section for known answers before asking.

Write the resulting rules directly into `.claude/settings.json`. This is a one-time setup step, not a per-session ritual.

## Closeout procedure

Run this when a feature's implementation finishes, whether complete or not. Nothing in this procedure edits this file.

1. Copy the progress ledger to `docs/superpowers/ledgers/`, named to match its plan file. If it is missing, say so rather than closing quietly.
2. Say plainly what is not done. Do not call a feature complete if any acceptance criterion is missing.
3. Push the branch and open a PR. This does not change `docs/roadmap.md` — pushed and unmerged is not done.
4. On merge (not push):
   - Update `docs/roadmap.md`'s table — mark this feature Done, mark the next feature Next.
   - Add a Session Notes entry to `docs/roadmap.md`, dated, in this shape:

## [Date]

 **Shipped:** [Feature # — title, one line on what changed]
 **Session Summary:** [deviations from plan, reusable values, open items, unscoped follow-ups, decision links — whatever's relevant, omit what doesn't apply. Plain language — this is a fast orientation read, not a technical record. Technical depth belongs in the ledger, spec, or plan; link to those rather than restating their detail here.]

- Check whether any other row shares this feature's Milestone value and is still undone. If none do, update `README.md`'s Status line to that Milestone's label (e.g. all `MVP` rows done → Status becomes `MVP`; later, all `v1` rows done → Status becomes `v1`). If rows for that milestone remain undone, leave README Status unchanged.

New rows added to `docs/roadmap.md` after initial scaffolding (post-MVP work) must be given a Milestone value when added. There is no automated process for proposing or sequencing post-MVP batches yet — sequence and tag them the same way the initial MVP order was proposed and approved.

## Documents

- `docs/prd-parallax.md` — what is being built and why. Read before design.
- `docs/decisions.md` — why it was built this way. Read the index table first, then individual entries only as needed.
- `docs/roadmap.md` — what's built, what's next, and the running Session Notes log. Read before starting feature work.

## Maintenance

This file is maintained by hand, except closeout's effect on `docs/roadmap.md` and `README.md`'s Status line, which update automatically per the closeout procedure above. Update Stack after the first design session.
