using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// What villagers say, from the line library in <c>Dialogue/*.txt</c> (built into the logic DLL).
    ///
    /// Every villager has a voice (steady, gruff, cheerful, worrier, wry, elder, young or devout), fixed by his seed.
    /// Each section of the library has conditions on the moment and optionally the voices it is for. When a villager
    /// speaks, the tags that describe the moment are worked out (what he is doing, how hurt he is, what the village
    /// needs, the time, the weather, his trade and role...), every section whose conditions all hold and whose voice
    /// fits is a candidate, and one line is picked, sections with more conditions weighing more. A line is not
    /// repeated by the same villager until he has said a few others. See the top of <c>Dialogue/lines.txt</c> for the
    /// format and the tags.
    ///
    /// Three channels: <c>talk</c> (a player talks to him), <c>self</c> (now and then, with a player close by) and
    /// <c>chat</c> (two villagers talking in their free time; a line written "first // reply" is a little exchange).
    /// Sections without a channel tag are used for talk and self.
    /// </summary>
    internal static class Dialogue
    {
        public static readonly string[] Voices = { "steady", "gruff", "cheerful", "worrier", "wry", "elder", "young", "devout" };

        private static readonly string[] Channels = { "talk", "self", "chat", "greet", "bye" };

        private sealed class Section
        {
            public string[] All;
            public string[] None;
            public HashSet<string> VoiceSet;
            public string Channel;
            public float Weight;
            public readonly List<string> Lines = new List<string>();
        }

        private sealed class Memory
        {
            public float NextSelf;
            public readonly Queue<string> Recent = new Queue<string>();
        }

        private const float SelfTalkRange = 14f;

        private static List<Section> _sections;
        private static readonly Dictionary<(int, string), float> Events = new Dictionary<(int, string), float>();

        /// <summary>Something happened in the village (finished, arrival...): "event:x" holds for ten minutes.</summary>
        public static void Note(int villageId, string what)
        {
            Events[(villageId, what)] = Time.time;
        }
        private static readonly ConditionalWeakTable<Villager, Memory> Memories = new ConditionalWeakTable<Villager, Memory>();

        public static string VoiceOf(Villager villager)
        {
            int seed = villager.Zdo != null ? villager.Zdo.GetInt(Keys.VillagerSeed) : 1;
            return Voices[(int)((uint)(seed * 2654435761u) >> 8) % Voices.Length];
        }

        // ---------------------------------------------------------------- speaking

        /// <summary>A line for this villager on this channel, or null when nothing fits.</summary>
        public static string LineFor(Villager villager, string channel, string reply = null)
        {
            HashSet<string> tags = Tags(villager, channel);
            string voice = VoiceOf(villager);
            Memory memory = Memories.GetOrCreateValue(villager);

            var options = new List<(Section Section, float Weight)>();
            foreach (Section section in Library())
            {
                if (!Fits(section, channel, tags, voice))
                {
                    continue;
                }

                options.Add((section, section.Weight));
            }

            if (options.Count == 0)
            {
                return null;
            }

            for (int attempt = 0; attempt < 6; attempt++)
            {
                Section picked = Pick(options);
                string line = picked.Lines[Random.Range(0, picked.Lines.Count)];
                if (memory.Recent.Contains(line) && attempt < 5)
                {
                    continue;
                }

                memory.Recent.Enqueue(line);
                while (memory.Recent.Count > 12)
                {
                    memory.Recent.Dequeue();
                }

                return Fill(line, villager);
            }

            return null;
        }

        /// <summary>Now and then, with a player close by, a villager says something about what is going on.</summary>
        public static void Tick(Villager villager)
        {
            if (!VillheimConfig.VillagerChatter.Value || Sleep.IsAsleep(villager) || Player.m_localPlayer == null ||
                global::Chat.instance == null)
            {
                return;
            }

            Memory memory = Memories.GetOrCreateValue(villager);
            if (Time.time < memory.NextSelf)
            {
                return;
            }

            memory.NextSelf = Time.time + Random.Range(40f, 100f);
            if (Vector3.Distance(Player.m_localPlayer.transform.position, villager.transform.position) > SelfTalkRange ||
                Random.value > 0.5f)
            {
                return;
            }

            Say(villager, LineFor(villager, "self"));
        }

        public static void Say(Villager villager, string line, float seconds = 5f)
        {
            if (string.IsNullOrEmpty(line) || global::Chat.instance == null)
            {
                return;
            }

            global::Chat.instance.SetNpcText(villager.gameObject, Vector3.up * 2.2f, 20f, seconds, "", line, false);
        }

        /// <summary>Every line of a channel that has no conditions, for the game's own NpcTalk greetings.</summary>
        public static List<string> Plain(string channel)
        {
            return Library().Where(s => s.Channel == channel && s.All.Length == 0 && s.VoiceSet == null)
                .SelectMany(s => s.Lines).ToList();
        }

        private static bool Fits(Section section, string channel, HashSet<string> tags, string voice)
        {
            if (section.Channel != null ? section.Channel != channel : channel != "talk" && channel != "self")
            {
                return false;
            }

            if (section.VoiceSet != null && !section.VoiceSet.Contains(voice))
            {
                return false;
            }

            foreach (string tag in section.All)
            {
                if (!tags.Contains(tag))
                {
                    return false;
                }
            }

            foreach (string tag in section.None)
            {
                if (tags.Contains(tag))
                {
                    return false;
                }
            }

            return true;
        }

        private static Section Pick(List<(Section Section, float Weight)> options)
        {
            float roll = Random.value * options.Sum(o => o.Weight);
            foreach ((Section section, float weight) in options)
            {
                roll -= weight;
                if (roll <= 0f)
                {
                    return section;
                }
            }

            return options[options.Count - 1].Section;
        }

        // ---------------------------------------------------------------- the moment

        /// <summary>Tags describing this villager and his village right now.</summary>
        private static HashSet<string> Tags(Villager villager, string channel)
        {
            var tags = new HashSet<string> { channel };
            string doing = (Sleep.IsAsleep(villager) ? "asleep" : null) ?? Healing.Describe(villager) ?? Chores.Describe(villager) ??
                           Hunting.Describe(villager) ?? Repairs.Describe(villager) ??
                           (PathLaying.IsLaying(villager) ? "laying a path" : null) ?? FreeTime.Describe(villager) ?? "idle";
            foreach (string activity in Activities(doing))
            {
                tags.Add("doing:" + activity);
            }

            float health = villager.GetHealth() / Mathf.Max(1f, villager.GetMaxHealth());
            tags.Add(health < 0.5f ? "badlyhurt" : health < 0.95f ? "hurt" : "healthy");
            if (health < 0.95f) tags.Add("anyhurt");
            tags.Add(Healing.FoodCount(villager) > 0 ? "fed" : "unfed");

            Roles.Trade trade = Roles.TradeOf(villager);
            tags.Add("trade:" + trade.ToString().ToLowerInvariant());
            tags.Add(Roles.BackgroundOf(villager) == Roles.Background.Protector ? "protector" : "carer");

            float hour = EnvMan.instance != null ? EnvMan.instance.GetDayFraction() * 24f : 12f;
            tags.Add(hour >= 5f && hour < 9f ? "morning" : hour < 17f && hour >= 9f ? "day" : hour >= 17f && hour < 22f ? "evening" : "night");
            if (EnvMan.IsWet()) tags.Add("rain");
            if (EnvMan.IsCold()) tags.Add("cold");
            if (EnvMan.IsFreezing()) tags.Add("freezing");

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid)
            {
                return tags;
            }

            var state = new VillageState(hearth.Zdo);
            int plots = state.Plots.Count;
            tags.Add(plots <= 1 ? "size:camp" : plots <= 3 ? "size:hamlet" : plots <= 6 ? "size:village" : "size:town");
            int villagers = VillageBrain.CountVillagers(state.Id);
            if (villagers <= 2) tags.Add("few");
            if (villagers >= 6) tags.Add("many");
            tags.Add(state.Biome == Heightmap.Biome.BlackForest ? "biome:blackforest" : "biome:meadows");

            VillageNeeds needs = VillageNeeds.For(villager.VillageId);
            if (needs != null && needs.Missing.Count > 0)
            {
                tags.Add("need:any");
                foreach (string material in needs.Missing.Keys)
                {
                    tags.Add("need:" + Materials.Label(material).Replace(" ", "").ToLowerInvariant());
                }
            }
            else
            {
                tags.Add("need:none");
            }

            ConstructionSite.Site site = ConstructionSite.Get(hearth.Zdo);
            if (site != null)
            {
                tags.Add("building:any");
                tags.Add("building:" + VillageBrain.RoleName(site.Role).Replace(" ", ""));
            }

            if (Beds.Free(hearth) > 0) tags.Add("freebed");
            if (Beds.For(villager) == null) tags.Add("nobed");

            float mood = VillageMood.Get(state.Id);
            tags.Add(mood >= 65f ? "mood:high" : mood < 35f ? "mood:low" : "mood:fair");
            if (VillageMood.SecondsSinceThreat(state.Id) < 240f) tags.Add("afterfight");

            foreach (KeyValuePair<(int, string), float> happened in Events)
            {
                if (happened.Key.Item1 == state.Id && Time.time - happened.Value < 600f)
                {
                    tags.Add("event:" + happened.Key.Item2);
                }
            }

            bool? food = Healing.ChestFood(hearth);
            tags.Add(food == true ? "food:cooked" : food == false ? "food:raw" : "food:none");
            return tags;
        }

        /// <summary>Activity words from the hover description.</summary>
        private static IEnumerable<string> Activities(string doing)
        {
            string d = doing.ToLowerInvariant();
            if (d.Contains("hunting") || d.Contains("butchering") || d.Contains("meat to")) yield return "hunting";
            if (d.Contains("repairing") || d.Contains("putting back")) yield return "repairing";
            if (d.Contains("felling")) yield return "felling";
            if (d.Contains("splitting")) yield return "splitting";
            if (d.Contains("rock")) yield return "mining";
            if (d == "building" || d.Contains("rebuilding")) yield return "building";
            if (d.Contains("carrying")) yield return "carrying";
            if (d.Contains("gathering") || d.Contains("picking")) yield return "gathering";
            if (d.Contains("cook")) yield return "cooking";
            if (d.Contains("fetching")) yield return "fetching";
            if (d.Contains("roasting")) yield return "roasting";
            if (d.Contains("watch")) yield return "watch";
            if (d.Contains("path")) yield return "path";
            if (d.Contains("making")) yield return "making";
            if (d.Contains("sitting") || d.Contains("fire")) yield return "fire";
            if (d.Contains("stroll")) yield return "stroll";
            if (d.Contains("chat") || d.Contains("talking")) yield return "chatting";
            if (d.Contains("busy at")) yield return "station";
            if (d.Contains("heading out")) yield return "heading";
            if (d == "idle" || d.Contains("resting")) yield return "idle";
            if (d.Contains("asleep")) yield return "asleep";
        }

        private static string Fill(string line, Villager villager)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            string village = "the village";
            string material = "wood";
            string building = "next house";
            if (hearth != null && hearth.IsValid)
            {
                var state = new VillageState(hearth.Zdo);
                village = state.Name;
                VillageNeeds needs = VillageNeeds.For(villager.VillageId);
                if (needs != null && needs.Missing.Count > 0)
                {
                    material = Materials.Label(needs.Missing.OrderByDescending(n => n.Value).First().Key);
                }

                ConstructionSite.Site site = ConstructionSite.Get(hearth.Zdo);
                if (site != null)
                {
                    building = VillageBrain.RoleName(site.Role);
                }
            }

            string player = Player.m_localPlayer != null ? Player.m_localPlayer.GetPlayerName() : "friend";
            string other = OtherVillager(villager);
            return line.Replace("{village}", village)
                .Replace("{material}", material)
                .Replace("{building}", building)
                .Replace("{name}", villager.VillagerName)
                .Replace("{player}", player)
                .Replace("{other}", other);
        }

        private static string OtherVillager(Villager villager)
        {
            Villager best = null;
            float bestDistance = float.MaxValue;
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character is Villager other && other != villager && other.VillageId == villager.VillageId && !other.IsDead())
                {
                    float distance = Vector3.Distance(other.transform.position, villager.transform.position);
                    if (distance < bestDistance)
                    {
                        best = other;
                        bestDistance = distance;
                    }
                }
            }

            return best != null ? best.VillagerName : "the others";
        }

        // ---------------------------------------------------------------- the library

        private static List<Section> Library()
        {
            if (_sections != null)
            {
                return _sections;
            }

            _sections = new List<Section>();
            var assembly = typeof(Dialogue).Assembly;
            foreach (string resource in assembly.GetManifestResourceNames().Where(n => n.StartsWith("Villheim.Logic.Dialogue.")))
            {
                using (Stream stream = assembly.GetManifestResourceStream(resource))
                using (var reader = new StreamReader(stream))
                {
                    Parse(reader.ReadToEnd(), resource);
                }
            }

            VillheimPlugin.Log.LogInfo($"Dialogue: {_sections.Count} sections, {_sections.Sum(s => s.Lines.Count)} lines.");
            return _sections;
        }

        /// <summary>
        /// "@ tag, tag, !tag | voice/voice * weight" starts a section; every other non-empty line that doesn't start
        /// with # is a line of it.
        /// </summary>
        private static void Parse(string text, string source)
        {
            Section current = null;
            int number = 0;
            foreach (string raw in text.Split('\n'))
            {
                number++;
                string line = raw.Trim();
                if (line.Length == 0 || line.StartsWith("#"))
                {
                    continue;
                }

                if (!line.StartsWith("@"))
                {
                    current?.Lines.Add(line);
                    continue;
                }

                string head = line.Substring(1);
                float weight = 1f;
                int star = head.IndexOf('*');
                if (star >= 0)
                {
                    float.TryParse(head.Substring(star + 1).Trim(), System.Globalization.NumberStyles.Float,
                        System.Globalization.CultureInfo.InvariantCulture, out weight);
                    head = head.Substring(0, star);
                }

                HashSet<string> voices = null;
                int bar = head.IndexOf('|');
                if (bar >= 0)
                {
                    voices = new HashSet<string>(head.Substring(bar + 1).Split('/').Select(v => v.Trim().ToLowerInvariant())
                        .Where(v => v.Length > 0));
                    head = head.Substring(0, bar);
                }

                List<string> conditions = head.Split(',').Select(t => t.Trim().ToLowerInvariant()).Where(t => t.Length > 0).ToList();
                string channel = conditions.FirstOrDefault(c => Channels.Contains(c));
                conditions.Remove(channel);
                if (voices != null && voices.Any(v => !Voices.Contains(v)))
                {
                    VillheimPlugin.Log.LogWarning($"{source} line {number}: unknown voice in '{line}'.");
                }

                current = new Section
                {
                    All = conditions.Where(c => !c.StartsWith("!")).ToArray(),
                    None = conditions.Where(c => c.StartsWith("!")).Select(c => c.Substring(1)).ToArray(),
                    VoiceSet = voices,
                    Channel = channel,
                };

                int specific = current.All.Length + current.None.Length + (voices != null ? 1 : 0);
                current.Weight = (weight > 0f ? weight : 1f) * (1f + specific * 0.6f);
                _sections.Add(current);
            }

            _sections.RemoveAll(s => s.Lines.Count == 0);
        }
    }
}
