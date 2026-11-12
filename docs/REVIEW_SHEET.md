# Review sheet mechanics

Tyler's review sheet: https://docs.google.com/spreadsheets/d/1rHaZArWhEa8V43UTZePM9EQSBwS6bvjsmAFPhnlQs6o/edit.
CLAUDE.md ("Sources and records") says when to ask and how answers are used; this file holds the column and status
details.

## Decisions tab

- One row per question: ID (D-###), Asked (the day it was put to Tyler, or the day he answered unasked, Mountain Time),
  Status, Topic, Question, Options and recommendation, Your answer, Decision on record, Where it came from, Feature.
- **Your answer:** Tyler's words as he gave them, chat answers copied word for word, never reworded.
- **Decision on record:** restates only what the answer says, then where it is built (file) once built.
- **Status:** Open (asked), Answered (Tyler answered), Done (built in the code with the file named in Decision on
  record; for a rule with no code, written into CLAUDE.md, `docs/DESIGN_QUALITIES.md`, `.claude/rules/village.md` or
  the doc named there). A decision that needs no work is Done with "No code". Tyler sets rows to Answered; a session sets
  Done once the work is built. A row with an Open "Code differs" row stays Answered until that row is settled. Whether
  it works in the game goes in the Tests tab.
- **Code differs rows:** used when code differs from a record and Tyler's own words do not settle which is right.
  When the code contradicts his words, the code is fixed and the row is not needed.

## Tests and Features tabs

- "Result" and "What you saw" are Tyler's reports.
- The Tests tab holds only tests still to run, in run order; resolved and obsolete tests move to the hidden Tests-All
  tab (Tyler, 2026-11-11).
- "Built and tested" in the Features tab needs a Tests row he marked Pass, or his word in chat.

## Code comments and the roadmap

- Code comments that cite a decision state only what that decision says.
- Roadmap: `[x]` means built, with the file or commit named; built items not tried in the game say "not tried in the
  game"; an item that conflicts with a decision or a project rule is removed, with the decision named.
