# R4 proposal: enforce the no-exception rules in configuration (for Tyler's yes)

Status: proposal only. Nothing here is in the repo. Each part changes configuration, so each needs Tyler's yes.

Why: CLAUDE.md is read as guidance, and Claude may judge that a guideline does not apply. Rules that must hold every
time belong in settings and hooks, which the harness or git applies regardless
([best practices](https://code.claude.com/docs/en/best-practices), [memory docs](https://code.claude.com/docs/en/memory)).
Keep the enforced set small: only identity, attribution, force-push and branch deletion, secrets, and the private
corpus. Everything else stays guidance.

There are three layers, because no single one reaches every kind of session:

| Layer | Applies in | Stops it before it happens? |
|---|---|---|
| A. `.claude/settings.json` (attribution, permissions, Claude hooks) | Local Claude Code; single-repo cloud sessions. The settings docs say repo hooks and permissions do **not** apply in cloud threads inside a Project. Test this first. | Yes |
| B. Git hooks in `.githooks/` (`core.hooksPath`) | Any clone where the path is set: layer A's SessionStart hook sets it, and one CLAUDE.md line covers sessions without layer A | Yes, at commit time |
| C. GitHub Action on push | Every push, from anywhere | No, it flags after the push |

## A. `.claude/settings.json`

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "attribution": { "commit": "", "pr": "" },
  "permissions": {
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(**/*.pem)",
      "Read(**/*.key)",
      "Read(~/.ssh/**)",
      "Read(~/.git-credentials)"
    ],
    "allow": [
      "WebFetch(domain:valheim.fandom.com)",
      "WebFetch(domain:www.valheimgame.com)",
      "WebFetch(domain:thunderstore.io)",
      "WebFetch(domain:github.com)",
      "WebFetch(domain:raw.githubusercontent.com)",
      "WebFetch(domain:en.wikipedia.org)",
      "WebFetch(domain:code.claude.com)",
      "WebFetch(domain:platform.claude.com)",
      "WebFetch(domain:www.anthropic.com)"
    ]
  },
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/session-start.sh" } ] }
    ],
    "PreToolUse": [
      { "matcher": "Bash",
        "hooks": [ { "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/git-guard.sh" } ] }
    ]
  }
}
```

Notes:
- `attribution` with empty strings hides the Co-Authored-By trailer and the PR line
  ([settings reference](https://code.claude.com/docs/en/settings-reference); `includeCoAuthoredBy` is deprecated).
  This ends the clash with the system reminder at its source.
- The `allow` list is a fallback for reading pages through a fetch when Claude in Chrome is not available. Tyler edits
  the list. Allow rules in a committed project file apply only after the folder is trusted.
- Force-push is not in `deny`, because a deny rule would block it even after Tyler says yes. The hook below asks him
  instead.

### `.claude/hooks/session-start.sh`

```bash
#!/usr/bin/env bash
# Sets the commit identity and turns on the repo's git hooks for this clone (CLAUDE.md, "Identity and git").
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git config user.name "Baz"
git config user.email "113806309+bazilisx@users.noreply.github.com"
git config core.hooksPath .githooks
exit 0
```

### `.claude/hooks/git-guard.sh`

```bash
#!/usr/bin/env bash
# PreToolUse on Bash. Commits need Baz's identity; force-push and remote branch deletion go to Tyler for a yes.
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
case "$cmd" in *git*) ;; *) exit 0 ;; esac

want='113806309+bazilisx@users.noreply.github.com'
if printf '%s' "$cmd" | grep -Eq '(^|[;&|[:space:]])git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+commit([[:space:]]|$)'; then
  dir=$(printf '%s' "$input" | jq -r '.cwd // "."')
  email=$(git -C "$dir" config user.email)
  if [ "$email" != "$want" ]; then
    echo "git user.email is '$email'. Set it first: git config user.name Baz && git config user.email $want" >&2
    exit 2
  fi
fi

if printf '%s' "$cmd" | grep -Eq 'git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+push([[:space:]].*)?([[:space:]](-f|--force|--force-with-lease)([[:space:]=]|$)|[[:space:]]\+[^[:space:]]+|[[:space:]](-d|--delete)([[:space:]]|$)|[[:space:]]:[^[:space:]]+)'; then
  jq -n '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "ask",
    permissionDecisionReason: "Force-push or branch deletion: needs Tyler'"'"'s yes in this session (CLAUDE.md, Identity and git)."}}'
  exit 0
