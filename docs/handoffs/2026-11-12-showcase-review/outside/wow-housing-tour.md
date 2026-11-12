# World of Warcraft housing tour: room notes

Source: Blizzard, "WoW Housing Virtual Tour", https://worldofwarcraft.blizzard.com/en-us/housing (the three links Tyler
gave: `?scene=A1&p=-0.6&y=3.5` the house, `?scene=B1&p=17.37&y=-9.21` the study, `?scene=A1&p=-2.37&y=-7.68` the
bar). Read 2026-11-12 in the built-in browser and the cloud browser, read only, no sign-in.

How it was read: the page is a pannellum viewer. Its `viewerData` lists 36 scenes on two floors, each a cube map of six
2048 px faces (front at yaw 0, right 90, back 180, left 270, up, down), with the links between scenes and a floor map
for each floor. Faces were opened one at a time and looked at; the floor maps were zoomed per room. Screenshots, the
scene graph (`scenes.txt`) and the face list (`cubes.json`) are in the private repo
`villheim-corpus/research/2026-11-12-outside/wow/`. File names below are those screenshots. Nothing from the tour is
copied into the public repo.

Scene ids by place (from the floor maps): O1 to O5 outside; A1 to A5 the ground floor front block (bar, kitchen,
pantry); J1 to J3 the ground floor east wing (lounge, study bedroom); B1 to B4 the two-storey library; B5 to B7 the
library gallery; C1 to C3 the upper central gallery hall; D1, E1 the round guest bedroom; F1 to H1 the west passage
and cave den; I1 to I5 the upper south room (lounge, kitchen counter, fireplace, sleeping corner).

Valheim names after each point are the nearest vanilla pieces; track A's catalog is the place to check looks.

## Floor plan (floor1-plan.png, floor2-plan.png and zooms)

- Ground floor: a front block (bar and kitchen) at the bottom, a large library block in the middle top, an east wing,
  a walk-out to a yard. Upper floor: a cross plan. The long central gallery hall (C1 to C3) runs north to south with a
  runner rug the whole length; four rooms open off it: the library gallery to the north, a round guest bedroom east,
  the I room south, a passage and cave den west.
- Every room opens off a hall or a larger room. No room is a passage to another room except the library, which is
  the house's hub on the ground floor.
- The gallery hall is about three times as wide as its runner rug, with alcoves between pillars on both sides; the
  alcoves hold the decor (trophies, a bench, curtains) so the middle stays clear.
- The I room (floor2-I-room-zoom.png) is one open room in zones: a fireplace corner (bottom left) with a round rug in
  front, a sofa and an armchair round a round rug (middle right), a small table on a rectangular rug (top middle), a
  kitchen counter along the bottom wall, stairs down along the left wall, a long rug placed diagonally between zones.
  Each zone has its own rug. The middle of the room is the walk from the door to the stair.
- The round guest bedroom (floor2-D-room-zoom.png) is an octagon inside a square shell: the bed against the far wall,
  a long red rug on one side, a sitting corner with a fire, round pillars at four corners. The space between the
  octagon and the square is left empty.

## Upper floor

### C1 to C3, gallery hall (C3-front-gallery-hall.png)

- Purpose: the walk that joins the upper rooms; also the place for trophies and pictures.
- Focal point: the far door at the end of the runner, with a pair of potted shrubs either side of it.
- Walking line: the runner rug down the middle, unbroken, door to door.
- Placement: thick round pillars in two rows; blue curtains tied back at each pillar; between pillars, a low bench or
  a small table set back against the wall; trophies (masks, mounted heads, a sword) hung on the pillars at eye height
  and above. Candle chandeliers hang down the center line, one per bay.
- Clutter: almost none on the floor. All the dressing is on the walls and pillars.
- Left empty: the whole middle strip.
- Lesson for a hall: the dressing lives in bays along the sides, repeated per bay with variation in what is hung
  (mask, head, picture); the runner and the lights mark the line. Valheim: rug runners (`rug_red`, `jute_carpet`),
  `piece_chandelier`, banners or drapes per post pair, trophies on `itemstand`, a bench in some bays.

### I1 to I5, upper south room (I1-front-door-trophies.png, I1-right-fireplace-cupboards.png, I2-front-lounge.png, I3-left-kitchen-counter.png)

- Purpose: a family's day room: sitting by the fire, eating, a small kitchen counter.
- Focal point: a stone-chimney fireplace on the end wall with a matching tall cupboard either side, all three as one
  composition (symmetry around the fire). A string of lights runs under the roof ridge.
