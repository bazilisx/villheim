using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Villagers who leave, and where they go (proposals 7 and 16, after Banished, Manor Lords' approval and Dwarf
    /// Fortress migrants). Needs WorldLife and VillagersLeave on. Off by default: villagers never move away (Tyler,
    /// 2026-11-08, D-003). The code is kept for a later choice.
    ///
    /// - Who: a villager who went LeaveAfterDays without a need (Complaints), or, when the village's mood has been under
    ///   ExodusMood for ExodusDays mornings running, its least content grown villager (never the Jarl). Nobody leaves a
    ///   village of two or fewer.
    /// - Where: the neighbour within 4,000 m this village thinks best of (above 0), or somewhere far off.
    /// - How: he says goodbye, the chronicle notes it, everyone takes "leftus" (-4), and he walks out by day toward
    ///   it. Once he is past the edge and no player is within 40 m he is gone. The neighbour gets him as a migrant:
    ///   the next newcomer there (when it has a free bed, within ten days) is the same person, same name and face, and
    ///   the chronicle says where he came from.
    /// - Records: the leaver's ZDO (villheim_leaving: destination id, -1 far off; villheim_leaveto: where he walks), the
    ///   destination hearth's migrant list (name|seed|from|day).
    /// </summary>
    internal static class Leaving
    {
        private static readonly int KeyLeaving = "villheim_leaving".GetStableHashCode();
        private static readonly int KeyLeaveTo = "villheim_leaveto".GetStableHashCode();
        private static readonly int KeyLeaveWhy = "villheim_leavewhy".GetStableHashCode();
        private static readonly int KeyMigrants = "villheim_migrants".GetStableHashCode();
        public static readonly int KeyCameFrom = "villheim_camefrom".GetStableHashCode();
        private static readonly int KeyLowDays = "villheim_lowmood_days".GetStableHashCode();
        private static readonly int KeyLowDay = "villheim_lowmood_day".GetStableHashCode();

        private sealed class Walk
        {
            public float Since;
        }

        private static readonly System.Runtime.CompilerServices.ConditionalWeakTable<Villager, Walk> Walks =
            new System.Runtime.CompilerServices.ConditionalWeakTable<Villager, Walk>();

        public static bool On => Living.World && Living.On(LogicConfig.Leaving);

        public static bool IsLeaving(Villager villager) => villager?.Zdo != null && villager.Zdo.GetInt(KeyLeaving) != 0;

        /// <summary>The villager packs up and walks off. False when he can't (too few left, a child, already going).</summary>
        public static bool Start(Villager villager, string why, bool force = false)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid || IsLeaving(villager) || Childhood.IsChild(villager) || Wanderers.IsWanderer(villager) ||
                (!force && (VillageBrain.CountVillagers(villager.VillageId) <= 2 || Roles.IsJarl(villager))))
            {
                return false;
            }

            Vector3 center = hearth.transform.position;
            ZDO destination = null;
            int best = 0;
            foreach (ZDO other in Relations.AllHearths())
            {
                int id = other.GetInt(Keys.VillageId);
                if (id == hearth.VillageId || Utils.DistanceXZ(other.GetPosition(), center) > 4000f)
                {
                    continue;
                }

                int view = Relations.View(hearth.Zdo, id);
                if (view > best)
                {
                    best = view;
                    destination = other;
                }
            }

            Vector3 toward = destination != null ? (destination.GetPosition() - center).Horizontal() : Random.insideUnitSphere.Horizontal();
            toward = toward.sqrMagnitude > 0.01f ? toward.normalized : Vector3.forward;
            Vector3 target = center + toward * (VillheimConfig.VillageRadius.Value + 90f);

            ZDO zdo = villager.Zdo;
            zdo.Set(KeyLeaving, destination != null ? destination.GetInt(Keys.VillageId) : -1);
            zdo.Set(KeyLeaveTo, target);
            zdo.Set(KeyLeaveWhy, why);
            Walks.Remove(villager);
            Walker.For(villager).Reset();
            Seats.StandUp(villager);
            Sleep.Wake(villager);

            string place = destination != null ? destination.GetString(Keys.Name, "the next village") : "somewhere far off";
            Chronicle.Add(hearth, $"{villager.VillagerName} left for {place}: {Reason(why)}.");
            WorldLife.NoteNews(hearth.VillageId, "leaving");
            Moods.VillageThink(hearth.VillageId, "leftus");
            Dialogue.Note(hearth.VillageId, "leaving");
            Dialogue.Say(villager, Dialogue.LineFor(villager, "self", "farewell", new[] { "farewell", "farewell:" + why }) ??
                                   "I can't stay. Look after the place.", 7f);
            Poses.Gesture(villager, "wave");
            VillheimPlugin.Log.LogInfo($"{hearth.VillageName}: {villager.VillagerName} leaves for {place} ({why}).");
            return true;
        }

        private static string Reason(string why)
        {
            switch (why)
            {
                case "bed": return "there was never a bed for them";
                case "food": return "there was nothing to eat";
                case "safety": return "the fighting never stopped";
                case "mood": return "the village had gone sour";
                default: return "it was time to go";
            }
        }

        /// <summary>From the brain: a leaver walks out, and is gone once nobody sees him. True while he leaves.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            if (!IsLeaving(villager))
            {
                return false;
            }

            Walk walk = Walks.GetOrCreateValue(villager);
            if (walk.Since <= 0f)
            {
                walk.Since = Time.time;
            }

            Vector3 target = villager.Zdo.GetVec3(KeyLeaveTo, villager.transform.position);
            WalkResult result = Walker.For(villager).Go(villager, ai, dt, target, 3f);
            if (result == WalkResult.Walking && Time.time - walk.Since < 600f)
            {
                return true;
            }

            Player player = Player.m_localPlayer;
            if (player != null && Vector3.Distance(player.transform.position, villager.transform.position) < 40f)
            {
                // Someone is watching: he keeps walking a little farther.
                Vector3 on = (target - villager.transform.position).Horizontal();
                if (on.sqrMagnitude < 1f)
                {
                    VillageHearth home = VillageHearth.Find(villager.VillageId);
                    on = home != null ? (target - home.transform.position).Horizontal() : Vector3.forward;
                }

                villager.Zdo.Set(KeyLeaveTo, target + on.normalized * 30f);
                Walker.For(villager).Reset();
                walk.Since = Time.time;
                return true;
            }

            Gone(villager);
            return true;
        }

        private static void Gone(Villager villager)
        {
            ZDO zdo = villager.Zdo;
            int to = zdo.GetInt(KeyLeaving);
            ZDO destination = to > 0 ? Relations.AllHearths().FirstOrDefault(z => z.GetInt(Keys.VillageId) == to) : null;
            if (destination != null && (ZNet.instance.IsServer() || destination.IsOwner()))
            {
                List<string> list = destination.GetString(KeyMigrants, "").Split(';').Where(e => e.Length > 0).ToList();
                list.Add(string.Join("|", Clean(villager.VillagerName), zdo.GetInt(Keys.VillagerSeed).ToString(CultureInfo.InvariantCulture),
                    Clean(villager.VillageName), (Living.Today + 1).ToString(CultureInfo.InvariantCulture), Cultures.OfVillager(villager)));
                destination.Set(KeyMigrants, string.Join(";", list.Skip(Mathf.Max(0, list.Count - 6))));
            }

            VillheimPlugin.Debug($"{villager.VillagerName} has left {villager.VillageName} for good.");
            Walks.Remove(villager);
            ZNetScene.instance.Destroy(villager.gameObject);
        }

        private static string Clean(string text) => (text ?? "").Replace("|", "").Replace(";", "");

        /// <summary>
        /// From VillageBrain when a newcomer arrives: a migrant waiting for this village comes instead, with his own
        /// name and look. Returns the village he came from, or null.
        /// </summary>
        public static string TakeMigrant(VillageHearth hearth, ref int seed, ref string name)
        {
            string culture = null;
            return TakeMigrant(hearth, ref seed, ref name, ref culture);
        }

        /// <summary>As above; a migrant keeps the culture he had in his old village (a fifth field, when recorded).</summary>
        public static string TakeMigrant(VillageHearth hearth, ref int seed, ref string name, ref string culture)
        {
            if (hearth == null || !hearth.IsValid)
            {
                return null;
            }

            List<string> list = hearth.Zdo.GetString(KeyMigrants, "").Split(';').Where(e => e.Length > 0).ToList();
            string taken = null;
            int today = Living.Today;
            foreach (string entry in list.ToList())
            {
                string[] f = entry.Split('|');
                if (f.Length < 4 || !int.TryParse(f[1], out int s) || !int.TryParse(f[3], out int day) || today - day > 10)
                {
                    list.Remove(entry);
                    continue;
                }

                if (taken == null && day <= today)
                {
                    list.Remove(entry);
                    seed = s;
                    name = f[0];
                    taken = f[2];
                    if (f.Length > 4 && Cultures.Known(f[4]))
                    {
                        culture = f[4];
                    }
                }
            }

            hearth.Zdo.Set(KeyMigrants, string.Join(";", list));
            return taken;
        }

        public static string Migrants(VillageHearth hearth) =>
            string.Join(", ", hearth.Zdo.GetString(KeyMigrants, "").Split(';').Where(e => e.Length > 0)
                .Select(e => e.Split('|')).Where(f => f.Length >= 4).Select(f => $"{f[0]} from {f[2]} (day {f[3]})"));

        /// <summary>Once a day: a village glum for ExodusDays mornings loses its least content villager.</summary>
        public static void Exodus(VillageHearth hearth, VillageState state)
        {
            if (!On || Living.Hour < 8f || Living.Hour > 16f || hearth.Zdo.GetInt(KeyLowDay, -1) == Living.Today)
            {
                return;
            }

            hearth.Zdo.Set(KeyLowDay, Living.Today);
            int low = LogicConfig.ExodusMood != null ? LogicConfig.ExodusMood.Value : 25;
            int days = VillageMood.Get(state.Id) < low ? hearth.Zdo.GetInt(KeyLowDays) + 1 : 0;
            hearth.Zdo.Set(KeyLowDays, days);
            if (days < (LogicConfig.ExodusDays != null ? LogicConfig.ExodusDays.Value : 3))
            {
                return;
            }

            Villager unhappiest = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => !v.IsDead() && v.VillageId == state.Id && !Childhood.IsChild(v) && !Roles.IsJarl(v) && !IsLeaving(v))
                .OrderBy(Moods.Get).FirstOrDefault();
            if (unhappiest != null && Start(unhappiest, "mood"))
            {
                hearth.Zdo.Set(KeyLowDays, 0);
            }
        }

        public static IEnumerable<string> Tags(Villager villager)
        {
            if (villager?.Zdo != null && villager.Zdo.GetString(KeyCameFrom, "").Length > 0 && Personality.IsNewcomer(villager))
            {
                yield return "migrant";
            }
        }

        public static string Fill(string line, Villager villager) =>
            line.Contains("{camefrom}") ? line.Replace("{camefrom}", villager.Zdo?.GetString(KeyCameFrom, "") is string from && from.Length > 0 ? from : "the next village") : line;
    }
}
