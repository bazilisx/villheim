using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Villagers;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Turns what a village knows (Knowledge) into talk. Every line about a place is about a real discovery the speaker
    /// knows: one he saw himself ("I saw"), one he was told in a chat ("Ingrid told me"), or one the whole village has
    /// had time to hear ("they say").
    ///
    /// Each time a villager picks a line, one discovery he knows may be picked (RumorChance), weighted by what it is
    /// (bosses and dungeons first, bosses not yet felled most), how he knows it and how fresh it is. Its tags go in
    /// with the rest:
    ///   rumor, rumor:saw / rumor:heard / rumor:common, rumor:&lt;kind&gt;, rumor:&lt;kind&gt;:&lt;key&gt;,
    ///   rumor:near / rumor:far, rumor:spotted, rumor:new (found today, by him), rumor:felled (a boss that is down),
    ///   rumor:when:day / night / any (creatures), rumor:terrain:&lt;code&gt;, rumor:sure (a runestone with boar,
    ///   Greydwarfs or Draugr always round it), rumor:ground (a creature ground or biome edge, not a place).
    /// Kinds: boss dungeon trader runestone landmark ruin fuling dvergr ore nest forage game foe biome.
    /// Fill-ins: {thing} {thingshort} {where} {direction} {dir} {terrain} {via} {distance} {biome} {witness} {rteller}
    /// {daysago} {when}. {where}, {direction} and {distance} come out in a different shape each time.
    ///
    /// Requests: with the village short of something the land gives, findit:known or findit:unknown and {findit};
    /// with no food in the chest, need:meat with meat:known or meat:unknown and {meatwhere}.
    /// </summary>
    internal static class Rumors
    {
        private sealed class Pick
        {
            public Knowledge.Discovery D;
            public string Form;
            public string Teller;
        }

        private sealed class Focused
        {
            public int Id;
            public float Until;
        }

        private static readonly ConditionalWeakTable<Villager, Pick> Picks = new ConditionalWeakTable<Villager, Pick>();
        private static readonly ConditionalWeakTable<Villager, Focused> Foci = new ConditionalWeakTable<Villager, Focused>();
        private static Pick _forced;

        private static int Today => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;

        /// <summary>The villager's next line or two should be about this discovery (he just found it or passed it on).</summary>
        public static void Focus(Villager villager, int id)
        {
            Focused f = Foci.GetOrCreateValue(villager);
            f.Id = id;
            f.Until = Time.time + 45f;
        }

        // ---------------------------------------------------------------- tags

        public static IEnumerable<string> Tags(Villager villager, VillageHearth hearth)
        {
            var tags = new List<string>();
            Picks.Remove(villager);
            if (!Knowledge.On || hearth == null || !hearth.IsValid)
            {
                return tags;
            }

            NeedTags(hearth, tags);
            Pick pick = _forced ?? Choose(villager, hearth);
            if (pick == null)
            {
                return tags;
            }

            Picks.Add(villager, pick);
            Knowledge.Discovery d = pick.D;
            float distance = Utils.DistanceXZ(d.Position, hearth.transform.position);
            tags.Add("rumor");
            tags.Add("rumor:" + pick.Form);
            tags.Add("rumor:" + d.Kind);
            tags.Add("rumor:" + d.Kind + ":" + d.Key);
            tags.Add("rumor:terrain:" + d.Terrain);
            if (distance < 350f) tags.Add("rumor:near");
            if (distance > 900f) tags.Add("rumor:far");
            if (d.How == "spotted") tags.Add("rumor:spotted");
            if (pick.Form == "saw" && d.Day == Today) tags.Add("rumor:new");
            if (d.When.Length > 0) tags.Add("rumor:when:" + d.When);
            // A runestone with a spawner round it: the creatures are always there, so it is said with confidence.
            if (d.Kind == "runestone" && d.Key != "runestone") tags.Add("rumor:sure");
            if (!Knowledge.IsPlace(d.Kind)) tags.Add("rumor:ground");
            if (d.Kind == "boss" && BossDown(d.Key)) tags.Add("rumor:felled");
            return tags;
        }

        private static Pick Choose(Villager villager, VillageHearth hearth)
        {
            List<Knowledge.Discovery> log = Knowledge.Log(hearth);
            if (log.Count == 0)
            {
                return null;
            }

            Dictionary<int, string> heard = Knowledge.Heard(villager);
            if (Foci.TryGetValue(villager, out Focused focus) && Time.time < focus.Until)
            {
                Knowledge.Discovery d = log.FirstOrDefault(x => x.Id == focus.Id);
                if (d != null)
                {
                    string form = Knowledge.Form(villager, d, heard, out string teller);
                    if (form != null)
                    {
                        return new Pick { D = d, Form = form, Teller = teller };
                    }
                }
            }

            float chance = LogicConfig.RumorChance != null ? LogicConfig.RumorChance.Value : 0.4f;
            if (Random.value > chance)
            {
                return null;
            }

            var options = new List<(Pick Pick, float Weight)>();
            foreach (Knowledge.Discovery d in log)
            {
                string form = Knowledge.Form(villager, d, heard, out string teller);
                if (form == null)
                {
                    continue;
                }

                float weight = Knowledge.Importance(d.Kind) * (form == "saw" ? 2.5f : form == "heard" ? 1.8f : 1f);
                weight *= 1f + Mathf.Max(0f, 4f - (Today - d.Day)) / 4f;
                if (d.Kind == "boss")
                {
                    weight *= BossDown(d.Key) ? 0.4f : 2f;
                }

                options.Add((new Pick { D = d, Form = form, Teller = teller }, weight));
            }

            if (options.Count == 0)
            {
                return null;
            }

            float roll = Random.value * options.Sum(o => o.Weight);
            foreach ((Pick p, float w) in options)
            {
                roll -= w;
                if (roll <= 0f)
                {
                    return p;
                }
            }

            return options[options.Count - 1].Pick;
        }

        private static void NeedTags(VillageHearth hearth, List<string> tags)
        {
            if (!LogicConfig.IsOn(LogicConfig.KnowledgeRequests))
            {
                return;
            }

            string material = TopNeed(hearth);
            if (material != null && Knowledge.Sought(material))
            {
                tags.Add(Knowledge.SourceOf(hearth, material) != null ? "findit:known" : "findit:unknown");
            }

            if (Healing.ChestFood(hearth) == null)
            {
                tags.Add("need:meat");
                tags.Add(Knowledge.MeatGround(hearth) != null ? "meat:known" : "meat:unknown");
            }
        }

        private static string TopNeed(VillageHearth hearth)
        {
            VillageNeeds needs = VillageNeeds.For(hearth.VillageId);
            return needs != null && needs.Missing.Count > 0 ? needs.Missing.OrderByDescending(n => n.Value).First().Key : null;
        }

        private static readonly (string Key, string Global)[] BossKeys =
        {
            ("eikthyr", "defeated_eikthyr"), ("elder", "defeated_gdking"), ("bonemass", "defeated_bonemass"),
            ("moder", "defeated_dragon"), ("yagluth", "defeated_goblinking"), ("queen", "defeated_queen"), ("fader", "defeated_fader"),
        };

        private static bool BossDown(string key)
        {
            string global = BossKeys.FirstOrDefault(b => b.Key == key).Global;
            return global != null && ZoneSystem.instance != null && ZoneSystem.instance.GetGlobalKey(global);
        }

        // ---------------------------------------------------------------- fill-ins

        // The words for one line are rolled once per line, from a seed, so {where} and {distance} in the same line agree.
        private static System.Random _words = new System.Random(1);

        private static T One<T>(params T[] options) => options[_words.Next(options.Length)];

        public static string Fill(string line, Villager villager)
        {
            if (line.IndexOf('{') < 0)
            {
                return line;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth != null && hearth.IsValid)
            {
                if (line.Contains("{findit}"))
                {
                    line = line.Replace("{findit}", FindIt(hearth));
                }

                if (line.Contains("{meatwhere}"))
                {
                    line = line.Replace("{meatwhere}", MeatWhere(hearth));
                }
            }

            if (!Picks.TryGetValue(villager, out Pick pick) || hearth == null || !hearth.IsValid)
            {
                return line;
            }

            _words = new System.Random(Random.Range(1, int.MaxValue));
            Knowledge.Discovery d = pick.D;
            Vector3 home = hearth.transform.position;
            float distance = Utils.DistanceXZ(d.Position, home);
            string terrain = WorldSurvey.TerrainWords(d.Terrain, WorldSurvey.Biome(d.Position));
            line = line.Replace("{thing}", Thing(d))
                .Replace("{thingshort}", Short(d))
                .Replace("{where}", Where(hearth, d))
                .Replace("{direction}", Direction(d, home))
                .Replace("{dir}", WorldSurvey.Compass(d.Position - home))
                .Replace("{terrain}", terrain)
                .Replace("{via}", Via(hearth, d))
                .Replace("{distance}", DistanceWords(distance))
                .Replace("{biome}", WorldSurvey.BiomeWords(WorldSurvey.Biome(d.Position)))
                .Replace("{witness}", Witness(d))
                .Replace("{rteller}", pick.Teller ?? "someone")
                .Replace("{daysago}", DaysAgo(d.Day))
                .Replace("{when}", d.When == "night" ? "at night" : d.When == "day" ? "in daylight" : "any time of day");
            return Tidy(line);
        }

        /// <summary>An empty fill-in leaves double spaces or a space before a comma: closed up here.</summary>
        private static string Tidy(string line)
        {
            line = System.Text.RegularExpressions.Regex.Replace(line, @" {2,}", " ");
            line = line.Replace(" ,", ",").Replace(" .", ".").Replace(", ,", ",").Trim();
            return line.Length > 0 ? char.ToUpperInvariant(line[0]) + line.Substring(1) : line;
        }

        private static string Direction(Knowledge.Discovery d, Vector3 home)
        {
            string compass = WorldSurvey.Compass(d.Position - home);
            string dir = One("to the " + compass, compass + " of here", "out " + compass, "off " + compass);
            return d.Lean == "sea" && d.Terrain != "shore" && d.Terrain != "sea" && _words.Next(3) == 0 ? dir + ", by the sea" : dir;
        }

        /// <summary>
        /// Where it is, from the hearth, short and in one of several shapes: "over the ridge to the north", "north,
        /// a fair walk", "past the tar pit". Every shape gives the direction or a known place on the way.
        /// </summary>
        public static string Where(VillageHearth hearth, Knowledge.Discovery d)
        {
            Vector3 home = hearth.transform.position;
            float distance = Utils.DistanceXZ(d.Position, home);
            string compass = WorldSurvey.Compass(d.Position - home);
            string terrain = WorldSurvey.TerrainWords(d.Terrain, WorldSurvey.Biome(d.Position));
            if (distance < 150f)
            {
                return One($"just past the {compass} fence", $"right by us, {compass} side", $"a stone's throw {compass}");
            }

            string landmark = Landmark(hearth, d);
            var shapes = new List<string> { Direction(d, home), $"{compass}, {DistanceWords(distance)}", $"{DistanceWords(distance)} {compass}" };
            if (terrain.Length > 0)
            {
                shapes.Add($"{terrain} to the {compass}");
                shapes.Add($"{terrain}, {compass}");
            }

            if (landmark != null)
            {
                shapes.Add($"past {landmark}");
                shapes.Add($"{compass}, beyond {landmark}");
            }

            return shapes[_words.Next(shapes.Count)];
        }

        /// <summary>Something on the way to it, for {via}: a known place on the same line out, or the lie of the land.</summary>
        private static string Via(VillageHearth hearth, Knowledge.Discovery d)
        {
            string landmark = Landmark(hearth, d);
            if (landmark != null)
            {
                return "past " + landmark;
            }

            string terrain = WorldSurvey.TerrainWords(d.Terrain, WorldSurvey.Biome(d.Position));
            return terrain.Length > 0 ? terrain : "out";
        }

        /// <summary>A known place about the same way, closer to home: "the tar pit". Null if there is none.</summary>
        private static string Landmark(VillageHearth hearth, Knowledge.Discovery d)
        {
            Vector3 home = hearth.transform.position;
            Vector3 to = (d.Position - home).Horizontal();
            float far = to.magnitude;
            if (far < 200f)
            {
                return null;
            }

            Knowledge.Discovery best = null;
            float bestScore = float.MaxValue;
            foreach (Knowledge.Discovery other in Knowledge.Log(hearth))
            {
                if (other.Id == d.Id || !Knowledge.IsPlace(other.Kind) || other.Kind == d.Kind && other.Key == d.Key)
                {
                    continue;
                }

                Vector3 v = (other.Position - home).Horizontal();
                float near = v.magnitude;
                if (near < 80f || near > far * 0.85f || Vector3.Angle(v, to) > 20f)
                {
                    continue;
                }

                float score = Mathf.Abs(far * 0.5f - near);
                if (score < bestScore)
                {
                    best = other;
                    bestScore = score;
                }
            }

            return best != null ? Short(best) : null;
        }

        /// <summary>Distance in plain words, said a few different ways for each band.</summary>
        public static string DistanceWords(float meters)
        {
            if (meters < 150f) return One("close by", "not far");
            if (meters < 350f) return One("a short walk", "not far out");
            if (meters < 700f) return One("a fair walk", "a good way out");
            if (meters < 1100f) return One("a long walk", "a good hike");
            if (meters < 1600f) return One("half a day out", "a long way off");
            return One("a full day's walk", "a very long way");
        }

        private static string Witness(Knowledge.Discovery d)
        {
            if (d.Witness.Length > 0) return d.Witness;
            switch (d.How)
            {
                case "camp": return "the folk at the camp";
                case "trail": return "somebody on the trail";
                case "daughter": return "folk from the new village";
                default: return "somebody";
            }
        }

        private static string DaysAgo(int day)
        {
            int ago = Today - day;
            if (ago <= 0) return "today";
            if (ago == 1) return "yesterday";
            if (ago == 2) return "the day before yesterday";
            if (ago < 7) return PlayerMemory.Number(ago) + " days back";
            return "a while back";
        }

        /// <summary>"There's copper up the hill to the north. Ingrid saw it herself." Or that nobody knows.</summary>
        private static string FindIt(VillageHearth hearth)
        {
            _words = new System.Random(Random.Range(1, int.MaxValue));
            string material = TopNeed(hearth);
            Knowledge.Discovery d = Knowledge.SourceOf(hearth, material);
            string label = Materials.Label(material ?? "Wood").ToLowerInvariant();
            if (d == null)
            {
                return One($"Nobody here knows where to find {label} yet.", $"None of us has found any {label} out there so far.");
            }

            string seen = d.Witness.Length > 0 && d.Firsthand ? One($" {d.Witness} found it.", $" {d.Witness} has been there.", "") : "";
            return d.Kind == "runestone" && d.Key == "boars"
                ? $"There are always boar around the runestone {Where(hearth, d)}.{seen}"
                : $"There's {Thing(d)} {Where(hearth, d)}.{seen}";
        }

        private static string MeatWhere(VillageHearth hearth)
        {
            _words = new System.Random(Random.Range(1, int.MaxValue));
            Knowledge.Discovery d = Knowledge.MeatGround(hearth);
            if (d == null)
            {
                return "Nobody's found good hunting ground yet.";
            }

            if (d.Kind == "runestone")
            {
                return One($"The boar never leave that runestone {Where(hearth, d)}, so that's where I'd go.",
                    $"Go to the runestone {Where(hearth, d)}. There are always boar rooting around it.");
            }

            string when = d.When == "night" ? "at night" : d.When == "day" ? "in daylight" : "most hours";
            return $"You might find {Thing(d)} {when} {Where(hearth, d)}, if you're lucky.";
        }

        /// <summary>The "Needed" sign's second line: where the village thinks it can be found.</summary>
        public static string BoardWhere(VillageHearth hearth, string material)
        {
            if (!Knowledge.On || !LogicConfig.IsOn(LogicConfig.KnowledgeRequests) || !Knowledge.Sought(material))
            {
                return null;
            }

            Knowledge.Discovery d = Knowledge.SourceOf(hearth, material);
            if (d == null)
            {
                return "Where: nobody here knows";
            }

            Vector3 home = hearth.transform.position;
            string terrain = WorldSurvey.TerrainWords(d.Terrain, WorldSurvey.Biome(d.Position));
            return $"Where: {WorldSurvey.Compass(d.Position - home)}{(terrain.Length > 0 ? ", " + terrain : "")}, " +
                   WorldSurvey.Distance(Utils.DistanceXZ(d.Position, home));
        }

        // ---------------------------------------------------------------- names of things

        // Kind:key to (what it is, in a few words; what it is called short). Creatures and places use the game's names.
        private static readonly Dictionary<string, (string Thing, string Short)> Things = new Dictionary<string, (string, string)>
        {
            ["boss:eikthyr"] = ("Eikthyr's altar, where the big stag with lightning in its antlers waits", "Eikthyr's altar"),
            ["boss:elder"] = ("the Elder's altar, where the old tree giant waits", "the Elder's altar"),
            ["boss:bonemass"] = ("Bonemass's altar, out in the swamp", "Bonemass's altar"),
            ["boss:moder"] = ("Moder's altar, high up in the mountains", "Moder's altar"),
            ["boss:yagluth"] = ("Yagluth's altar, where the old Fuling king is buried", "Yagluth's altar"),
            ["boss:queen"] = ("a sealed Dvergr door in the mist with the Queen behind it", "the Queen's door"),
            ["boss:fader"] = ("Fader's altar, out in the Ashlands", "Fader's altar"),
            ["dungeon:burial"] = ("a burial chamber", "the burial chamber"),
            ["dungeon:sunkencrypt"] = ("a sunken crypt", "the sunken crypt"),
            ["dungeon:trollcave"] = ("a troll cave", "the troll cave"),
            ["dungeon:frostcave"] = ("a frost cave", "the frost cave"),
            ["dungeon:infestedmine"] = ("an infested mine", "the infested mine"),
            ["trader:haldor"] = ("Haldor the trader's camp", "Haldor's camp"),
            ["trader:hildir"] = ("Hildir's camp", "Hildir's camp"),
            ["trader:bogwitch"] = ("the Bog Witch's hut", "the Bog Witch's hut"),
            ["runestone:runestone"] = ("a runestone", "the runestone"),
            ["runestone:boars"] = ("a runestone with boar all around it", "the boar runestone"),
            ["runestone:greydwarfs"] = ("a runestone with Greydwarfs all around it", "the Greydwarf runestone"),
            ["runestone:draugr"] = ("a runestone with Draugr standing around it", "the Draugr runestone"),
            ["landmark:stones"] = ("the sacrificial stones, where newcomers first wake up", "the sacrificial stones"),
            ["landmark:tarpit"] = ("a tar pit", "the tar pit"),
            ["landmark:tower"] = ("an old stone tower", "the old tower"),
            ["landmark:giant"] = ("the bones of a giant", "the giant's bones"),
            ["landmark:henge"] = ("a ring of standing stones", "the stone ring"),
            ["landmark:dolmen"] = ("a dolmen", "the dolmen"),
            ["landmark:wreck"] = ("a shipwreck", "the wreck"),
            ["landmark:well"] = ("an old well", "the old well"),
            ["landmark:cairn"] = ("a cairn", "the cairn"),
            ["landmark:drakenest"] = ("a Drake nest up in the rocks", "the Drake nest"),
            ["landmark:greydwarfcamp"] = ("a Greydwarf camp", "the Greydwarf camp"),
            ["fuling:fulingvillage"] = ("a Fuling village", "the Fuling village"),
            ["dvergr:dvergr"] = ("a Dvergr outpost", "the Dvergr outpost"),
            ["ruin:swampruin"] = ("old stone ruins in the swamp", "the swamp ruins"),
            ["ruin:swamphut"] = ("a hut on stilts", "the stilt hut"),
            ["ruin:cabin"] = ("an empty log cabin", "the cabin"),
            ["ruin:house"] = ("an old ruined house", "the old house"),
            ["ruin:farm"] = ("an old farm gone to weeds", "the old farm"),
            ["ruin:village"] = ("an old ruined village", "the old village"),
            ["ruin:stonehouse"] = ("an old stone house with no roof", "the stone house"),
            ["ruin:stoneruin"] = ("old stone ruins", "the ruins"),
            ["ore:copper"] = ("copper", "the copper"),
            ["ore:tin"] = ("tin", "the tin"),
            ["ore:silver"] = ("a silver vein", "the silver"),
            ["ore:obsidian"] = ("obsidian", "the obsidian"),
            ["ore:iron"] = ("scrap iron", "the scrap iron"),
            ["ore:flametal"] = ("flametal", "the flametal"),
            ["nest:greydwarfnest"] = ("a Greydwarf nest", "the Greydwarf nest"),
            ["nest:draugrpile"] = ("a Draugr body pile", "the body pile"),
            ["nest:bonepile"] = ("a bone pile", "the bone pile"),
            ["forage:raspberries"] = ("raspberry bushes", "the raspberries"),
            ["forage:blueberries"] = ("blueberry bushes", "the blueberries"),
            ["forage:cloudberries"] = ("cloudberries", "the cloudberries"),
            ["forage:beehive"] = ("a wild beehive", "the beehive"),
            ["game:boar"] = ("boar", "the boar"), ["game:deer"] = ("deer", "the deer"), ["game:neck"] = ("Necks", "the Necks"),
            ["game:hare"] = ("hares", "the hares"), ["game:lox"] = ("Lox", "the Lox"),
            ["foe:greyling"] = ("Greylings", "the Greylings"), ["foe:greydwarf"] = ("Greydwarfs", "the Greydwarfs"),
            ["foe:brute"] = ("Greydwarf brutes", "the brutes"), ["foe:shaman"] = ("Greydwarf shamans", "the shamans"),
            ["foe:troll"] = ("Trolls", "the Trolls"), ["foe:skeleton"] = ("skeletons", "the skeletons"),
            ["foe:ghost"] = ("ghosts", "the ghosts"), ["foe:wolf"] = ("wolves", "the wolves"), ["foe:drake"] = ("Drakes", "the Drakes"),
            ["foe:fenring"] = ("Fenrings", "the Fenrings"), ["foe:fuling"] = ("Fulings", "the Fulings"),
            ["foe:deathsquito"] = ("Deathsquitos", "the Deathsquitos"), ["foe:blob"] = ("Blobs", "the Blobs"),
            ["foe:draugr"] = ("Draugr", "the Draugr"), ["foe:leech"] = ("leeches", "the leeches"), ["foe:wraith"] = ("Wraiths", "the Wraiths"),
            ["foe:surtling"] = ("Surtlings", "the Surtlings"), ["foe:abomination"] = ("Abominations", "the Abominations"),
            ["foe:golem"] = ("Stone Golems", "the Stone Golems"), ["foe:seeker"] = ("Seekers", "the Seekers"), ["foe:tick"] = ("Ticks", "the Ticks"),
            ["foe:bat"] = ("bats", "the bats"), ["foe:ulv"] = ("Ulvs", "the Ulvs"), ["foe:bear"] = ("Bjørn", "the Bjørn"),
            ["foe:serpent"] = ("sea serpents", "the sea serpents"),
            ["biome:meadows"] = ("the Meadows", "the Meadows"), ["biome:blackforest"] = ("the Black Forest", "the Black Forest"),
            ["biome:swamp"] = ("the Swamp", "the Swamp"), ["biome:mountain"] = ("the Mountains", "the Mountains"),
            ["biome:plains"] = ("the Plains", "the Plains"), ["biome:ocean"] = ("the sea", "the sea"),
            ["biome:mistlands"] = ("the Mistlands", "the Mistlands"), ["biome:ashlands"] = ("the Ashlands", "the Ashlands"),
            ["biome:deepnorth"] = ("the Deep North", "the Deep North"),
        };

        public static string Thing(Knowledge.Discovery d) =>
            Things.TryGetValue(d.Kind + ":" + d.Key, out var t) ? t.Thing : d.Key;

        public static string Short(Knowledge.Discovery d) =>
            Things.TryGetValue(d.Kind + ":" + d.Key, out var t) ? t.Short : d.Key;

        /// <summary>Which way the line's place lies from this villager, for pointing; null when his line is about no place.</summary>
        public static Vector3? PlaceOf(Villager villager) =>
            Picks.TryGetValue(villager, out Pick pick) ? pick.D.Position : (Vector3?)null;

        // ---------------------------------------------------------------- 'vh know rumors'

        /// <summary>
        /// Sample lines from the nearest villager of the village, each about one discovery (the most worth telling
        /// first), with the real target, distance and witness after it, to check the words against the land.
        /// </summary>
        public static string Samples(VillageHearth hearth, int count)
        {
            Player player = Player.m_localPlayer;
            Villager speaker = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => !v.IsDead() && v.VillageId == hearth.VillageId)
                .OrderBy(v => player != null ? Vector3.Distance(v.transform.position, player.transform.position) : 0f).FirstOrDefault();
            if (speaker == null)
            {
                return $"No villager of {hearth.VillageName} is loaded.";
            }

            Vector3 home = hearth.transform.position;
            List<Knowledge.Discovery> log = Knowledge.Log(hearth);
            if (log.Count == 0)
            {
                return $"{hearth.VillageName} knows nothing of the land yet. Try 'vh know survey full'.";
            }

            var lines = new List<string> { $"{speaker.VillagerName} of {hearth.VillageName} ({Dialogue.VoiceOf(speaker)}):" };
            Dictionary<int, string> heard = Knowledge.Heard(speaker);
            foreach (Knowledge.Discovery d in log.OrderByDescending(d => Knowledge.Importance(d.Kind)).ThenBy(_ => Random.value).Take(count))
            {
                string form = Knowledge.Form(speaker, d, heard, out string teller) ?? "common";
                _forced = new Pick { D = d, Form = form, Teller = teller };
                string said;
                try
                {
                    said = Dialogue.LineFor(speaker, "talk", "rumor:" + d.Kind + ":" + d.Key) ??
                           Dialogue.LineFor(speaker, "talk", "rumor:" + d.Kind) ??
                           Dialogue.LineFor(speaker, "talk", "rumor") ?? "(no line fits)";
                }
                finally
                {
                    _forced = null;
                }

                float distance = Utils.DistanceXZ(d.Position, home);
                lines.Add($"   \"{said}\"\n      <- {d.Kind} {d.Key} at ({d.Position.x:0}, {d.Position.z:0}), {distance:0} m " +
                          $"{WorldSurvey.Compass(d.Position - home)}, {d.Terrain}, {form}, {d.How}{(d.Witness.Length > 0 ? " by " + d.Witness : "")}, day {d.Day}");
            }

            return string.Join("\n", lines);
        }
    }
}
