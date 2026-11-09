using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// A player who harms a village's people (D-051, T-48). Turned off with PlayerGrudges.
    ///
    /// - A few hits may be an accident: up to PlayerHitsToFight hits within PlayerHitWindow, a protector who is hit
    ///   only says so (playerhit:protector) and carers, elders and children run to the hearth (playerhit:carer,
    ///   playerhit:child).
    /// - From then on it is on purpose. The protector who was hit (or the nearest protector, when it was someone else)
    ///   fights him (playerfight). Every other protector within PlayerWarnRadius of him tells him to leave
    ///   (grudge:warn) and joins the fight (grudge:join) if he is still that close PlayerWarnSeconds later. Anyone who
    ///   is not a protector runs home (playerfight:flee). It ends when he leaves the village.
    /// - It is remembered on the hearth. Harming people bans him for PlayerBanDays, plus PlayerBanDaysPerPerson for
    ///   each more person harmed, on top of any ban still running. Killing one of them bans him for good. A banned
    ///   player who comes back is warned (grudge:warn, or grudge:killer for a killer) by the protectors he comes near,
    ///   and they fight him if he stays.
    /// </summary>
    internal static class Grudges
    {
        internal enum Role
        {
            None,
            Fight,
            Warn,
            Flee,
        }

        private static readonly int KeyGrudges = "villheim_grudges".GetStableHashCode();

        private sealed class Episode
        {
            public Player Player;
            public readonly HashSet<Villager> Fighters = new HashSet<Villager>();
            public readonly Dictionary<Villager, float> Warned = new Dictionary<Villager, float>();
            public readonly HashSet<ZDOID> Harmed = new HashSet<ZDOID>();
        }

        private sealed class Mark
        {
            public float FleeUntil = -100f;
            public Player FleeFrom;
            public Player LastHitBy;
            public float LastHitAt = -100f;
            public float NextLine;
        }

        private static readonly Dictionary<int, Episode> Episodes = new Dictionary<int, Episode>();
        private static readonly Dictionary<(int, long), List<(float Time, ZDOID Who)>> Hits = new Dictionary<(int, long), List<(float, ZDOID)>>();
        private static readonly Dictionary<int, float> NextArrivalCheck = new Dictionary<int, float>();
        private static readonly ConditionalWeakTable<Villager, Mark> Marks = new ConditionalWeakTable<Villager, Mark>();

        private static bool On => LogicConfig.IsOn(LogicConfig.PlayerGrudges);
        private static int Today => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;
        private static float WarnRadius => Mathf.Max(2f, LogicConfig.PlayerWarnRadius?.Value ?? 20f);
        private static float WarnSeconds => Mathf.Max(0f, LogicConfig.PlayerWarnSeconds?.Value ?? 15f);

        public static bool Protects(Villager villager) =>
            !Childhood.IsChild(villager) && !Elders.IsElder(villager) && Roles.BackgroundOf(villager) == Roles.Background.Protector;

        // ---------------------------------------------------------------- the record on the hearth

        private sealed class Record
        {
            public long Player;
            public int BanUntil;
            public bool Killed;
        }

        private static List<Record> Read(VillageHearth hearth)
        {
            var list = new List<Record>();
            foreach (string part in (hearth?.Zdo?.GetString(KeyGrudges, "") ?? "").Split(';'))
            {
                string[] bits = part.Split(':');
                if (bits.Length == 3 && long.TryParse(bits[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out long id) &&
                    int.TryParse(bits[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out int until))
                {
                    list.Add(new Record { Player = id, BanUntil = until, Killed = bits[2] == "1" });
                }
            }

            return list;
        }

        private static void Write(VillageHearth hearth, List<Record> list)
        {
            hearth.Zdo.Set(KeyGrudges, string.Join(";", list.Select(r =>
                $"{r.Player.ToString(CultureInfo.InvariantCulture)}:{r.BanUntil.ToString(CultureInfo.InvariantCulture)}:{(r.Killed ? 1 : 0)}")));
        }

        private static Record RecordFor(VillageHearth hearth, long player, List<Record> list)
        {
            Record record = list.FirstOrDefault(r => r.Player == player);
            if (record == null)
            {
                record = new Record { Player = player, BanUntil = -1 };
                list.Add(record);
            }

            return record;
        }

        /// <summary>Whether the village holds something against the player now: a ban still running, or a killing.</summary>
        public static bool Unwelcome(VillageHearth hearth, Player player, out bool killer)
        {
            killer = false;
            if (!On || hearth == null || player == null)
            {
                return false;
            }

            Record record = Read(hearth).FirstOrDefault(r => r.Player == player.GetPlayerID());
            if (record == null)
            {
                return false;
            }

            killer = record.Killed && LogicConfig.IsOn(LogicConfig.PlayerKillBan);
            return killer || record.BanUntil >= Today;
        }

        private static void Ban(VillageHearth hearth, Player player, int people)
        {
            if (hearth == null || player == null || people <= 0)
            {
                return;
            }

            List<Record> list = Read(hearth);
            Record record = RecordFor(hearth, player.GetPlayerID(), list);
            int first = Mathf.Max(0, LogicConfig.PlayerBanDays?.Value ?? 2);
            int each = Mathf.Max(0, LogicConfig.PlayerBanDaysPerPerson?.Value ?? 2);
            int from = Mathf.Max(record.BanUntil, Today);
            int added = record.BanUntil >= Today ? each * people : first + each * (people - 1);
            record.BanUntil = from + added;
            Write(hearth, list);
            Chronicle.Add(hearth, $"{player.GetPlayerName()} turned on our people. He is not welcome here until day {record.BanUntil}.");
        }

        // ---------------------------------------------------------------- hits and deaths

        /// <summary>A player hit one of the village's people (on the machine that owns the villager).</summary>
        public static void Hit(Villager villager, Player player)
        {
            if (!On || villager == null || player == null || villager.VillageId == 0)
            {
                return;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            Mark mark = Marks.GetOrCreateValue(villager);
            mark.LastHitBy = player;
            mark.LastHitAt = Time.time;
            bool protector = Protects(villager);
            if (!protector)
            {
                mark.FleeUntil = Time.time + 12f;
                mark.FleeFrom = player;
            }

            // Already at odds with him: a new person harmed makes the ban longer, and a protector he hits fights.
            if (Episodes.TryGetValue(villager.VillageId, out Episode episode) && episode.Player == player)
            {
                if (episode.Harmed.Add(villager.GetZDOID()))
                {
                    Ban(hearth, player, 1);
                }

                if (protector && episode.Fighters.Add(villager))
                {
                    episode.Warned.Remove(villager);
                    Line(villager, "playerfight", true);
                }
                else if (!protector)
                {
                    Line(villager, "playerfight:flee");
                }

                return;
            }

            var key = (villager.VillageId, player.GetPlayerID());
            if (!Hits.TryGetValue(key, out List<(float Time, ZDOID Who)> hits))
            {
                hits = new List<(float, ZDOID)>();
                Hits[key] = hits;
            }

            float window = Mathf.Max(1f, LogicConfig.PlayerHitWindow?.Value ?? 30f);
            hits.RemoveAll(h => Time.time - h.Time > window);
            hits.Add((Time.time, villager.GetZDOID()));
            if (hits.Count < Mathf.Max(1, LogicConfig.PlayerHitsToFight?.Value ?? 3))
            {
                Line(villager, protector ? "playerhit:protector" : Childhood.IsChild(villager) ? "playerhit:child" : "playerhit:carer");
                return;
            }

            // On purpose: the fight starts, and the ban is set by how many people he harmed.
            episode = Start(villager.VillageId, player);
            foreach ((float _, ZDOID who) in hits)
            {
                episode.Harmed.Add(who);
            }

            hits.Clear();
            Ban(hearth, player, episode.Harmed.Count);
            Villager first = protector
                ? villager
                : People(villager.VillageId).Where(Protects)
                    .OrderBy(v => Vector3.Distance(v.transform.position, player.transform.position)).FirstOrDefault();
            if (first != null && Vector3.Distance(first.transform.position, player.transform.position) < WarnRadius * 2f)
            {
                episode.Fighters.Add(first);
                Line(first, "playerfight", true);
            }

            if (!protector)
            {
                Line(villager, "playerfight:flee", true);
            }

            VillheimPlugin.Debug($"{villager.VillageName}: {player.GetPlayerName()} keeps hitting our people; the protectors turn on him.");
        }

        /// <summary>
        /// A villager died: the player who struck him last killed him. Taken from the game's own last hit first (an arrow
        /// or a blow that killed at once), else from a hit counted in the last ten seconds (Tyler: villagers he killed
        /// left no grudge). The killing is written on the hearth for good, and every protector near him turns on him.
        /// </summary>
        public static void Died(Villager villager)
        {
            if (!On || villager == null || villager.VillageId == 0 || Wanderers.IsWanderer(villager))
            {
                return;
            }

            Player killer = villager.m_lastHit != null ? villager.m_lastHit.GetAttacker() as Player : null;
            if (killer == null && Marks.TryGetValue(villager, out Mark mark) && mark.LastHitBy != null && Time.time - mark.LastHitAt <= 10f)
            {
                killer = mark.LastHitBy;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (killer == null || hearth == null || !hearth.IsValid)
            {
                return;
            }

            if (!hearth.NView.IsOwner())
            {
                hearth.NView.ClaimOwnership();
            }

            List<Record> list = Read(hearth);
            Record record = RecordFor(hearth, killer.GetPlayerID(), list);
            bool first = !record.Killed;
            record.Killed = true;
            Write(hearth, list);
            if (first)
            {
                Chronicle.Add(hearth, $"{killer.GetPlayerName()} killed {villager.VillagerName}. He will never be welcome here again.");
            }
            else
            {
                Chronicle.Add(hearth, $"{killer.GetPlayerName()} killed {villager.VillagerName} too.");
            }

            VillheimPlugin.Log.LogInfo($"{hearth.VillageName}: {killer.GetPlayerName()} killed {villager.VillagerName}; never welcome again.");
            if (!Episodes.TryGetValue(villager.VillageId, out Episode episode) || episode.Player != killer)
            {
                episode = Start(villager.VillageId, killer);
            }

            // A killing is no accident: the protectors close by fight at once, without a warning first.
            foreach (Villager protector in People(villager.VillageId).Where(v => v != villager && Protects(v) &&
                         Vector3.Distance(v.transform.position, killer.transform.position) < WarnRadius * 2f))
            {
                if (episode.Fighters.Add(protector))
                {
                    episode.Warned.Remove(protector);
                    Line(protector, "playerfight", true);
                }
            }
        }

        private static Episode Start(int villageId, Player player)
        {
            var episode = new Episode { Player = player };
            Episodes[villageId] = episode;
            return episode;
        }

        private static IEnumerable<Villager> People(int villageId) =>
            Character.GetAllCharacters().OfType<Villager>().Where(v => !v.IsDead() && v.VillageId == villageId && !Wanderers.IsWanderer(v));

        // ---------------------------------------------------------------- each villager's part

        /// <summary>
        /// The villager's part in a quarrel with a player this tick, and the player. Also opens one when a banned
        /// player walks into the village, and closes it when he leaves.
        /// </summary>
        public static Role RoleOf(Villager villager, VillageHearth hearth, out Player player)
        {
            player = null;
            if (!On)
            {
                return Role.None;
            }

            Mark mark = Marks.GetOrCreateValue(villager);
            CheckArrivals(villager.VillageId, hearth);
            if (Episodes.TryGetValue(villager.VillageId, out Episode episode))
            {
                Player foe = episode.Player;
                float reach = VillheimConfig.VillageRadius.Value + Mathf.Max(0f, LogicConfig.FightLeash?.Value ?? 30f);
                if (foe == null || foe.IsDead() || Utils.DistanceXZ(foe.transform.position, hearth.transform.position) > reach)
                {
                    // He left (or fell): the village goes back to its day. The ban stays on the hearth.
                    Episodes.Remove(villager.VillageId);
                }
                else
                {
                    player = foe;
                    float distance = Vector3.Distance(foe.transform.position, villager.transform.position);
                    if (!Protects(villager))
                    {
                        if (distance < 30f)
                        {
                            Line(villager, "playerfight:flee");
                            return Role.Flee;
                        }

                        return Role.None;
                    }

                    if (episode.Fighters.Contains(villager))
                    {
                        return Role.Fight;
                    }

                    if (episode.Warned.TryGetValue(villager, out float joinAt))
                    {
                        if (distance > WarnRadius * 1.5f)
                        {
                            return Role.None;
                        }

                        if (Time.time >= joinAt && distance <= WarnRadius)
                        {
                            episode.Warned.Remove(villager);
                            episode.Fighters.Add(villager);
                            Line(villager, "grudge:join", true);
                            return Role.Fight;
                        }

                        return Role.Warn;
                    }

                    if (distance <= WarnRadius)
                    {
                        // Queued up to fight: he says to leave, or else.
                        Unwelcome(hearth, foe, out bool killer);
                        episode.Warned[villager] = Time.time + WarnSeconds;
                        Line(villager, killer ? "grudge:killer" : "grudge:warn", true);
                        return Role.Warn;
                    }

                    return Role.None;
                }
            }

            // Hit by a player before it counted as on purpose: carers, elders and children run home a while.
            if (!Protects(villager) && Time.time < mark.FleeUntil && mark.FleeFrom != null && !mark.FleeFrom.IsDead())
            {
                player = mark.FleeFrom;
                return Role.Flee;
            }

            return Role.None;
        }

        /// <summary>Once a second per village: a player the village holds a grudge against has come into it.</summary>
        private static void CheckArrivals(int villageId, VillageHearth hearth)
        {
            if (Episodes.ContainsKey(villageId) || (NextArrivalCheck.TryGetValue(villageId, out float next) && Time.time < next))
            {
                return;
            }

            NextArrivalCheck[villageId] = Time.time + 1f;
            foreach (Player player in Player.GetAllPlayers())
            {
                if (player != null && !player.IsDead() &&
                    Utils.DistanceXZ(player.transform.position, hearth.transform.position) < VillheimConfig.VillageRadius.Value &&
                    Unwelcome(hearth, player, out _))
                {
                    Start(villageId, player);
                    VillheimPlugin.Debug($"{hearth.VillageName}: {player.GetPlayerName()} came back while unwelcome.");
                    return;
                }
            }
        }

        /// <summary>True while the village is at odds with a player (for the retreat rule).</summary>
        public static bool Active(int villageId) => Episodes.ContainsKey(villageId);

        private static void Line(Villager villager, string tag, bool force = false)
        {
            Mark mark = Marks.GetOrCreateValue(villager);
            if (!force && Time.time < mark.NextLine)
            {
                return;
            }

            mark.NextLine = Time.time + 6f;
            string line = Dialogue.LineFor(villager, "self", tag, new[] { tag });
            if (line != null)
            {
                Dialogue.Say(villager, line, 4f);
            }
        }

        // ---------------------------------------------------------------- command

        /// <summary>'vh grudges [clear]': what the nearest village holds against players.</summary>
        public static string Command(string[] args)
        {
            Player me = Player.m_localPlayer;
            VillageHearth hearth = me != null ? VillageHearth.Closest(me.transform.position, 300f) : null;
            if (hearth == null || !hearth.IsValid)
            {
                return "Villheim: no village within 300 m.";
            }

            if (args.Length > 0 && args[0].Equals("clear", System.StringComparison.OrdinalIgnoreCase))
            {
                hearth.Zdo.Set(KeyGrudges, "");
                Episodes.Remove(hearth.VillageId);
                Hits.Clear();
                return $"Villheim: {hearth.VillageName} holds nothing against anyone now.";
            }

            List<Record> list = Read(hearth);
            string now = Episodes.TryGetValue(hearth.VillageId, out Episode episode)
                ? $" At odds with {episode.Player?.GetPlayerName()} now: {episode.Fighters.Count} fighting, {episode.Warned.Count} warning."
                : "";
            return list.Count == 0
                ? $"Villheim: {hearth.VillageName} holds nothing against anyone (today is day {Today}).{now}"
                : $"Villheim: {hearth.VillageName} (day {Today}): " + string.Join("; ", list.Select(r =>
                    $"player {r.Player}: {(r.Killed ? "killed one of us, never welcome" : r.BanUntil >= Today ? $"unwelcome until day {r.BanUntil}" : "welcome again")}")) + "." + now;
        }
    }
}
