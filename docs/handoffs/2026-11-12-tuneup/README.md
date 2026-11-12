# Session instructions tune-up, 2026-11-12

Tyler (chat, 2026-11-12) asked for the recurring problems in how sessions work to be addressed "without creating a
series of overrestrictivr and over bound rules", with independent helpers auditing the changes so they are
"compliant, safe, best-practice (according to Anthropic and others)".

- Two audits ran first, independently: Tyler's recurring corrections (from past chats, records and the Decisions tab)
  and instruction best practice (Anthropic's Claude Code and prompting docs and engineering posts, with others). Both
  then reviewed the drafts. The audit files quote chats and live in the private repo, `research/2026-11-12-tuneup/`.
- Changed: `CLAUDE.md` (purpose first; working habits from the audits; Tyler's rules kept), `.claude/rules/village.md`
  (village rules), `docs/DESIGN_QUALITIES.md` (the measure for designs, with the hard-rules table),
  `docs/HELPER_RULES.md` (helpers and the council, replacing briefs kept outside the repo), `docs/REVIEW_SHEET.md`
  (sheet mechanics), `docs/DEVELOPMENT.md` (deleting branches), the seven seat criteria files (now diagnostic notes),
  `docs/SESSION_HISTORY.md` (current state only).
- Not applied, waiting for Tyler's yes: `config-proposal.md` in this folder (settings, hooks and a GitHub check that
  enforce identity, attribution, private corpus files and secrets in configuration).
- Not confirmed: whether path-scoped rules in `.claude/rules/` load in cloud sessions attached to a Project, so
  CLAUDE.md also tells sessions to read the village rules before village work.