- Zones: fireplace and sofa with a small side table on its own rug; a long low table with a bench along one wall
  (food on it); the kitchen counter; the door and stair corner.
- Walking line: from the door at the gallery end straight down the room past the sofa's back; the stair foot is clear.
- Furniture sets: the sofa faces the fire with its back to the walking line; a low side table with a jug beside the
  sofa; a footstool; a tall candle stand at the end of the bench table. One wood tone for the frame (mid brown), blue
  fabric for every soft piece (sofa, rugs, curtains, cupboard doors).
- Clutter layers:
  - Wall: a wall of trophies above the door (a mask, a mounted shield, a crest), a fishing net hung across the corner
    with a starfish in it, pictures in pairs high on the wall, a mounted dragon head.
  - Counter (I3): a candle in a dish at the end, three cups and a large jar, then a board of fruit and fish, a pan with
    a cooked lobster with steam rising; a bunch of dried corn hung from the shelf above; spice jars on open shelves.
  - Floor: a pot, a barrel, a footstool, a flamingo ornament by the fire (a joke piece), a bunch of flowers in a vase
    on the sofa table.
  - Ceiling: string lights, a chandelier over the stair.
- Lived in: food mid-cooking with steam; cups set out as for guests; cushions thrown on the sofa; one odd personal
  piece (the flamingo) beside serious ones.
- Left empty: the floor between the sofa zone and the door; the wall over the counter apart from one picture.
- Valheim: `piece_cookingstation` or `piece_cauldron` on the counter, `itemstandh` with food (cooked fish, bread,
  jam), drinks on `itemstandh` (mead), `piece_table` long with `piece_bench01`, a chair by the fire, trophies on
  `itemstand`, `piece_chest_wood` as the low table only if dressed.

### D1, E1, round guest bedroom (E1-front-bedroom-corner.png, E1-back-hearth-nook.png)

- Purpose: sleeping and sitting for a guest of standing (a different culture from the rest of the house: white stone,
  gold and red, Blood Elf).
- Focal point: a small carved fireplace in one bay of the octagon with a mirror and a round red rug before it, cushions
  on the rug.
- Zones: bed bay; fire bay; a reading bay (a blue couch under a curtained window, wall shelves of books over it);
  a dresser.
- Furniture sets: fireplace + round rug + two floor cushions + a padded chair at the edge. Couch + side shelf with a
  small chest on it + tall candle stand.
- Clutter: books on curved wall shelves, a goblet, a small locked chest on a nightstand, a scroll in the nightstand's
  open shelf, a zebra-print cushion on the floor, a flamingo ornament again, a trophy on the wall, vines grown over a
  pillar.
- Light: a three-candle stand at floor level, a three-candle sconce over the fire, the fire.
- Palette: cream walls and floor, gold trim, red and blue fabric. Every piece shares the gold trim.
- Lesson: a room for a different person can carry a different culture's set, but all of its pieces share one trim and
  one wood. Mixed sets stay within a room, never within a group.

### F1, F2, G1, G2, H1, west passage and cave den (F1-front-landing-corner.png, G2-front-reading-alcove.png, H1-front-cave-den.png)

- F1: a landing corner by a pillar: a basket with a lid, a potted plant with flowers, a small silver chest on the
  floor under a portrait, pictures stacked two high. Corners at a turn get a group of three floor pieces of different
  heights (tall basket, mid plant, low chest).
- G2: a reading alcove: bookcases behind tied-back curtains, a single wooden chair facing out, a low table at the side
  with a plate of food and a cup. The chair, the light and the books make a nook in a passage bay.
- H1: a cave den off the house: a small fire pit (a cauldron in the coals), a log seat, a tiny stool with a hide on it,
  books stacked on the floor, a torch on the rock wall, a ragged cloth hung on a cord, a goblin-like doll. Rougher
  pieces for a rougher room: the furniture is logs and hide, not joinery.

### B5 to B7, library gallery (B6-front-dresser-landing.png)

- A dresser on the landing with a lantern, a book lying open and a cup on top; three pictures hung in a stepped
  group above; a goblet on the floor beside it; a lidded basket in front. Small objects in odd counts on one surface
  (lantern, book, cup), each at a different height.

## Ground floor, library and study (Tyler's study link, B1)

### B1 to B4, the library (B1-front-study.png, B2-left-table.png, B2-right-fireplace.png, B3-back-library.png, B4-front-stair.png)

- Purpose: study and reading, and the hub of the ground floor.
- Focal point: from the door, a portrait on the far wall over the inner door, framed by a cloth swag; from inside,
  the long study table under the chandelier, and the fireplace on the side wall.
