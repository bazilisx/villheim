# Showcase review, Tyler's notes (2026-11-11, Mountain Time)

Source: Tyler in chat, after walking the 16 `vh gen showcase` designs (build 1000-4015579). Copied word for word
below; this file is the primary source for the review. Media in `frames/`: `video1-*.jpg` (Meadows hub, one frame
every 2 s), `video2-*.jpg` (the next hub), `shot-a-hub-throne.jpg`, `shot-b-interior-door.jpg`, and
`shot-c-sill-mockup.jpg` (Tyler's mocked-up window sill, red circle).

Showcase order (row by row, left to right from the front): 01 hub md norse s5d3, 02 hub pl byzantine s5d3, 03 hub bf
celtic s4d3, 04 temple ml byzantine s3d3, 05 longhouse bf norse-forest s3d3, 06 tavern pl byzantine s3d3, 07 tavern
pl steppe s3d3, 08 home pl middle-eastern s3d3, 09 home sw baltic s3d3, 10 home bf slavic s3d3, 11 home md
anglo-saxon s2d3, 12 home ml lamari s2d3, 13 smithy mt norse-highland s2d3, 14 tower mt norse-highland s3d3, 15
workshop al castle-medieval s2d3, 16 home al castle-medieval s3d3.

---

great, thanks. Inspecting them now. Im going left to right from the front, so this one appears to be the meadows hub? I'll take notes as I inspect:

* Video 1 (meadows hub): shows a few things:
   * wood_fence is an angled, slanted outdoor fence. Its not the one to use for indoor areas.
   * Lots of signs stacked on top of each other
   * signs and item stands sticking out from the wall, not attached
   * torches oriented the wrong way
   * only limited types of decor
* Video 2 (the next hub)
   * No items on items stands
   * same errors as with the other location - wrong fence, lots of hovering stuff (both walls and on the floor (see the throne area).
   * limited decor (same torches every time, same candles every time)
   * notice board didnt render correctly
* #3 hub
   * Chests is clipping into the throne stage. 
   * wardrobe facing 180 degrees wrong way
   * odd use of darkwood_raven (its not an indoor decor, and its used mostly just on gables of houses, and not too often. Same with all the darkwood animal objects e.g darkwood_wolf. Theyre outdoor rooftop decor. See the corpus. 
   * gaps up top on the wall that dont complete the wall-to-roof connection. 
* Hub #4
   * Looks mostly good
   * Lacks itemstand items like the rest of them though (this is an issue across every single one, so I wont keep repeating it)
   * black marble tables shouldnt be paired with different colored or material bencehs (e.g. piece_bench_01 benches and a piece_blackmarble_table. Generally, we should aim to have the same wood color or material in a room. I.e. if you choose marble for a table, then the benches should be marble too, etc. with other furniture items from that biome. Cohesion among the lived-in clutter is something to consider. But dont treat this as law or a hard rule, please. Instead, please do as you've been doing: review the corpus, determine patterns, and come up with design plans that mirror these. 
* That completes row 1, left to right. Moving on to row 2, left most row.
   * Looks like a log longhouse. 
      * Plants outside on the sills are interesting but two of them (onion and dandlion) fell thru to the ground
      * Likewise, if youre doing plants, its a good idea to add clusters of them clipped and rotated to make the sills look healthier, busier, lush. And maybe review the corpus here too: how to others lay out patterns and clusters of plants? What plants do they place? What do the corpus designers do?
      * Ive mocked up an example of what a window sill might actually look like (red circle). Note that the sill is under the window. Theres additional 1x1 beams outlining the window, and outling the other two sides of the planter. Yours (farther downt he line) by contrast arent even aligned under the windows themselves, which is a bit odd. I'd fix that. 
      * Another common theme (like the lack of item stand items and the incorrect use of wood_fence indoors) is very narrow halls and wings that pepole cannot travel through. These halls are currently the width of a wood_floor piece, which is far too narrow. Anything small passageway must be at minimum two wood_floor pieces wide. Wider hallways can be 3 or more. But 1 of them is far too narrow for anything besides a small closet or hidden passageway type of thing. 
      * same logic in this longhouse as with others. Theres a blackmarble bench amidst the wooden furniture and rustic styles. A bit jarring juxtaposition and out of place too. 
      * in this building too, yove added two tables right next to each other, and each with many benches and styles of seats, from stools to log benches. Review the corpus and determine how many typical benches are in different types of rooms. How many tables. How many different types of furniture. This follows the rules I had hoped you'd research from other games as well. Consider the logic of the room. Why (in this case) would this family need one table with two log benches and 1 stool and 5 feet away and slightly farhter back, another blog bench and one stool. And against the wall near both, another log bench. Behind them, along the wall between the table and the black marble bench, a bed. Upstairs, another bed. On the farther side of this longhouse near the fire, another table, a bench, behind that bench, a log bench. Next to that log bench, a log bench. 2 stacked barrels, then another log bench and another table. My hope is that rooms have intent, and the furniture arrangement has intent within those rooms. So we seek to create kitbashed elements of diffeent styles, cultures, arrangements, tastes, lifestyles, and so on that would make sense in those rooms.
      * on to the next. 06-byzantine tavern. 
         * cute yard outside, nice use of fence gate.
         * nice barley plot but wood is misaligned and two diff types of wood used
         * same request as with other landscaping (and also interior design): intent and pattern is important to consider. As is theme. If this is a byzantine taveern in a certain biome, the trees should match, the gardens should be intentional instead of random mistc plants of all diff types scattered. There should be clusters of the plants too. 
         * bar is a cool feature but the darkwood beams are hovering above the woodwall_half. And the chests in this area (both the stacked piece_chest) and then the stacked piece_chest_wood both block the ability to get behind the bar at all. Its much too tight.
         * The chairs around the middle fire with cookingstation_iron here are oddly arranged. One has a table in front (fine) but then chests blocking its right side. Then another chair in front of those chests, angled away from the fire? Odd. And why use fire_pit for this area when we could use hearth for these sorts of taverns
         * same issue as with the other buildings: odd use of random stuff that doesnt seem to fit the intent that a human designer in the corpus would have done. E.g. you place random pots in a corner. pots are fine, but you place two piece_pots1 (green) and then one piece_pot1_cracked (brown, red glowing cracks) next to each other. A bit odd paring.
         * likewise, runetable upstairs is a cool idea, but its blackmarble and purple glowing accents so its a bit funky in the wooden sleeping room. 
         * I wonder if it would be useful to task a helper with determining colors and materials to make decorating rooms more intentional. I want to be clear, Im not saying only black marble stuff with black marble stuff. But I am saying that you should have a helper review the corpus in detail and learn eaxctly how the designers weaves differnt materials together and how they pair sets of tables and chairs, or benches, etc. and what furniture they use in specific rooms, and how they make custom furniture for different rooms, and so on. The list is long and comprehensive. 
         * You can also explore maybe how other wood pairings would be nice complementary things. Notably: deep north is brand new, so there are few well known beautiful builds with it yet, But the furniture is fabulous, the wood and wood beams etc are beautiful and rustic and could certainly pair well with any sort of meadows house onward, and certainly so too could some of the furniture. But thats where I leave it to you to research, color match, resaerch online how to design rooms in real life (like in a real house, those sorts of feng shui skills), as well as continue to research best practices from professional designers from games like BG3, ESO, skyrim, etc. from World of Warcraft (especially the player housing, with skilled players designing exceptionally beautiful and well arranged and lived in rooms. An example of an outstanding house arrangement was made by the Blizzard team themselves, and you can even walk around the house and see the lived-in clutter and beauty. That's an exemplar layout and creation that you should consider among my favorites for how interior design and clutter can make it feel alive, lived in, homey, cosy. https://worldofwarcraft.blizzard.com/en-us/housing?scene=A1&p=-0.6&y=3.5. This study and book area (https://worldofwarcraft.blizzard.com/en-us/housing?scene=B1&p=17.37&y=-9.21). This tavern-like bar (https://worldofwarcraft.blizzard.com/en-us/housing?scene=A1&p=-2.37&y=-7.68). You might consider having a helper click around this virtual scene in a browser (they can navigate with URLS like I am, or via the window itself) and take detailed notes on things to mirror and learn from. This is about as good as we can get for another game interior design since others are articles with a few spartan pcitures (though I still want you to utilize those. 
      * 07-steppe tavern next:
         * cool garden, very fun. Doesnt connect with the wall of the building
         * only minor thing here is the same thing with the others: black marble benches are funky with the rest of this furniture. 
         * walls are also a bit short, its underwhelming. 
      * 08-middle east home
         * exceptionally tight, almost too tight to walk around. It needs to be wider in all areas, and it could also be one wall-height higher.
         * same idea here with furniture pairings. You used an ashwood bench (which is curved, and dark) with lighter stuff.
   * New row (row 3)
      * 09 - baltic house
         * placement of firepit immediately inside of the door is odd
         * two chests side by side next to fire also odd. Are they a table?
         * piece_chair (what I call a stool) just sitting in the middle of the floor 5 feet from a table is odd
         * logbench facing a giant mead barrel 5 feet away also odd
         * piece_bed_02 facing the wrong direction
         * gaps and holes in the ceiling, roof pieces dont connect (e.g. rooftop45 and then woodroof_45 never connect. 
         * roof itself is odd, now that I look at it. If its intended to be a cross, its not. Tons of the pieces are misaligned, and one side of the roof is shifted left 5 feet compared to the other side
      * 010 -
         * same issues persist
         * hallway/wing with feast is way waaaay too narrow if its only one wood_floor wide. Since the feast and table are hjere, this would need a minimum of 1 wood_floor tile on either side to be walkable if you want to retain the vibe of the feast table in the middle. 
         * same issues as with other spots: random beds, slightly off kilter from one another. Two stacked random chests near the door? Odd. You make exceptionally heavy use of chests (and stacked chests) when Im confident that the corpus does not.
         * Yard is cool, fence is cool. 
      * 011 - 
         * wood-beam blocking the door and prevents me from entering, which is something we discussde and resolved days ago and should never have occurred. 
         * blackmarble bench facing directly into blackmarble chest is bizarre. And blackmarble chest is a clunky, wide, unwieldy storage chest, not furntiure or a table. 
      * 012 -
         * vines and outdoor looks cool
         * bannister or overhang lookout porch thing is a cool idea, but weird wood choice. Likewise, the wood isnt connected to each other. And the bannister porch thing is far too narrow at only 1 wood_floor piece wide. 
         * chimeny and cookstation immediately in front of you when entering is odd. Barely enough room to move around. Jarring. Armor stand to the right of the doorway is obstructive too. This house feels cramped, in part by the small size of the floorplan but also because lots of things along the primary walkways. 
         * upstairs entirely blocked by furntire, and incorrect furniture too. Why a chopping block with an axe (workbench_ext1)? And why is there a quarter-wall blocking my way, and then a marble bench further blocking it?
   * Last row
      * 013- smithy
         * charming, small, cozy. 
         * garden has potential if you take advice and do more research with the corpus to find better layout of plants
         * Inside interesting at first glance, but you reuse the same things over and over. You need to review the corpus to see how often specific pieces are reused. 
            * forge_ext4 is a wood cylinder with a large anvil on it. You have two of them. One next to the forge workbench (fine). One right in front of it, prevenitng access (bad). forge_ext2 is an old log with three tiny anvils on it, and its titled "anvil" . You have one to the right of the forge (fine) but then one smack dab in the middle of the entire floor (bad).
         * the x-shaped crossbeam (called wood wall roof top 45) is not correct placed. Its supposed to be aligned to things like wood beam 45. Yours arent. This is clear in the corpus, no one would do it like yours. 
      * 014 - tower
         * Interior (armor stand, torch, vert. item stand, chest, etc are all squished to the left (perhaps you were trying to leave room for the stairs?) but as a result, theyre all smushed together in a way that looks unintentionally clipped and smushed rather than intentional. 
         * upstairs rooms feel random. Same old thing over and over and over. Odd pairings, wierd layout, bizarre use of halfways in the middle of rooms
         * incorrect use of wood_fence, which is really only intended for pastures, garden fences, maybe village perimeter fencing. Never for building fences atop towers, etc. and certainly never indoors.
      * 015 - 
         * gaps in wall before roof.
         * odd mixture of grausten, stone, wood
         * odd assmebly and layout of furniture, odd choice of decorations like spinning wheel super close to the door.
         * youve been using wood_ledge on most of the buildings, which is fine, but you just seemingly place them randomly on a wall. Sometimes two next to each other. Sometimes randomly placed like throwing spaghetti at a wall. Suggest randomness, zero intent, zero human intuitiion. 
      * 016 - same issue with the other hallways but this ones worse because stairs are also blocking it so I cant even look in. 
         * Use of stone and grausetn looks weird. Stone is chunky and light gray. Grausten is smooth and dark gray and half the width. 


Biggest takeaways: significant work must be done to:

* research how rooms are laid out

* determine actual colors and design elements of all 3D models used for building pieces, for decor, and for any buildings, indoor, and outdoor elements. This is to ensure that a random assortment of different woods, materials, sizes, shapes, etc. arent just placed together. My hypothesis is that you place things based on their naming string. You cannot do this. You must create a database or spreadsheet tab with the original name or id of the piece from Valheim, and then you must come up with your own naming for them thats more appropriate for your use, and use that moving fowrad. Included in the database, you should describe the element color, texture, material, etc. so that when you make interior design decisions in future, you can pair things better by color, by material, by use, and so on. Once again, please dont let my words here steer and bias you to ONLY use these categories, or focus solely on these. Im speaking only in example, I want you to think indepdently and come up with a categorization tags, etc. that can aid with this yourself, and in the order and direction you want
* Interior design feels extremely random, and not intentional. There doesnt feel like any sort of intent or purpose or human thought is put into the rooms. They feel random. But not random in a good way, like kitbashing different prefab clusters together. It feels like just throwing things down hodgepodge, with very minimal thoguth behind it unfortunately
* You seem to get fixated with reusing and reusing and reusing the same elements
   * I saw the exact same type of torches in every biuld
   * I saw countless candles on every build
   * I saw the same drapes in every build
   * I saw the same log benches used 1000 times.
   * I saw the same pattenr of stacking chests on practicelly every corner of every build. Noone needs that many chests.


My recommendation to you: 

* send helpers out to figure out how to address all these major gaps. You have my detailed notes on every single building shown, which you can use to make pinpoint corrections, but I want to be very clear: this was indicative of a much much greater problem. The solution isnt just to patch up these 16 houses. Every single one was deeply flawed, 80% of it stemming for exceptionally poor interior design that did not represent the corpus meaningfully. 10% was issues with roofs. 10% was uninspired or flawed windows, window garden beds, or uninspired spartan, random gardens. So interior design is orders of magnitude more problematic than the others. Your helpers need to focus on learning from the corpus, learnign from outside sources like the wow player housing walkthrough, from bg3, from ESO, from skyrim, and from any others you deem useful. Your helpers need to learn from real-world feng shui and room layout intent. Your helpers need to determine the actual design and look of all objects used in this project, not just by their internal id string or their name but how they actually appear. Your helpers need to learn what types of thigns go into different rooms and in the database, tag specific items as appearing more or less frequently in those rooms. Your helpers need to look at how the corpus uses items, and in what types of rooms, and for what purposes. Your helpers need to look at the frequency and recurrence of items across these builds so you know which elements can be used heavily in a build, and which elements should be used less.
