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
    /// Each time a villager picks a line, one discovery he knows may be picked (RumourChance), weighted by what it is
    /// (bosses and dungeons first, bosses not yet felled most), how he knows it and how fresh it is. Its tags go in
    /// with the rest:
    ///   rumour, rumour:saw / rumour:heard / rumour:common, rumour:&lt;kind&gt;, rumour:&lt;kind&gt;:&lt;key&gt;,
    ///   rumour:near / rumour:far, rumour:spotted, rumour:new (found today, by him), rumour:felled (a boss that is down),
    ///   rumour:when:day / night / any (creatures), rumour:terrain:&lt;code&gt;.
    /// Kinds: boss dungeon trader runestone landmark ruin fuling dvergr ore nest forage game foe biome.
    /// Fill-ins: {thing} {thingshort} {where} {direction} {terrain} {distance} {witness} {rteller} {daysago} {when}.
    ///
    /// Requests: with the village short of something the land gives, findit:known or findit:unknown and {findit};
    /// with no food in the chest, need:meat with meat:known or meat:unknown and {meatwhere}.
    /// </summary>
    internal static class Rumours
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
            tags.Add("rumour");
            tags.Add("rumour:" + pick.Form);
            tags.Add("rumour:" + d.Kind);
            tags.Add("rumour:" + d.Kind + ":" + d.Key);
            tags.Add("rumour:terrain:" + d.Terrain);
            if (distance < 350f) tags.Add("rumour:near");
            if (distance > 900f) tags.Add("rumour:far");
            if (d.How == "spotted") tags.Add("rumour:spotted");
            if (pick.Form == "saw" && d.Day == Today) tags.Add("rumour:new");
            if (d.When.Length > 0) tags.Add("rumour:when:" + d.When);
            if (d.Kind == "boss" && BossDown(d.Key)) tags.Add("rumour:felled");
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

            float chance = LogicConfig.RumourChance != null ? LogicConfig.RumourChance.Value : 0.5f;
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

            Knowledge.Discovery d = pick.D;
            Vector3 home = hearth.transform.position;
            float distance = Utils.DistanceXZ(d.Position, home);
            string terrain = WorldSurvey.TerrainWords(d.Terrain, WorldSurvey.Biome(d.Position));
            return line.Replace("{thing}", Thing(d))
                .Replace("{thingshort}", Short(d))
                .Replace("{where}", Where(hearth, d))
                .Replace("{direction}", Direction(d, home))
                .Replace("{terrain}", terrain.Length > 0 ? terrain : "out")
                .Replace("{distance}", WorldSurvey.Distance(distance))
                .Replace("{witness}", Witness(d))
                .Replace("{rteller}", pick.Teller ?? "someone")
                .Replace("{daysago}", DaysAgo(d.Day))
                .Replace("{when}", d.When == "night" ? "at night" : d.When == "day" ? "by day" : "at any hour");
        }

        private static string Direction(Knowledge.Discovery d, Vector3 home)
        {
            string dir = "to the " + WorldSurvey.Compass(d.Position - home);
            if (d.Terrain == "shore" || d.Terrain == "sea") return dir;
            return d.Lean == "sea" ? dir + ", toward the sea" : d.Lean == "inland" ? "inland " + dir : dir;
        }

        /// <summary>Where it is, from the hearth: "over the ridge to the north, a good walk".</summary>
        public static string Where(VillageHearth hearth, Knowledge.Discovery d)
        {
            Vector3 home = hearth.transform.position;
            float distance = Utils.DistanceXZ(d.Position, home);
            string terrain = WorldSurvey.TerrainWords(d.Terrain, WorldSurvey.Biome(d.Position));
            string where = distance < 150f
                ? $"just outside the village, {Direction(d, home)}"
                : $"{(terrain.Length > 0 ? terrain + " " : "")}{Direction(d, home)}, {WorldSurvey.Distance(distance)}";
            if (d.How == "spotted")
            {
                where += d.Terrain == "sea" ? ", spotted from the shore" : ", seen from a way off";
            }

            return where;
        }

        private static string Witness(Knowledge.Discovery d)
        {
            if (d.Witness.Length > 0) return d.Witness;
            switch (d.How)
            {
                case "camp": return "the people at the camp";
                case "trail": return "someone on the trail";
                case "daughter": return "folk from the new village";
                default: return "someone";
            }
        }

        private static string DaysAgo(int day)
        {
            int ago = Today - day;
            if (ago <= 0) return "today";
            if (ago == 1) return "yesterday";
            if (ago < 7) return PlayerMemory.Number(ago) + " days ago";
            return "a while back";
        }

        /// <summary>"There's copper in the rocks over the ridge to the north, a good walk. Ingrid saw it." Or that nobody knows.</summary>
        private static string FindIt(VillageHearth hearth)
        {
            string material = TopNeed(hearth);
            Knowledge.Discovery d = Knowledge.SourceOf(hearth, material);
            if (d == null)
            {
                return $"Nobody here knows where to find {Materials.Label(material ?? "Wood")} yet.";
            }

            string seen = d.Witness.Length > 0 && d.Firsthand ? $" {d.Witness} saw it." : "";
            return $"There's {Thing(d)} {Where(hearth, d)}.{seen}";
        }

        private static string MeatWhere(VillageHearth hearth)
        {
            Knowledge.Discovery d = Knowledge.MeatGround(hearth);
            if (d == null)
            {
                return "Nobody's found good hunting ground yet.";
            }

            string when = d.When == "night" ? "at night" : d.When == "day" ? "by day" : "most hours";
            return $"There's {Thing(d)} to be had {when} {Where(hearth, d)}.";
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

        // Kind:key to (what it is, in a few words; what it is called short).
        private static readonly Dictionary<string, (string Thing, string Short)> Things = new Dictionary<string, (string, string)>
        {
            ["boss:eikthyr"] = ("a great antlered stag with lightning in its horns", "the great stag"),
            ["boss:elder"] = ("the Elder's stones, where an old tree-giant waits", "the Elder"),
            ["boss:bonemass"] = ("an altar in the swamp, where a heap of bones and muck is said to breathe", "Bonemass"),
            ["boss:moder"] = ("an altar high in the mountains, where the dragon mother comes down", "Moder"),
            ["boss:yagluth"] = ("a ring of burnt stones on the plains, where the fulings' old king lies", "Yagluth"),
            ["boss:queen"] = ("a sealed dvergr gate in the mist, and something big behind it", "the Queen"),
            ["boss:fader"] = ("a great ring in the burning lands, where the fire beast waits", "Fader"),
            ["dungeon:burial"] = ("a burial chamber with a heavy stone door", "the burial chamber"),
            ["dungeon:sunkencrypt"] = ("a sunken crypt, half under the swamp water", "the sunken crypt"),
            ["dungeon:trollcave"] = ("a troll cave", "the troll cave"),
            ["dungeon:frostcave"] = ("a frost cave in the mountain", "the frost cave"),
            ["dungeon:infestedmine"] = ("an old dvergr mine under the mist, crawling with something", "the mine"),
            ["trader:haldor"] = ("a trader's camp, a big man with a bigger pack", "the trader"),
            ["trader:hildir"] = ("a woman's camp with tents and far too many hats", "Hildir"),
            ["trader:bogwitch"] = ("a hut in the swamp where an old woman brews things", "the bog witch"),
            ["runestone:runestone"] = ("a runestone with old writing on it", "the runestone"),
            ["landmark:stones"] = ("the old standing stones where it all began", "the stones"),
            ["landmark:tarpit"] = ("a black tar pit", "the tar pit"),
            ["landmark:tower"] = ("an old stone tower", "the tower"),
            ["landmark:giant"] = ("the bones of a giant, bigger than a longhouse", "the giant's bones"),
            ["landmark:henge"] = ("a ring of standing stones", "the ring of stones"),
            ["landmark:dolmen"] = ("a dolmen, old stones stacked like a table", "the dolmen"),
            ["landmark:wreck"] = ("a shipwreck on the beach", "the wreck"),
            ["landmark:well"] = ("an old well", "the well"),
            ["landmark:cairn"] = ("a waymarker cairn", "the cairn"),
            ["landmark:drakenest"] = ("a drake's nest in the rocks", "the drake nest"),
            ["landmark:greydwarfcamp"] = ("a greydwarf camp", "the greydwarf camp"),
            ["fuling:fulingvillage"] = ("a fuling village, all fences and fires", "the fuling village"),
            ["dvergr:dvergr"] = ("a dvergr outpost, little folk with lanterns", "the dvergr"),
            ["ruin:swampruin"] = ("old stone ruins sinking in the swamp", "the swamp ruins"),
            ["ruin:swamphut"] = ("a rotten hut on stilts", "the old hut"),
            ["ruin:cabin"] = ("an abandoned log cabin", "the cabin"),
            ["ruin:house"] = ("the ruins of an old house", "the old house"),
            ["ruin:farm"] = ("an old farm gone to weeds", "the old farm"),
            ["ruin:village"] = ("the ruins of a village, older than ours", "the old village"),
            ["ruin:stonehouse"] = ("an old stone house with no roof", "the stone house"),
            ["ruin:stoneruin"] = ("old stone ruins", "the ruins"),
            ["ore:copper"] = ("copper in the rocks", "the copper"),
            ["ore:tin"] = ("tin by the water", "the tin"),
            ["ore:silver"] = ("a silver vein", "the silver"),
            ["ore:obsidian"] = ("obsidian, black glass in the rock", "the obsidian"),
            ["ore:iron"] = ("muddy scrap piles with old iron in them", "the scrap piles"),
            ["ore:flametal"] = ("a fallen star, still hot", "the fallen star"),
            ["nest:greydwarfnest"] = ("a greydwarf nest", "the nest"),
            ["nest:draugrpile"] = ("a draugr bone pile", "the bone pile"),
            ["nest:bonepile"] = ("a bone pile that throws up skeletons", "the bone pile"),
            ["forage:raspberries"] = ("raspberry bushes", "the raspberries"),
            ["forage:blueberries"] = ("blueberry bushes", "the blueberries"),
            ["forage:cloudberries"] = ("cloudberries", "the cloudberries"),
            ["forage:beehive"] = ("a wild beehive", "the beehive"),
            ["game:boar"] = ("boar", "the boar"), ["game:deer"] = ("deer", "the deer"), ["game:neck"] = ("necks", "the necks"),
            ["game:hare"] = ("hares", "the hares"), ["game:lox"] = ("lox", "the lox"),
            ["foe:greyling"] = ("greylings", "the greylings"), ["foe:greydwarf"] = ("greydwarfs", "the greydwarfs"),
            ["foe:brute"] = ("greydwarf brutes", "the brutes"), ["foe:shaman"] = ("greydwarf shamans", "the shamans"),
            ["foe:troll"] = ("trolls", "the trolls"), ["foe:skeleton"] = ("skeletons", "the skeletons"),
            ["foe:ghost"] = ("ghosts", "the ghosts"), ["foe:wolf"] = ("wolves", "the wolves"), ["foe:drake"] = ("drakes", "the drakes"),
            ["foe:fenring"] = ("fenrings", "the fenrings"), ["foe:fuling"] = ("fulings", "the fulings"),
            ["foe:deathsquito"] = ("deathsquitos", "the deathsquitos"), ["foe:blob"] = ("blobs", "the blobs"),
            ["foe:draugr"] = ("draugr", "the draugr"), ["foe:leech"] = ("leeches", "the leeches"), ["foe:wraith"] = ("wraiths", "the wraiths"),
            ["foe:surtling"] = ("surtlings", "the surtlings"), ["foe:abomination"] = ("abominations", "the abominations"),
            ["foe:golem"] = ("stone golems", "the golems"), ["foe:seeker"] = ("seekers", "the seekers"), ["foe:tick"] = ("ticks", "the ticks"),
            ["foe:bat"] = ("bats", "the bats"), ["foe:ulv"] = ("ulvs", "the ulvs"), ["foe:bear"] = ("bears", "the bears"),
            ["foe:serpent"] = ("sea serpents", "the serpents"),
            ["biome:meadows"] = ("open meadow", "the meadow"), ["biome:blackforest"] = ("the dark forest", "the forest"),
            ["biome:swamp"] = ("the swamp", "the swamp"), ["biome:mountain"] = ("the mountains", "the mountains"),
            ["biome:plains"] = ("the plains", "the plains"), ["biome:ocean"] = ("the sea", "the sea"),
            ["biome:mistlands"] = ("the mist", "the mist"), ["biome:ashlands"] = ("the burning lands", "the burning lands"),
            ["biome:deepnorth"] = ("the frozen north", "the frozen north"),
        };

        public static string Thing(Knowledge.Discovery d) =>
            Things.TryGetValue(d.Kind + ":" + d.Key, out var t) ? t.Thing : d.Key;

        public static string Short(Knowledge.Discovery d) =>
            Things.TryGetValue(d.Kind + ":" + d.Key, out var t) ? t.Short : d.Key;

        // ---------------------------------------------------------------- 'vh know rumours'

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
                    said = Dialogue.LineFor(speaker, "talk", "rumour:" + d.Kind + ":" + d.Key) ??
                           Dialogue.LineFor(speaker, "talk", "rumour:" + d.Kind) ??
                           Dialogue.LineFor(speaker, "talk", "rumour") ?? "(no line fits)";
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