fi
exit 0
```

Check before committing these:
- The JSON output (`hookSpecificOutput`, `permissionDecision: "ask"`) and exit code 2 follow the hooks docs as I
  know them. I could not reread the hooks reference in this session, so test both: ask a session for a commit with a
  wrong email, and for a dry `git push --force`.
- The `-C` handling assumes the repo is the hook's `cwd` unless `-C` comes right after `git`. The git-level
  `pre-commit` below catches every other case.
- An "ask" with nobody present means the action waits. That matches the rule.

## B. Git hooks (commit them in `.githooks/` in bazilisx/villheim only)

### `.githooks/pre-commit`

```bash
#!/usr/bin/env bash
# Identity, private corpus, secrets. Em dashes in added doc lines only warn (quotes of others' words may hold them).
want='Baz <113806309+bazilisx@users.noreply.github.com>'
for v in GIT_AUTHOR_IDENT GIT_COMMITTER_IDENT; do
  id=$(git var "$v" | sed -E 's/ [0-9]+ [+-][0-9]{4}$//')
  if [ "$id" != "$want" ]; then echo "pre-commit: $v is '$id', expected '$want'" >&2; exit 1; fi
done

# Corpus blueprints and other builders' work stay in bazilisx/villheim-corpus (D-157).
bad=$(git diff --cached --name-only --diff-filter=AM | grep -Ei '\.(blueprint|vbuild)$' | grep -v '^blueprints/approved-generated/')
if [ -n "$bad" ]; then echo "pre-commit: blueprint files belong in the private corpus repo:" >&2; echo "$bad" >&2; exit 1; fi

# Tokens and keys in added lines.
if git diff --cached -U0 --diff-filter=AM | grep -E '^\+' | grep -Eq 'gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[abprs]-[A-Za-z0-9-]{10,}'; then
  echo "pre-commit: staged text looks like a token or private key; remove it" >&2; exit 1
fi

if git diff --cached -U0 --diff-filter=AM -- '*.md' | grep -E '^\+[^+]' | grep -q $'\xe2\x80\x94'; then
  echo "pre-commit: warning: em dash in added doc lines (fine only inside a quote of someone else's words)" >&2
fi
exit 0
```

### `.githooks/commit-msg`

```bash
#!/usr/bin/env bash
# Commits read as Tyler's own: no attribution lines, no em dashes (CLAUDE.md).
body=$(grep -v '^#' "$1")
fail=0
if printf '%s\n' "$body" | grep -Eiq '^(Co-Authored-By|Claude-Session):|Generated with \[?Claude'; then
  echo "commit-msg: remove attribution lines" >&2; fail=1
fi
if printf '%s' "$body" | grep -q $'\xe2\x80\x94'; then
  echo "commit-msg: em dash in the message; use a comma, colon or parentheses" >&2; fail=1
fi
exit $fail
```

Both files need the executable bit (`git update-index --chmod=+x`).

The repo has no tracked `.blueprint` or `.vbuild` files today (`git ls-files`), so the corpus rule blocks nothing in
use now. `blueprints/approved-generated/` is exempt because CLAUDE.md names it as the place for designs Tyler approved.

One CLAUDE.md line, for sessions where layer A does not run (replace the current "check `git config`" sentence):

> Before the first commit of a session, run `git config core.hooksPath .githooks` and set the Baz identity; the
> hooks then check every commit.

Never pass `--no-verify` to get around them (P10). Tyler can, on his own machine.

## C. `.github/workflows/commit-policy.yml`

```yaml
name: Commit policy
on: push
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Author, committer and attribution lines
        env:
          BEFORE: ${{ github.event.before }}
          AFTER: ${{ github.sha }}
        run: |
          want='113806309+bazilisx@users.noreply.github.com'
          if [ "$BEFORE" = "0000000000000000000000000000000000000000" ]; then
            commits=$(git rev-list "$AFTER" --not origin/main)
          else
            commits=$(git rev-list "$BEFORE..$AFTER")
          fi
          bad=0
          for c in $commits; do
            ae=$(git log -1 --format=%ae "$c"); ce=$(git log -1 --format=%ce "$c")
            if [ "$ae" != "$want" ]; then echo "::error::$c author is $ae"; bad=1; fi
            if [ "$ce" != "$want" ] && [ "$ce" != "noreply@github.com" ]; then echo "::error::$c committer is $ce"; bad=1; fi
            if git log -1 --format=%B "$c" | grep -Eiq '^(Co-Authored-By|Claude-Session):|Generated with \[?Claude'; then
              echo "::error::$c has attribution lines"; bad=1
            fi
          done
          exit $bad
```

This catches a slip from any session or machine. It cannot undo a push; a red check tells the next session to fix
the commit, which needs a force-push and so Tyler's yes. GitHub rulesets have commit metadata rules (author email and
message patterns) that would reject a push outright. Whether they are offered on this account's plan for this repo
needs checking in the repo settings.

## What stays guidance (CLAUDE.md), on purpose

Writing voice, the Decisions tab process, design rules, the session log. Each has reasonable exceptions, so Claude
should weigh them in context ([best practices](https://code.claude.com/docs/en/best-practices): "a hook is for a
rule with *zero* exceptions").

## Order to try it

1. Add layer B and the CLAUDE.md line. This works everywhere, and nothing about it depends on the harness.
2. Add layer A. In one local session and one cloud session, check that `git config core.hooksPath` prints
   `.githooks` and that a test commit shows no trailer.
3. Add layer C.
