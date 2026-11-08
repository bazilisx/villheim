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
            /// <summary>The place the last line was about (a rumor), for pointing the right way.</summary>
            public Vector3? LastPlace;
            public readonly Queue<string> Recent = new Queue<string>();
        }

        private const float SelfTalkRange = 14f;

        private static List<Section> _sections;
        private static readonly Dictionary<(int, string), float> Events = new Dictionary<(int, string), float>();

        private static readonly string[] VillageMoodEvents = { "finished", "arrival", "hunt", "trade", "birth" };
        private static readonly string[] Reacted = { "finished", "arrival", "groundbroken", "hunt", "death", "birth", "pedlar", "pilgrim", "blessing", "forged", "outpost" };

        /// <summary>
        /// Something happened in the village (finished, arrival...): "event:x" holds for ten minutes, everyone's mood
        /// takes note, and a building milestone, newcomer or hunt gets a reaction from a couple of villagers.
        /// </summary>
        public static void Note(int villageId, string what)
        {
            Events[(villageId, what)] = Time.time;
            Personality.VillageRemembers(villageId, what);
            WorldLife.NoteNews(villageId, what);
            Goals.VillageEvent(villageId, what);
            Gatherings.Noted(villageId, what);
            Village.Living.Noted(villageId, what);
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
        public static string ChatOpening(Villager villager, Villager partner = null, string told = null)
        {
            if (!AmbientOpen(villager.VillageId) || !VillheimConfig.VillagerChatter.Value)
            {
                return null;
            }

            bool scenes = LogicConfig.IsOn(LogicConfig.ChatScenes);
            List<string> extra = partner != null && scenes ? PairTags(villager, partner) : new List<string>();
            if (told != null && scenes)
            {
                extra.Add("tell:" + told);
            }

            string line;
            _partner = partner;
            try
            {
                line = LineFor(villager, "chat", null, extra.ToArray());
            }
            finally
            {
                _partner = null;
            }

            if (line != null)
            {
                UseAmbient(villager.VillageId);
            }

            return line;
        }

        /// <summary>Whether a chat may open now in this villager's village (the same check ChatOpening makes first).</summary>
        public static bool ChatCanOpen(Villager villager) => AmbientOpen(villager.VillageId) && VillheimConfig.VillagerChatter.Value;

        /// <summary>The one being talked to in the line being picked, for {partner}.</summary>
        private static Villager _partner;

        /// <summary>
        /// Tags about the other one in a chat, so a line can fit the pair: with:friend, with:rival, with:sweetheart,
        /// with:courting (the speaker is courting him), with:sametrade, with:trade:x, with:voice:x, with:child,
        /// with:jarl, with:hurt, with:sad, with:happy, with:skilled.
        /// </summary>
        public static List<string> PairTags(Villager speaker, Villager other)
        {
            var tags = new List<string>();
            if (speaker == null || other == null)
            {
                return tags;
            }

            if (Personality.Friend(speaker) == other) tags.Add("with:friend");
            if (Personality.Rival(speaker) == other) tags.Add("with:rival");
            if (Goals.Sweetheart(speaker) == other) tags.Add("with:sweetheart");
            if (Goals.IsCourting(speaker, other)) tags.Add("with:courting");
            Roles.Trade mine = Roles.TradeOf(speaker), theirs = Roles.TradeOf(other);
            tags.Add("with:trade:" + theirs.ToString().ToLowerInvariant());
            if (mine == theirs && mine != Roles.Trade.None) tags.Add("with:sametrade");
            tags.Add("with:voice:" + VoiceOf(other));
            if (Childhood.IsChild(other)) tags.Add("with:child");
            if (Personality.IsNewcomer(other)) tags.Add("with:newcomer");
            if (Roles.IsJarl(other)) tags.Add("with:jarl");
            if (other.GetHealth() < other.GetMaxHealth() * 0.6f) tags.Add("with:hurt");
            float mood = Moods.Get(other);
            if (mood < 35f) tags.Add("with:sad");
            if (mood >= 70f) tags.Add("with:happy");
            if (VillagerSkills.Level(other, VillagerSkills.Best(other)) >= 50f) tags.Add("with:skilled");
            return tags;
        }

        /// <summary>
        /// An answer in a chat: a line from the sections tagged "answer:key" (channel reply), picked with the
        /// answerer's own tags, so the same question gets a worrier's answer from a worrier. Falls back to
        /// "answer:any". Null when nothing fits.
        /// </summary>
        public static string Answer(Villager answerer, Villager asker, string key)
        {
            List<string> extra = PairTags(answerer, asker);
            extra.Add("answer:" + key);
            _partner = asker;
            try
            {
                string line = LineFor(answerer, "reply", "answer:" + key, extra.ToArray());
                if (line == null && key != "any")
                {
                    extra.Add("answer:any");
                    line = LineFor(answerer, "reply", "answer:any", extra.ToArray());
                }

                return line;
            }
            finally
            {
                _partner = null;
            }
        }

        /// <summary>A third villager standing close to a chat joins in with a line tagged "chime:key".</summary>
        public static bool ChimeIn(Villager a, Villager b, string key)
        {
            Villager third = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => v != a && v != b && !v.IsDead() && v.VillageId == a.VillageId && !Sleep.IsAsleep(v) &&
                            Vector3.Distance(v.transform.position, a.transform.position) < 9f)
                .OrderBy(v => Vector3.Distance(v.transform.position, a.transform.position)).FirstOrDefault();
            if (third == null)
            {
                return false;
            }

            List<string> extra = PairTags(third, a);
            extra.Add("chime:" + key);
            Social.LookAt(third, a, 4f);
            QueueLine(third, "reply", "chime:" + key, extra.ToArray(), Random.Range(1.2f, 2.2f));
            return true;
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

                options.Add((section, section.Weight * FatigueFactor(section)));
            }

            if (options.Count == 0)
            {
                return null;
            }

            string sighted = extra?.FirstOrDefault(e => e.StartsWith("sighted:"))?.Substring(8);
            if (sighted != null && !CreatureNear(villager, sighted, 50f))
            {
                // The creature has gone (or was never in sight of this one): nothing to say about it.
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

                // A line about "{beast}" needs a real creature close by; without one it is skipped.
                if (line.Contains("{beast}") && sighted == null && Context.Beast(villager) == null)
                {
                    continue;
                }

                Remember(villager.VillageId, line);
                if (Player.m_localPlayer != null && Vector3.Distance(Player.m_localPlayer.transform.position, villager.transform.position) < 20f)
                {
                    Tire(picked);
                }

                // Only a section's own ~tone moves hands and draws replies: a voice alone is no reason to gesture.
                memory.LastTone = picked.Tone;
                memory.LastPlace = picked.All.Any(t => t.StartsWith("rumor")) ? Village.Rumors.PlaceOf(villager) : null;

                memory.Recent.Enqueue(line);
                while (memory.Recent.Count > 12)
                {
                    memory.Recent.Dequeue();
                }

                _sighted = sighted;
                try
                {
                    return Fill(line, villager);
                }
                finally
                {
                    _sighted = null;
                }
            }

            return null;
        }

        /// <summary>The creature a queued line is about (from a "sighted:x" tag), for {beast}.</summary>
        private static string _sighted;

        // ---------------------------------------------------------------- topic fatigue

        /// <summary>
        /// How tired the player is of each section, after MCA's interaction fatigue: +1 every time he hears a line
        /// from it (within 20 m), one point wears off every two game hours (150 s). A tired section is picked less:
        /// weight / (1 + 0.8 x fatigue), so after three lines from one topic the others come forward.
        /// </summary>
        private static readonly Dictionary<Section, (float Count, float At)> Fatigue = new Dictionary<Section, (float, float)>();

        private const float FatigueWearsOff = 150f;

        private static float FatigueNow(Section section) =>
            Fatigue.TryGetValue(section, out var f) ? Mathf.Max(0f, f.Count - (Time.time - f.At) / FatigueWearsOff) : 0f;

        private static float FatigueFactor(Section section) =>
            LogicConfig.IsOn(LogicConfig.TopicFatigue) ? 1f / (1f + 0.8f * FatigueNow(section)) : 1f;

        private static void Tire(Section section)
        {
            if (LogicConfig.IsOn(LogicConfig.TopicFatigue))
            {
                Fatigue[section] = (FatigueNow(section) + 1f, Time.time);
            }
        }

        /// <summary>The sections the player is most tired of, for the inspect command.</summary>
        public static string DescribeFatigue() =>
            string.Join("; ", Fatigue.Select(f => (Section: f.Key, Count: FatigueNow(f.Key))).Where(f => f.Count >= 0.5f)
                .OrderByDescending(f => f.Count).Take(6)
                .Select(f => $"{string.Join(",", f.Section.All)}{(f.Section.VoiceSet != null ? "|" + string.Join("/", f.Section.VoiceSet) : "")} {f.Count:0.0}"));

        /// <summary>Now and then, with a player close by, a villager says something about what is going on.</summary>
        public static void Tick(Villager villager)
        {
            Personality.Sample(villager);
            Goals.Update(villager);
            if (Pendings.Count > 0)
            {
                RunPendings();
            }

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

        // ---------------------------------------------------------------- follow-ups and answers

        /// <summary>
        /// The rest of a line said in more than one bubble. In any line, " >> " is a pause and the same speaker goes
        /// on ("My grandmother said ... >> She mostly said it after I'd broken something."), and " // " outside a chat
        /// is answered by the nearest other villager within ReplyRange ("Greydwarfs by the woodpile! // Get a torch
        /// over there."); with nobody close, the line ends there. In a chat (FreeTime) "//" keeps its old meaning.
        /// </summary>
        private sealed class Pending
        {
            public Villager Who;
            public Villager Back;
            public string Rest;
            public float At;
        }

        private static readonly List<Pending> Pendings = new List<Pending>();

        private const float ReplyRange = 10f;

        /// <summary>How long a bubble stays up: long enough to read, never less than asked.</summary>
        public static float ReadTime(string text, float atLeast) => Mathf.Max(atLeast, Mathf.Clamp(2.5f + text.Length * 0.07f, 3f, 12f));

        private static void RunPendings()
        {
            for (int i = Pendings.Count - 1; i >= 0; i--)
            {
                Pending p = Pendings[i];
                if (p.Who == null || p.Who.IsDead() || Time.time - p.At > 20f)
                {
                    Pendings.RemoveAt(i);
                }
                else if (Time.time >= p.At)
                {
                    Pendings.RemoveAt(i);
                    if (!Sleep.IsAsleep(p.Who))
                    {
                        if (p.Back != null)
                        {
                            Social.LookAt(p.Who, p.Back, 4f);
                        }

                        SayParts(p.Who, p.Rest, 5f, p.Back);
                    }
                }
            }
        }

        private static Villager Responder(Villager speaker, Villager preferred)
        {
            if (preferred != null && !preferred.IsDead() && !Sleep.IsAsleep(preferred) &&
                Vector3.Distance(preferred.transform.position, speaker.transform.position) <= ReplyRange)
            {
                return preferred;
            }

            return Character.GetAllCharacters().OfType<Villager>()
                .Where(v => v != speaker && !v.IsDead() && v.VillageId == speaker.VillageId && !Sleep.IsAsleep(v) &&
                            Vector3.Distance(v.transform.position, speaker.transform.position) <= ReplyRange)
                .OrderBy(v => Vector3.Distance(v.transform.position, speaker.transform.position)).FirstOrDefault();
        }

        /// <summary>Says the first bubble of <paramref name="line"/> and queues the rest.</summary>
        private static string SayParts(Villager villager, string line, float seconds, Villager back)
        {
            int pause = line.IndexOf(">>", StringComparison.Ordinal);
            int answer = line.IndexOf("//", StringComparison.Ordinal);
            int cut = pause < 0 ? answer : answer < 0 ? pause : Mathf.Min(pause, answer);
            string first = (cut < 0 ? line : line.Substring(0, cut)).Trim();
            string rest = cut < 0 ? null : line.Substring(cut + 2).Trim();
            float shown = ReadTime(first, seconds);
            if (!string.IsNullOrEmpty(rest))
            {
                if (cut == pause)
                {
                    // The same speaker goes on once the first bubble has been read.
                    float wait = Mathf.Clamp(2.5f + first.Length * 0.08f, 6f, 10f);
                    shown = Mathf.Max(shown, wait - 0.5f);
                    Pendings.Add(new Pending { Who = villager, Back = back, Rest = rest, At = Time.time + wait });
                }
                else
                {
                    Villager other = Responder(villager, back);
                    if (other != null)
                    {
                        float wait = Mathf.Clamp(1.5f + first.Length * 0.05f, 2.5f, 6f);
                        Social.LookAt(other, villager, wait + 2f);
                        Pendings.Add(new Pending { Who = other, Back = villager, Rest = rest, At = Time.time + wait });
                    }
                }
            }

            global::Chat.instance.SetNpcText(villager.gameObject, Vector3.up * 2.2f, 20f, shown, "", first, false);
            return first;
        }

        /// <summary>What the player sees of a line in its first bubble (for checks and console samples).</summary>
        public static string FirstBubble(string line)
        {
            if (line == null) return null;
            int pause = line.IndexOf(">>", StringComparison.Ordinal);
            int answer = line.IndexOf("//", StringComparison.Ordinal);
            int cut = pause < 0 ? answer : answer < 0 ? pause : Mathf.Min(pause, answer);
            return (cut < 0 ? line : line.Substring(0, cut)).Trim();
        }

        public static void Say(Villager villager, string line, float seconds = 5f)
        {
            if (string.IsNullOrEmpty(line) || global::Chat.instance == null)
            {
                return;
            }

            SayParts(villager, line, seconds, null);
            Memory memory = Memories.GetOrCreateValue(villager);
            string tone = memory.LastTone;
            Vector3? place = memory.LastPlace;
            memory.LastTone = null;
            memory.LastPlace = null;
            string gesture = GestureFor(tone);
            if (gesture != null && !Sleep.IsAsleep(villager) && Random.value < GestureChance(tone))
            {
                if (gesture == "point")
                {
                    // Pointing only makes sense at the real place: he turns to it first, or does not point.
                    Vector3 way = place.HasValue ? (place.Value - villager.transform.position).Horizontal() : Vector3.zero;
                    if (way.sqrMagnitude > 1f)
                    {
                        villager.transform.rotation = Quaternion.LookRotation(way.normalized);
                        Poses.Gesture(villager, gesture);
                    }
                }
                else
                {
                    Poses.Gesture(villager, gesture);
                }
            }

            Social.Heard(villager, tone);
        }

        /// <summary>
        /// The speaker's gesture for a section's ~tone. Only tones whose lines call for the hands have one: ~wave for
        /// hellos and goodbyes, ~no for refusals, ~shrug for "I don't know", ~point for a place (he turns to it),
        /// ~joke a laugh, ~proud a thumbs up, ~cheer for good news, ~pious a bow. Worry, anger and sadness show in the
        /// words only.
        /// </summary>
        private static string GestureFor(string tone)
        {
            switch (tone)
            {
                case "wave": return "wave";
                case "no": return "nonono";
                case "shrug": return "shrug";
                case "point": return "point";
                case "joke": return "laugh";
                case "proud": return "thumbsup";
                case "cheer": return "cheer";
                case "pious": return "bow";
                default: return null;
            }
        }

        /// <summary>Gestures stay rare: the ones a line plainly asks for (a wave, a point) a bit more often.</summary>
        private static float GestureChance(string tone) => tone == "wave" || tone == "point" || tone == "no" ? 0.5f : 0.2f;

        /// <summary>A creature with this word (Context.CreatureWord) within <paramref name="range"/> of the villager.</summary>
        private static bool CreatureNear(Villager villager, string word, float range)
        {
            Vector3 at = villager.transform.position;
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character != null && !character.IsDead() && !(character is Player) && !(character is Villager) &&
                    Vector3.Distance(character.transform.position, at) <= range && Context.CreatureWord(character) == word)
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>The game's own name for a creature word, as players know it: "Greydwarf", "Fuling", "Troll".</summary>
        public static string BeastName(string word)
        {
            switch (word)
            {
                case null: return null;
                case "goblin":
                case "fuling": return "Fuling";
                case "great stag": return "Eikthyr";
                case "bear": return "Bjørn";
                case "stone golem": return "Stone Golem";
                case "deer":
                case "boar":
                case "hare":
                case "chicken":
                case "gull":
                case "crow":
                case "wolf":
                case "skeleton":
                case "ghost":
                case "leech":
                case "bat":
                case "serpent": return word;
                default: return char.ToUpperInvariant(word[0]) + word.Substring(1);
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
                           Hunting.Describe(villager) ?? Farming.Describe(villager) ?? Sorting.Describe(villager) ?? Foraging.Describe(villager) ??
                           Repairs.Describe(villager) ?? Smithing.Describe(villager) ??
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

            tags.UnionWith(Context.Tags(villager));
            tags.UnionWith(VillagerSkills.Tags(villager, ActivityWord(doing)));
            tags.UnionWith(Goals.Tags(villager));
            tags.UnionWith(Gatherings.Tags(villager.VillageId));

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid)
            {
                return tags;
            }

            tags.UnionWith(PlayerMemory.Tags(hearth, villager));
            tags.UnionWith(Village.Living.Tags(villager, hearth));
            tags.UnionWith(Village.Rumors.Tags(villager, hearth));

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
                tags.Add("neighbor:" + Relations.Band(neighbour.Value.View));
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
            tags.UnionWith(Village.Living.WandererTags(villager));
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
            // In a chat, {partner} is the one being talked to and {other} someone else near by.
            string partner = _partner != null ? _partner.VillagerName : null;
            string other = OtherVillager(villager, _partner);
            partner = partner ?? other;
            line = Goals.Fill(line, villager);
            line = PlayerMemory.Fill(line, villager);
            line = VillagerSkills.Fill(line, villager, ActivityWord(VillagerBehaviour.Activity(villager) ?? "idle"));
            line = FillMoment(line, villager);
            line = Personality.Fill(line, villager);
            line = Village.Living.Fill(line, villager);
            line = Village.Rumors.Fill(line, villager);
            if (line.Contains("{neighbor}"))
            {
                line = line.Replace("{neighbor}", (hearth != null ? Relations.Nearest(hearth)?.Name : null) ?? "the next village");
            }

            line = line.Replace("{village}", village)
                .Replace("{material}", material)
                .Replace("{building}", building)
                .Replace("{name}", villager.VillagerName)
                .Replace("{player}", player)
                .Replace("{partner}", partner)
                .Replace("{other}", other);

            // Fill-ins such as {favfood} or {news} can start a sentence: give it its capital.
            return System.Text.RegularExpressions.Regex.Replace(line, @"(^|[.?!]\s+)([a-z])", m => m.Groups[1].Value + char.ToUpperInvariant(m.Groups[2].Value[0]));
        }

        /// <summary>Fill-ins about the moment: {place} {beast} {playergear} {playerweapon} {lastboss} {daypart} {weather}.</summary>
        private static string FillMoment(string line, Villager villager)
        {
            if (line.IndexOf('{') < 0)
            {
                return line;
            }

            Player player = Player.m_localPlayer;
            float hour = EnvMan.instance != null ? EnvMan.instance.GetDayFraction() * 24f : 12f;
            string daypart = hour >= 5f && hour < 11f ? "morning" : hour < 17f && hour >= 11f ? "afternoon" : hour >= 17f && hour < 22f ? "evening" : "night";
            string env = EnvMan.instance?.GetCurrentEnvironment()?.m_name?.ToLowerInvariant() ?? "";
            string weather = env.Contains("thunder") ? "storm" : env.Contains("snow") ? "snow" : env.Contains("rain") ? "rain" :
                env.Contains("mist") || env.Contains("fog") ? "mist" : "weather";
            return line.Replace("{place}", Context.Place(villager))
                .Replace("{beast}", BeastName(_sighted ?? Context.Beast(villager)) ?? "creature")
                .Replace("{playergear}", player != null ? Context.GearName(player) : "gear")
                .Replace("{playerweapon}", Context.WeaponWord(player?.GetRightItem()) ?? "blade")
                .Replace("{lastboss}", Context.LastBoss() ?? "the great stag")
                .Replace("{daypart}", daypart)
                .Replace("{weather}", weather);
        }

        private static string OtherVillager(Villager villager, Villager besides = null)
        {
            Villager best = null;
            float bestDistance = float.MaxValue;
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character is Villager other && other != villager && other != besides && other.VillageId == villager.VillageId && !other.IsDead())
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
