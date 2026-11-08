# Dialogue style

Rules for the villager lines in `src/Villheim.Logic/Dialogue/*.txt`. The first set of lines failed Tyler's test
because they read as written by an AI (T-20, T-28). These rules come from his notes and from
https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing. They add to the writing rules in `CLAUDE.md`.

## What gives a line away

- Strings of short fragments: "Big. Angry. Go if you're going." "Skittish. You'll want a bow."
- The rule of three: three adjectives or three short phrases in a row ("Black water, gray trees, and a smell").
- A short closer that could end any line: "You'll hear them before you see them." "Nobody here can read it."
- Ominous or poetic one-liners: "The letters glow a little at dusk." "The old ones left words on it."
- Made-up proverbs and neat sayings that sound written for the moment.
- Negative parallelism: "not X but Y", "no X, no Y, just Z", "it's not X, it's Y".
- Em dashes.
- One template for every line of a kind, such as "They say there's X to the west, a short walk. Fragment."
- Fancy verbs in place of "is" and "has": "serves as", "stands as", "boasts", "offers".
- AI vocabulary: delve, testament, tapestry, vibrant, whisper, echo, ancient, linger, beckon, realm.
- Every line the same length, every line tidy and complete.

## What a good line does

- Fits a speech bubble. Most bubbles are 4 to 15 words, many under 8; a few run to about 20. Anything longer is split:
  " >> " lets the same speaker go on in a second bubble once the first has been read, and " // " lets the nearest
  other villager answer (Tyler, T-30). Use both sparingly.
- Varies in shape from one line to the next: a question, a fragment, a plain statement, a half-finished thought. The
  key fact sits in different places. No fixed template for a kind of line, and no repeated "statement plus short tag
  sentence" ("He didn't go in." "I marked the rock.").
- Sounds spoken: contractions, hedges ("I think", "far as I know"), a change of mind halfway through.
- Ends on the plain fact or the direction more often than on a joke. Small self-deprecating closers and stock phrases
  ("white as milk", "bet my boots") become their own tell across hundreds of lines.
- Names a person, a day or a small detail: who saw it, when, what they brought back, what went wrong.
- Starts somewhere other than the thing itself: with a person, a time, a complaint, a use for it.
- Asks the player something back or offers something.
- Stays with the speaker's own life: his trade, his family, his sore back, the neighbor who borrowed his axe.
- Uses the game's names: Greydwarf, Greyling, Troll, Fuling, Lox, Deathsquito, Seeker, Gjall, Tick, Dvergr, Eikthyr,
  the Elder, Bonemass, Moder, Yagluth. Never "goblin".
- Uses American spelling: color, gray, meter, neighbor, armor, rumor.

## Rumors

- Mix the shapes: the witness first ("Gunnar came back from the woods..."), the use first ("If you need copper..."),
  a question ("Have you been out past the river?"), the place first now and then.
- Direction and distance come out differently each time. `{where}` rolls one of several shapes; some lines use only
  `{dir}`, `{via}` or `{terrain}`; some leave the distance out.
- Rumors with `rumor:sure` (a runestone with boar, Greydwarfs or Draugr always around it) are said with confidence.
- Creature grounds (`rumor:ground`) are hedged: tracks, "most evenings", "I've seen them there twice".
- Never say more than the tags vouch for. A line about a place is about a real discovery.

## Voices and cultures

- steady: plain and practical. gruff: short-tempered, but still full sentences. cheerful: chatty, easily pleased.
  worrier: imagines the worst and says so at length. wry: dry, understated, jokes that come out sideways.
  elder: remembers, compares with the old days, repeats himself. young: questions, boasts, gets things a bit wrong.
  devout: brings in the gods as part of ordinary talk.
- Cultures speak through what they know: their food, their weather, their feasts, their grandmothers. They do not
  speak in proverbs.

## Gestures

- Only a section's own `~tone` moves the hands, and only now and then: `~wave` hellos and goodbyes, `~no` refusals,
  `~shrug` "I don't know", `~point` a place (the speaker turns to it first), `~joke` a laugh, `~proud` a thumbs up,
  `~cheer` good news, `~pious` a bow. A section with no tone gets no gesture. Worry, anger and sadness stay in the words.
- A line about a creature only plays when that creature is close by.

## Checking a file

Read it aloud. If three lines in a row have the same shape, rewrite one. If a line ends on a short sentence that
could end any other line, cut it or change it. If it sounds like a fortune cookie, start over.
