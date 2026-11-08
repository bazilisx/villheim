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

        private static readonly string[] Channels = { "talk", "self", "chat", "greet", "bye", "reply" };

        private sealed class Section
        {
            public string[] All;
            public string[] None;
            public HashSet<string> VoiceSet;
            public string Channel;
            public string Tone;
            public float Weight;
            public readonly List<string> Lines = new List<string>();
        }

        private sealed class Memory
        {
            public float NextSelf;
            public string LastTone;
            public readonly Queue<string> Recent = new Queue<string>();
        }

        private const float SelfTalkRange = 14f;

        private static List<Section> _sections;
        private static readonly Dictionary<(int, string), float> Events = new Dictionary<(int, string), float>();

        private static readonly string[] VillageMoodEvents = { "finished", "arrival", "hunt", "trade", "birth" };
        private static readonly string[] Reacted = { "finished", "arrival", "groundbroken", "hunt", "death", "birth", "pedlar", "pilgrim", "blessing" };

        /// <summary>
        /// Something happened in the village (finished, arrival...): "event:x" holds for ten minutes, everyone's mood
        /// takes note, and a building milestone, newcomer or hunt gets a reaction from a couple of villagers.
        /// </summary>
        public static void Note(int villageId, string what)
        {
            Events[(villageId, what)] = Time.time;
            Personality.VillageRemembers(villageId, what);
            WorldLife.NoteNews(villageId, what);
            if (VillageMoodEvents.Contains(what))
            {
                Moods.VillageThink(villageId, what);
            }

            if (Reacted.Contains(what))
            {
                Event(villageId, what, Vector3.zero);
            }
        }

        // ---------------------------------------------------------------- cadence

        /// <summary>When the village may next say something unprompted (any villager), by village.</summary>
        private static readonly Dictionary<int, float> NextAmbient = new Dictionary<int, float>();

        /// <summary>Lines said in the village in the last minute, so two villagers never say the same thing together.</summary>
        private static readonly Dictionary<int, List<(string Line, float Time)>> RecentInVillage = new Dictionary<int, List<(string, float)>>();

        private sealed class Reaction
        {
            public Villager Who;
            public string Tag;
            public float At;
            public string Channel = "self";
            public string[] Extra;
        }

        /// <summary>
        /// A line said a moment from now, outside the quiet time: an answer to something overheard or to a player's
        /// gesture. <paramref name="extra"/> adds tags for that moment (tone:joke, emote:wave...), and a section must
        /// carry <paramref name="required"/>.
        /// </summary>
        public static void QueueLine(Villager villager, string channel, string required, string[] extra, float delay)
        {
            if (!VillheimConfig.VillagerChatter.Value || Reactions.Any(r => r.Who == villager))
            {
                return;
            }

            Reactions.Add(new Reaction { Who = villager, Tag = required, At = Time.time + delay, Channel = channel, Extra = extra });
        }

        /// <summary>Whether the village has room for one more unprompted line now (and uses it if so).</summary>
        public static bool TakeTurn(int villageId, float min = 30f, float max = 60f)
        {
            if (!AmbientOpen(villageId))
            {
                return false;
            }

            UseAmbient(villageId, min, max);
            return true;
        }

        private static readonly List<Reaction> Reactions = new List<Reaction>();
        private static readonly Dictionary<(int, string), float> LastEvent = new Dictionary<(int, string), float>();

        private static bool AmbientOpen(int villageId) => !NextAmbient.TryGetValue(villageId, out float next) || Time.time >= next;

        private static void UseAmbient(int villageId, float min = 30f, float max = 60f)
        {
            NextAmbient[villageId] = Time.time + Random.Range(min, max);
        }

        /// <summary>
        /// A village event (a building finished, a newcomer, an attack, the fight over, a hunt): up to two villagers,
        /// now and then three, near the player react, a few seconds apart, each with a different line. Only once per
        /// event per village per minute, however many villagers notice it.
        /// </summary>
        public static bool Event(int villageId, string kind, Vector3 where)
        {
            Events[(villageId, kind)] = Time.time;
            if (kind == "fightover")
            {
                Personality.VillageRemembers(villageId, "fight");
                WorldLife.NoteNews(villageId, kind);
            }

            if (LastEvent.TryGetValue((villageId, kind), out float last) && Time.time - last < 60f)
            {
                return false;
            }

            LastEvent[(villageId, kind)] = Time.time;
            Player player = Player.m_localPlayer;
            if (player == null || !VillheimConfig.VillagerChatter.Value)
            {
                return true;
            }

            List<Villager> near = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => !v.IsDead() && v.VillageId == villageId && !Sleep.IsAsleep(v) &&
                            Vector3.Distance(v.transform.position, player.transform.position) < 30f)
                .OrderBy(_ => Random.value).ToList();
            int speakers = Mathf.Min(near.Count, Random.value < 0.3f ? 3 : 2);
            float at = Time.time + Random.Range(1f, 2.5f);
            for (int i = 0; i < speakers; i++)
            {
                Reactions.Add(new Reaction { Who = near[i], Tag = "event:" + kind, At = at });
                at += Random.Range(3f, 6f);
            }

            UseAmbient(villageId, 40f, 70f);
            return true;
        }

        private static bool RecentlySaid(int villageId, string line)
        {
            if (!RecentInVillage.TryGetValue(villageId, out var list))
            {
                return false;
            }

            list.RemoveAll(e => Time.time - e.Time > 60f);
            return list.Any(e => e.Line == line);
        }

        private static void Remember(int villageId, string line)
        {
            if (!RecentInVillage.TryGetValue(villageId, out var list))
            {
                list = new List<(string, float)>();
                RecentInVillage[villageId] = list;
            }

            list.Add((line, Time.time));
        }

        /// <summary>
        /// The opening line of a chat between two villagers, if the village isn't already talking (the same budget as
        /// talking to oneself). Null means: just gesture for now.
        /// </summary>
        public static string ChatOpening(Villager villager)
        {
            if (!AmbientOpen(villager.VillageId) || !VillheimConfig.VillagerChatter.Value)
            {
                return null;
            }

            string line = LineFor(villager, "chat");
            if (line != null)
            {
                UseAmbient(villager.VillageId);
            }

            return line;
        }
        private static readonly ConditionalWeakTable<Villager, Memory> Memories = new ConditionalWeakTable<Villager, Memory>();

        public static string VoiceOf(Villager villager)
        {
            if (Childhood.IsChild(villager))
            {
                return "young";
            }

            int seed = villager.Zdo != null ? villager.Zdo.GetInt(Keys.VillagerSeed) : 1;
            return Voices[(int)((uint)(seed * 2654435761u) >> 8) % Voices.Length];
        }

        // ---------------------------------------------------------------- speaking

        /// <summary>A line for this villager on this channel, or null when nothing fits.</summary>
        public static string LineFor(Villager villager, string channel, string required = null, string[] extra = null)
        {
            HashSet<string> tags = Tags(villager, channel);
            if (extra != null)
            {
                tags.UnionWith(extra);
            }
            string voice = VoiceOf(villager);
            Memory memory = Memories.GetOrCreateValue(villager);

            var options = new List<(Section Section, float Weight)>();
            foreach (Section section in Library())
            {
                if (!Fits(section, channel, tags, voice) || (required != null && !section.All.Contains(required)))
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
                if ((memory.Recent.Contains(line) || RecentlySaid(villager.VillageId, line)) && attempt < 5)
                {
                    continue;
                }

                Remember(villager.VillageId, line);
                memory.LastTone = picked.Tone ?? ToneOf(VoiceOf(villager));

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
            Personality.Sample(villager);
            if (!VillheimConfig.VillagerChatter.Value || Sleep.IsAsleep(villager) || Player.m_localPlayer == null ||
                global::Chat.instance == null)
            {
                return;
            }

            // Reactions to an event come first and ignore the quiet time.
            for (int i = Reactions.Count - 1; i >= 0; i--)
            {
                Reaction reaction = Reactions[i];
                if (reaction.Who == null || reaction.Who.IsDead() || Time.time - reaction.At > 30f)
                {
                    Reactions.RemoveAt(i);
                }
                else if (reaction.Who == villager && Time.time >= reaction.At)
                {
                    Reactions.RemoveAt(i);
                    string said = LineFor(villager, reaction.Channel, reaction.Tag, reaction.Extra) ??
                                  (reaction.Channel == "self" ? LineFor(villager, "self") : null);
                    Say(villager, said);
                    Memories.GetOrCreateValue(villager).NextSelf = Time.time + Random.Range(120f, 240f);
                    return;
                }
            }

            // Talk on their own now and then: each villager every two to four minutes at most, and the village as a
            // whole about once every half minute to a minute, so it stays a background murmur.
            Memory memory = Memories.GetOrCreateValue(villager);
            if (Time.time < memory.NextSelf || !AmbientOpen(villager.VillageId))
            {
                return;
            }

            memory.NextSelf = Time.time + Random.Range(120f, 240f);
            if (Vector3.Distance(Player.m_localPlayer.transform.position, villager.transform.position) > SelfTalkRange ||
                Random.value > 0.6f)
            {
                return;
            }

            string line = LineFor(villager, "self");
            if (line != null)
            {
                UseAmbient(villager.VillageId);
                Say(villager, line);
            }
        }

        public static void Say(Villager villager, string line, float seconds = 5f)
        {
            if (string.IsNullOrEmpty(line) || global::Chat.instance == null)
            {
                return;
            }

            global::Chat.instance.SetNpcText(villager.gameObject, Vector3.up * 2.2f, 20f, seconds, "", line, false);
            Memory memory = Memories.GetOrCreateValue(villager);
            string tone = memory.LastTone;
            memory.LastTone = null;
            if (Random.value < 0.3f && !Sleep.IsAsleep(villager))
            {
                // The speaker's own hands: a point, a laugh, a shrug, as the line goes.
                string gesture = tone == "joke" ? "laugh" : tone == "point" ? "point" : tone == "worry" ? "nonono" :
                    tone == "angry" ? "shrug" : tone == "proud" ? "flex" : tone == "happy" ? "cheer" : tone == "pious" ? "bow" : null;
                if (gesture != null)
                {
                    Poses.Gesture(villager, gesture);
                }
            }

            Social.Heard(villager, tone);
        }

        /// <summary>The tone listeners hear in a line with no ~tone of its own, from the speaker's voice.</summary>
        private static string ToneOf(string voice)
        {
            switch (voice)
            {
                case "wry": return "joke";
                case "cheerful": return "happy";
                case "worrier": return "worry";
                case "gruff": return "angry";
                case "devout": return "pious";
                case "young": return Random.value < 0.5f ? "happy" : "joke";
                default: return null;
            }
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
            string wanderer = Wanderers.KindOf(villager);
            if (wanderer != null)
            {
                return WandererTags(villager, channel, wanderer);
            }

            string doing = (Sleep.IsAsleep(villager) ? "asleep" : null) ?? (MorningHearth.IsTending(villager) ? "tending the hearth" : null) ?? Healing.Describe(villager) ?? Chores.Describe(villager) ??
                           Hunting.Describe(villager) ?? Farming.Describe(villager) ?? Foraging.Describe(villager) ??
                           Repairs.Describe(villager) ??
                           (PathLaying.IsLaying(villager) ? "laying a path" : null) ?? FreeTime.Describe(villager) ?? "idle";
            foreach (string activity in Activities(doing))
            {
                tags.Add("doing:" + activity);
            }

            float health = villager.GetHealth() / Mathf.Max(1f, villager.GetMaxHealth());
            tags.Add(health < 0.5f ? "badlyhurt" : health < 0.95f ? "hurt" : "healthy");
            if (health < 0.95f) tags.Add("anyhurt");
            tags.Add(Healing.FoodCount(villager) > 0 ? "fed" : "unfed");

            foreach (string feeling in Moods.Tags(villager))
            {
                tags.Add(feeling);
            }

            tags.Add("voice:" + VoiceOf(villager));
            Roles.Trade trade = Roles.TradeOf(villager);
            tags.Add("trade:" + trade.ToString().ToLowerInvariant());
            tags.Add(Roles.BackgroundOf(villager) == Roles.Background.Protector ? "protector" : "carer");

            float hour = EnvMan.instance != null ? EnvMan.instance.GetDayFraction() * 24f : 12f;
            tags.Add(hour >= 5f && hour < 9f ? "morning" : hour < 17f && hour >= 9f ? "day" : hour >= 17f && hour < 22f ? "evening" : "night");
            if (EnvMan.IsWet()) tags.Add("rain");
            if (EnvMan.IsCold()) tags.Add("cold");
            if (EnvMan.IsFreezing()) tags.Add("freezing");
            if (EnvMan.instance != null && EnvMan.instance.GetWindIntensity() > 0.6f) tags.Add("windy");

            foreach (string own in Personality.Tags(villager))
            {
                tags.Add(own);
            }

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
            tags.Add("village:" + state.Type);
            if (Roles.IsJarl(villager)) tags.Add("jarl");
            if (Childhood.IsChild(villager)) tags.Add("child");

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

            (string Name, int View)? neighbour = Relations.Nearest(hearth);
            if (neighbour != null)
            {
                tags.Add("neighbour:" + Relations.Band(neighbour.Value.View));
            }

            foreach (string social in Social.Tags(hearth))
            {
                tags.Add(social);
            }

            bool? food = Healing.ChestFood(hearth);
            tags.Add(food == true ? "food:cooked" : food == false ? "food:raw" : "food:none");
            return tags;
        }

        /// <summary>
        /// Tags for a pedlar, pilgrim or hermit: "wanderer", the kind, the time and weather, the biome, whether a
        /// village is near and the phase of the visit. Only sections that require "wanderer" are used for them.
        /// </summary>
        private static HashSet<string> WandererTags(Villager villager, string channel, string kind)
        {
            var tags = new HashSet<string> { channel, "wanderer", kind, "voice:" + VoiceOf(villager) };
            float hour = EnvMan.instance != null ? EnvMan.instance.GetDayFraction() * 24f : 12f;
            tags.Add(hour >= 5f && hour < 9f ? "morning" : hour < 17f && hour >= 9f ? "day" : hour >= 17f && hour < 22f ? "evening" : "night");
            if (EnvMan.IsWet()) tags.Add("rain");
            if (EnvMan.IsCold()) tags.Add("cold");
            if (EnvMan.IsFreezing()) tags.Add("freezing");
            Heightmap.Biome biome = WorldGenerator.instance != null ? WorldGenerator.instance.GetBiome(villager.transform.position) : Heightmap.Biome.Meadows;
            tags.Add("biome:" + biome.ToString().ToLowerInvariant());
            tags.Add("phase:" + (villager.Zdo?.GetString(Wanderers.KeyPhase, "") ?? ""));
            if (WorldLife.VisitorNews(villager) != null) tags.Add("news");
            if (VillageHearth.Closest(villager.transform.position, 60f) != null) tags.Add("invillage");
            float health = villager.GetHealth() / Mathf.Max(1f, villager.GetMaxHealth());
            tags.Add(health < 0.5f ? "badlyhurt" : health < 0.95f ? "hurt" : "healthy");
            return tags;
        }

        /// <summary>The first activity word for a hover description ("felling", "cooking"...), or null.</summary>
        public static string ActivityWord(string doing) => Activities(doing).FirstOrDefault();

        /// <summary>Activity words from the hover description.</summary>
        private static IEnumerable<string> Activities(string doing)
        {
            string d = doing.ToLowerInvariant();
            if (d.Contains("tending the hearth")) yield return "hearth";
            if (d.Contains("foraging") || d.Contains("berries")) yield return "foraging";
            if (d.Contains("farm") || d.Contains("harvest") || d.Contains("animals")) yield return "farming";
            if (d.Contains("hunting") || d.Contains("butchering") || d.Contains("meat to")) yield return "hunting";
            if (d.Contains("fence")) yield return "fencing";
            else if (d.Contains("repairing") || d.Contains("putting back")) yield return "repairing";
            if (d.Contains("felling")) yield return "felling";
            if (d.Contains("splitting")) yield return "splitting";
            if (d.Contains("rock")) yield return "mining";
            if (d == "building" || d.Contains("rebuilding")) yield return "building";
            if (d.Contains("carrying")) yield return "carrying";
            if (d.Contains("gathering") || d.Contains("picking")) yield return "gathering";
            if (d.Contains("cook")) yield return "cooking";
            if (d.Contains("fetching")) yield return "fetching";
            if (d.Contains("roasting")) yield return "roasting";
            if (d.StartsWith("watching")) yield return "watching";
            else if (d.Contains("watch")) yield return "watch";
            if (d.Contains("path")) yield return "path";
            if (d.Contains("making")) yield return "making";
            if (d.Contains("sitting down")) yield return "seat";
            else if (d.Contains("sitting") || d.Contains("fire")) yield return "fire";
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
            string request = hearth != null && hearth.IsValid ? Social.RequestText(hearth) ?? "a little wood" : "a little wood";
            line = line.Replace("{request}", request);
            string other = OtherVillager(villager);
            line = Personality.Fill(line, villager);
            if (line.Contains("{neighbour}"))
            {
                line = line.Replace("{neighbour}", (hearth != null ? Relations.Nearest(hearth)?.Name : null) ?? "the next village");
            }

            line = line.Replace("{village}", village)
                .Replace("{material}", material)
                .Replace("{building}", building)
                .Replace("{name}", villager.VillagerName)
                .Replace("{player}", player)
                .Replace("{other}", other);

            // Fill-ins such as {favfood} or {news} can start a sentence: give it its capital.
            return System.Text.RegularExpressions.Regex.Replace(line, @"(^|[.?!]\s+)([a-z])", m => m.Groups[1].Value + char.ToUpperInvariant(m.Groups[2].Value[0]));
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
                string tone = null;
                int tilde = head.IndexOf('~');
                if (tilde >= 0)
                {
                    int end = head.IndexOfAny(new[] { ' ', '|', '*', ',' }, tilde + 1);
                    tone = (end < 0 ? head.Substring(tilde + 1) : head.Substring(tilde + 1, end - tilde - 1)).Trim().ToLowerInvariant();
                    head = head.Remove(tilde, (end < 0 ? head.Length : end) - tilde);
                }

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
                    Tone = tone,
                };

                int specific = current.All.Length + current.None.Length + (voices != null ? 1 : 0);
                current.Weight = (weight > 0f ? weight : 1f) * (1f + specific * 0.6f);
                _sections.Add(current);
            }

            _sections.RemoveAll(s => s.Lines.Count == 0);
        }
    }
}