- Zones: (1) the long study table in the middle on a large patterned rug; (2) the fireplace with pictures round it
  and potted shrubs either side; (3) a writing desk with a chair against the right wall under the stair; (4) a reading
  corner under the stair with a small table and chair (seen through the stair); (5) the open stair up to the gallery,
  with a lantern on its newel post and a basket of flowers at its foot.
- Walking lines: from the entry to the stair foot, from the stair foot to the inner door and to the fireplace. The
  rug and the table sit to one side; the stone floor between the table and the desk is bare.
- Furniture sets: the long table has benches down both sides, all one wood (golden with iron caps), with a red runner
  cloth down the table. The writing desk has its own chair, of another make, set at an angle as if just pushed back.
- Clutter on the table (B2-left-table.png): a big cauldron at the near end, tankards, stacks of books (three to five
  high, each stack a different count), a book open on a stand, a candle stand of three candles, a goblet, a lantern.
  The near end is busy; the far end thins out.
- Floor clutter: a book lying open on the floor, a tankard on a small pile of books, a stack of books against a bench
  leg (B1-front-study.png). These sit at the edge of the walking line, never on it.
- Wall layer: floor to ceiling bookcases on every wall, a ladder of shelves up both storeys, pictures and a portrait,
  a gold skull crest, cobwebs in the high corners, loose pages hanging in the air (a magic touch).
- Light: two chandeliers of candles at mid height, three-candle stands on the table and by the desk, wall sconces at
  the stair, a lantern on the newel post, the fire. Lights come in a chain along the walking line.
- Palette: two woods (a golden mid brown for furniture and shelves, a dark brown for the posts and beams), iron caps,
  gray flagstone floor, red and purple textiles, blue curtains. Every furniture piece in the room shares the iron caps.
- Lived in: a book left open on the floor, cups on the table among the books, the desk chair turned, cobwebs high up.
- Left empty: the floor between the table rug and the desk; the space at the foot of the stair.
- Valheim: `piece_table_oak` or `piece_table` long with `piece_bench01` both sides; `itemstandh` with books are not
  vanilla, so the nearest are horizontal stands with items, `piece_cauldron` at a table end, `piece_chandelier`,
  `piece_walltorch` or `piece_brazierceiling01`, the rune table (`piece_runetable`? check catalog) only in a study.

## Ground floor, east wing (J1 to J3)

### J1 to J3, lounge and study bedroom (J1-right-wing.png, J2-front-fireplace.png, J3-right-desk-bed.png, J3-back-wall.png)

- Purpose: one long room with a sitting end (fireplace) and a sleeping and work end.
- Focal point: the fireplace with a stone chimney (J2-front-fireplace.png), dressed on its mantel with two small
  pieces at the ends (a statuette and a lantern), a candle stand of three on one side, two barrels and a small crate
  on the floor on that side, a potted shrub and a blue curtain on the other. Unequal sides: barrels left, plant right.
- Zones: (1) fire with a round blue rug and a footstool; (2) a red sofa under the curtained window, angled to the room;
  (3) a long low table with benches (a work table with tools) down the middle right; (4) at the far end a bed against
  the end wall with a drafting desk and chair beside it and a candle stand between them (J3-right-desk-bed.png).
- Walking line: the length of the room on the left side, between the sofa and the table.
- Wall layer (J3-back-wall.png): one end wall dressed as a group: three pictures (two stacked, one beside), a small
  wall shelf with three books and a box, a hanging lantern on the post, a long banner in the next bay. The wall is
  dressed in bays between posts, one theme per bay.
- Desk vignette: a drafting table with plans spread on it, a set square and ruler lying on them, a paper hanging off
  the edge; a chair turned toward it; a portrait and a landscape on the wall above; a jar on the floor by the chair.
- Lived in: plans mid-work, the chair pulled out, a cobweb in the ceiling corner.
- Valheim: `bed` head to the end wall, `piece_table` as desk with a `piece_chair` turned, a `piece_walltorch` or
  `piece_groundtorch_wood` between bed and desk, banners on the far wall bay, `itemstand` with a map item? (check
  catalog), barrels (`barrell`) in a pair by the fire.

## Ground floor, front block: the bar and kitchen (Tyler's house and bar links, A1 to A5)

### Plan (floor1-A-block-zoom.png)

- One long room about twice as deep as wide, entered through a porch at the short end (O2 to A1). Two rows of thick
  posts split it into a wide middle aisle and narrow side bays.
- Left side, front to back: the bar counter with stools along the left wall (A1, A5), then the kitchen corner with a
  sunken fire and a counter (A3), then the pantry behind a doorway in the far corner (A4).
- Middle: a low square table on a red rug just inside the entry (A1), then a bear rug on the open floor, then the
  aisle to the library door at the far end.
- Right side, in the bays between the posts: two small seat nooks each on a blue rug (a bench and a small table), and
  between them a stand-alone round fireplace with a tall flue (A5-right-hearth.png).
- Every group sits on its own rug: the entry table on red, the kitchen fire on red, the nooks on blue, the bear rug
  alone in the aisle.

### A1 and A5, the bar (A1-front.png, A1-front-bar-zoom.png, A5-left-bar.png)

- Purpose: a home bar where the household and guests drink and eat.
- Focal point: from the entry, the low table on the red rug with a big book and a cup on it; behind it the long aisle
  lit by hanging lanterns; at the bar itself (A5), a carved sign board over the back shelves (a crest with a shield,
  flanked by bunches of dried corn).
- Zones: the counter (front), the back shelves (behind the counter against the wall), the stools (in front), the
  kegs at the end of the counter (A2-left-kegs.png).
- Walking line: the counter stands one stool's depth off the aisle; the stools stand on the floor in front of it and
  the aisle stays clear behind them. Behind the counter there is room to stand between the counter and the shelves.
- Furniture set: one counter of one wood (dark brown with iron caps at every joint), padded round stools with fur tops
  and iron bases, two of them at the counter and more along it; a small wooden stool tucked under the near end. All
  seats at the bar are one kind.
- Clutter layers:
  - Counter top, in groups with gaps: a candle stand of three at one end; a book lying flat; an apple; three cups
    together; a cheese on a board with a knife; a tray of bread and tools; a mug at the far end; a small lantern;
    a bowl with steam. About eight to twelve small things along a counter of about six stools, never evenly spaced.
  - Back shelves: two shelf rows of jars, baskets, small crates of vegetables and spices, a lantern; the top shelf
    holds the sign; the shelves are full, as a store is full.
  - Floor: a red keg and a clay pot and a woven basket at the end of the counter (three different heights); a small
    tankard under a stool.
  - Wall and posts: a mask crest on the post, a dragon head, a horn and arrow trophy on the next post, a fishing net
    across the corner, dried corn bunches in pairs.
  - Ceiling: string lights (bulbs on a red cord) across the beams, a chandelier with three candles over the counter,
    iron lanterns hung on the posts at head height, cobwebs in the top corners.
- Light: warm and low. A light every few steps along the aisle (lanterns on posts), candles on the counter, the
  string lights overhead, the fire glow from the kitchen. No dark stretch longer than about two posts.
- Palette: two woods (mid brown floor and furniture, dark brown posts and beams), iron for caps and fittings, stone
  for the lower walls and the fireplace, teal and gold for the hangings (the household's color), red for rugs and
  cloth. Fabrics repeat two colors (red, teal) in every zone.
- Lived in: steam over food, a book open on the table, cups set in a group, a cobweb, a fishing net that has been
  hung up and left, a plush toy on the fireplace hearth.
- Left empty: the aisle, the floor between the entry table and the bear rug, the floor behind the counter.
- Valheim: counter of `woodwall_half` or `piece_table` in a row with `itemstandh` on top; a back wall of
  `piece_shelf`-like rows (vanilla has no shelf; builders use `wood_beam` ledges or `wood_ledge`?, check catalog);
  `piece_chair` or log stools in one kind; kegs as `barrell` on their side? (check catalog) or `piece_mead...`
  (no vanilla mead barrel piece; the fermenter `fermenter` is the nearest keg look); `piece_chandelier` over the bar;
  `piece_walltorch` on posts; `rug_deer` / `rug_wolf` / `rug_bear`? as the aisle rug.

### A2, kegs at the end of the bar (A2-left-kegs.png)

- Three kegs on their sides in a row on a low iron-bound stand, each smaller than the last, with a tap; a mug under
  the nearest tap; a banner in the household's color hung on the stone wall behind; ivy over the top; a net in the
  corner; a candle stand of three on the counter end.
- Lesson: a drink station is the kegs, a mug at the tap, a light, and a banner behind, set at the end of the counter
  where the server stands. Valheim: `fermenter` pairs, or barrels on a `wood_beam` rack, with an `itemstandh` mead
  item.

### A3, kitchen corner (A3-left-kitchen.png)

- Purpose: cooking for the bar.
- Focal point: a sunken round fire pit with a raised stone rim used as a table edge: a big cauldron in the middle with
  steam, a plate with a cooked lobster on the rim, a board with bowls, a pestle and vegetables on the far side.
- Behind it: a counter along the wall with a small chest, a lantern and a little pot on it; two shelf rows above with
  baskets, a lantern and a box of vegetables; spice sacks in a row; dried corn hung from the beam.
- Light: the fire, a candle stand on the floor beside the counter, two lanterns on the shelves.
- Lesson: the cook's fire has food at every stage (raw in boxes and sacks, cooking in the pot, done on the plate).
  Valheim: `piece_cookingstation` or `piece_cauldron` over `fire_pit` or `hearth`, `piece_cauldron` extensions
  (spice rack, butcher table, pots), `itemstandh` with raw meat and cooked meat, a barrel and sacks? (check catalog).

### A4, pantry (A4-front-winerack.png, A4-back-pantry-door.png)

- Purpose: storage for the bar and kitchen.
- Seen: a wine rack, lidded woven baskets on the floor, kegs stacked, a doorway back into the kitchen. Storage goes in
  a small room of its own behind the place it serves; the pantry door looks straight at the kitchen fire.

### A5, the stand-alone fireplace (A5-right-hearth.png)

- A tall round fireplace with a stone flue, set against the right wall between two posts. Mantel shelf with one book
  on it. Around it, an uneven group: a woven basket, a lantern on the floor, a flamingo ornament on the left; a small
  stool, a tankard, a sack and a big barrel on its side on the right. A picture and a crest on the wall above on the
  left; a mounted dragon head on the right.
- Lesson: the fire is a wall feature in a bay, dressed on both sides unequally (left light and tall, right heavy and
  low), with things that belong to sitting by it (a drink, a stool, fuel in a sack). Valheim: `hearth` or
  `piece_brazierfloor01` against a wall between posts; for a social room the corpus places the fire in the middle
  (D-131 note: home fires on walls, social fires in the middle).

## What the house does throughout

Counts are from the views above (about 30 faces of 14 scenes), so they are counts of what was seen.

1. **Every group stands on its own rug.** 11 of 12 furniture groups seen sit on a rug of their own (entry table,
   kitchen fire, two bar nooks, library table, lounge fire, I-room sofa, I-room table, guest fire, guest bed, hall
   runner). The rug sets the zone. Rugs are of three or four kinds per floor and two colors per room.
2. **The walking line is bare floor.** In every room the line from door to door or door to stair is clear; small
   clutter sits at its edge (a book on the floor by a bench leg, a tankard under a stool), never on it.
3. **One wood for furniture, one darker wood for structure, iron fittings on both.** The library, the bar and the I
   room all keep this. Iron caps are the thread that ties pieces of different makes together.
4. **Two fabric colors per room**, repeated in rugs, curtains, cushions and hangings (red and teal in the bar, red and
   blue in the library, blue in the I room, red and gold in the guest room).
5. **Focal point at the end of the view from the door**: the low table on its rug (bar entry), the portrait over the
   inner door (library), the door at the end of the runner (gallery hall), the fireplace (I room). Fireplaces are
   framed symmetrically by structure (cupboards, posts, plants) and dressed asymmetrically by small things.
6. **Small things in odd groups of three** (three cups, three candles on a stand, three pictures stepped, three floor
   pieces of different heights at a corner), with a gap before the next group.
7. **Wall dressing in bays between posts**, one theme per bay (trophies, pictures, a banner, a net). Most walls carry
   two layers: something hung high (crest, head, picture) and something low (shelf, counter, bench).
8. **Overhead layer everywhere**: string lights, chandeliers, lanterns on posts, dried food hung from beams, nets,
   cobwebs. The ceiling is never bare in a room people use.
9. **Food and drink at every stage**: raw (sacks, crates, hung corn), cooking (steam over a pot), served (plates,
   cups in groups), stored (kegs, baskets).
10. **Mid-use signs**: an open book, a pushed-back chair, plans on a desk with a ruler on them, steam, cups set out.
11. **A light every few steps**: chains of lanterns and candles along the walking lines; candle stands in threes;
    a hung light over each table.
12. **One or two odd personal pieces per room** (the flamingo, a plush toy, a zebra cushion) among serious pieces.
13. **Things left empty on purpose**: the aisle, the floor behind the counter, the space at a stair foot, the middle
    of the gallery hall, the gap between the octagon room and its square shell.
14. **Storage behind, not in front**: the pantry is a room behind the kitchen; kegs at the end of the bar; chests
    appear only as small accent pieces on shelves or a nightstand. No room has chests stacked along a wall.
    (The corpus does stack chests: 58 % of chests per `relx.chestsStacked`. The tour is a show home; this point is
    for living rooms, and storage rooms follow the corpus.)
