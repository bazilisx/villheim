using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using HarmonyLib;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Villages and the land's own creatures keep out of each other's way (T-24), so the Plains and the Mistlands,
    /// where there are far more creatures than elsewhere, are not one long fight.
    ///
    /// - Creatures in KeepApartCreatures (name: meters) are no enemy of a villager until he is within those meters of
    ///   them (0: never, as for lox), or the creature is inside his village, or he is inside one of their camps. A
    ///   postfix on BaseAI.IsEnemy, so it holds for both sides: the creature does not go for the villager, and the
    ///   villager does not go for the creature.
    /// - The same creatures turn back before they come within KeepApartMargin of a village's edge: a prefix on
    ///   MonsterAI.UpdateAI walks one that has wandered close back out, and moves the point it roams around out
    ///   with it, unless it is fighting someone. Checked once a second per creature.
    /// - Villagers keep away from the camps in KeepApartAvoid (fuling villages, tar pits) when they look for trees,
    ///   rocks, game and berries (Knowledge.MayWork asks <see cref="Avoids"/>).
    /// </summary>
    internal static class KeepApart
    {
        private static bool On => LogicConfig.IsOn(LogicConfig.KeepApart);

        // ---------------------------------------------------------------- the lists

        private static string _creaturesText;
        private static Dictionary<string, float> _creatures = new Dictionary<string, float>(StringComparer.OrdinalIgnoreCase);
        private static string _avoidText;
        private static List<(string Prefix, float Meters)> _avoid = new List<(string, float)>();

        private static Dictionary<string, float> Creatures()
        {
            string text = LogicConfig.KeepApartCreatures?.Value ?? "";
            if (text != _creaturesText)
            {
                _creaturesText = text;
                _creatures = new Dictionary<string, float>(StringComparer.OrdinalIgnoreCase);
                foreach ((string name, float meters) in Pairs(text))
                {
                    _creatures[name] = meters;
                }

                RuleCache.Clear();
            }

            return _creatures;
        }

        private static List<(string Prefix, float Meters)> AvoidList()
        {
            string text = LogicConfig.KeepApartAvoid?.Value ?? "";
            if (text != _avoidText)
            {
                _avoidText = text;
                _avoid = Pairs(text).ToList();
                Zones.Clear();
            }

            return _avoid;
        }

        private static IEnumerable<(string, float)> Pairs(string text)
        {
            foreach (string part in (text ?? "").Split(','))
            {
                string[] bits = part.Split(':');
                if (bits.Length == 2 && bits[0].Trim().Length > 0 &&
                    float.TryParse(bits[1].Trim(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out float meters))
                {
                    yield return (bits[0].Trim(), meters);
                }
            }
        }

        // Per creature instance: its keep-apart radius, or null when it is not on the list.
        private static readonly Dictionary<int, float?> RuleCache = new Dictionary<int, float?>();

        private static float? RuleFor(Character creature)
        {
            int id = creature.GetInstanceID();
            if (RuleCache.TryGetValue(id, out float? rule))
            {
                return rule;
            }

            if (RuleCache.Count > 4000)
            {
                RuleCache.Clear();
            }

            rule = Creatures().TryGetValue(Utils.GetPrefabName(creature.gameObject), out float meters) ? meters : (float?)null;
            RuleCache[id] = rule;
            return rule;
        }

        // ---------------------------------------------------------------- the places villagers stay away from

        private sealed class ZoneList
        {
            public float Time;
            public List<(Vector3 Position, float Meters)> Zones;
        }

        private static readonly Dictionary<int, ZoneList> Zones = new Dictionary<int, ZoneList>();

        /// <summary>The camps near a village that its people keep away from, worked out every five minutes.</summary>
        private static List<(Vector3 Position, float Meters)> ZonesNear(int villageId, Vector3 hearth)
        {
            List<(string Prefix, float Meters)> avoid = AvoidList();
            if (Zones.TryGetValue(villageId, out ZoneList cached) && Time.time - cached.Time < 300f)
            {
                return cached.Zones;
            }

            var list = new List<(Vector3, float)>();
            if (ZoneSystem.instance != null && avoid.Count > 0)
            {
                float reach = VillheimConfig.VillageRadius.Value + (LogicConfig.HarvestReachMax?.Value ?? 90f) + 150f;
                foreach (ZoneSystem.LocationInstance instance in ZoneSystem.instance.m_locationInstances.Values)
                {
                    string name = instance.m_location?.m_prefabName ?? "";
                    if (Utils.DistanceXZ(instance.m_position, hearth) > reach)
                    {
                        continue;
                    }

                    foreach ((string prefix, float meters) in avoid)
                    {
                        if (name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                        {
                            list.Add((instance.m_position, meters));
                            break;
                        }
                    }
                }
            }

            Zones[villageId] = new ZoneList { Time = Time.time, Zones = list };
            return list;
        }

        /// <summary>True when a villager of this village should not go to <paramref name="at"/> to work.</summary>
        public static bool Avoids(int villageId, Vector3 hearth, Vector3 at)
        {
            if (!On || villageId == 0)
            {
                return false;
            }

            foreach ((Vector3 position, float meters) in ZonesNear(villageId, hearth))
            {
                if (Utils.DistanceXZ(position, at) < meters)
                {
                    return true;
                }
            }

            return false;
        }

        private static bool InAnyZone(Villager villager)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            return hearth != null && hearth.IsValid && Avoids(villager.VillageId, hearth.transform.position, villager.transform.position);
        }

        private static bool InsideVillage(Vector3 at, int villageId)
        {
            VillageHearth hearth = VillageHearth.Find(villageId);
            return hearth != null && hearth.IsValid && Utils.DistanceXZ(hearth.transform.position, at) < VillheimConfig.VillageRadius.Value;
        }

        // ---------------------------------------------------------------- enemies or not

        /// <summary>
        /// Whether a villager and a listed creature leave each other alone right now. Lox (0 m) always do; the others
        /// unless they are within their meters of each other, the creature is inside the village, or the villager is
        /// inside one of their camps.
        /// </summary>
        public static bool AtPeace(Villager villager, Character creature)
        {
            if (!On || villager == null || creature == null || creature is Villager || creature is Player || creature.IsTamed())
            {
                return false;
            }

            float? meters = RuleFor(creature);
            if (!meters.HasValue)
            {
                return false;
            }

            if (meters.Value <= 0f)
            {
                return true;
            }

            if (Vector3.Distance(villager.transform.position, creature.transform.position) <= meters.Value)
            {
                return false;
            }

            return !InsideVillage(creature.transform.position, villager.VillageId) && !InAnyZone(villager);
        }

        [HarmonyPatch(typeof(BaseAI), nameof(BaseAI.IsEnemy), typeof(Character), typeof(Character))]
        internal static class EnemyPatch
        {
            private static void Postfix(Character a, Character b, ref bool __result)
            {
                if (!__result)
                {
                    return;
                }

                try
                {
                    // The village's own animals and its people are never enemies (T-57).
                    if (a is Villager && Villagers.Animals.IsVillageAnimal(b) || b is Villager && Villagers.Animals.IsVillageAnimal(a) ||
                        a is Villager va && AtPeace(va, b) || b is Villager vb && AtPeace(vb, a))
                    {
                        __result = false;
                    }
                }
                catch (Exception ex)
                {
                    VillheimPlugin.Debug($"KeepApart: {ex.Message}");
                }
            }
        }

        // ---------------------------------------------------------------- turning back

        private sealed class Turn
        {
            public float Next;
            public Vector3? Away;
        }

        private static readonly ConditionalWeakTable<MonsterAI, Turn> Turns = new ConditionalWeakTable<MonsterAI, Turn>();

        /// <summary>Where a listed creature near a village should walk to instead, or null to leave it be.</summary>
        private static Vector3? AwayPoint(MonsterAI ai)
        {
            Character creature = ai.m_character;
            if (creature == null || creature.IsDead() || creature.IsTamed() || !RuleFor(creature).HasValue)
            {
                return null;
            }

            // Fighting a player or a villager close by: left to the fight.
            Character target = ai.GetTargetCreature();
            if (target is Player || (target is Villager && Vector3.Distance(target.transform.position, creature.transform.position) <= Mathf.Max(RuleFor(creature) ?? 0f, 4f)))
            {
                return null;
            }

            float margin = Mathf.Max(0f, LogicConfig.KeepApartMargin?.Value ?? 25f);
            float radius = VillheimConfig.VillageRadius.Value;
            Vector3 position = creature.transform.position;
            foreach (VillageHearth hearth in VillageHearth.All)
            {
                if (hearth == null || !hearth.IsValid)
                {
                    continue;
                }

                Vector3 center = hearth.transform.position;
                float distance = Utils.DistanceXZ(center, position);
                if (distance >= radius + margin)
                {
                    continue;
                }

                Vector3 out_ = (position - center).Horizontal();
                if (out_.sqrMagnitude < 0.01f)
                {
                    out_ = Vector3.forward;
                }

                Vector3 away = center + out_.normalized * (radius + margin + 15f);
                if (ZoneSystem.instance != null && ZoneSystem.instance.GetGroundHeight(away, out float y))
                {
                    away.y = y;
                }

                return away;
            }

            return null;
        }

        [HarmonyPatch(typeof(MonsterAI), nameof(MonsterAI.UpdateAI))]
        internal static class TurnBackPatch
        {
            private static bool Prefix(MonsterAI __instance, float dt, ref bool __result)
            {
                if (!On || __instance is VillagerAI)
                {
                    return true;
                }

                try
                {
                    Turn turn = Turns.GetOrCreateValue(__instance);
                    if (Time.time >= turn.Next)
                    {
                        turn.Next = Time.time + 1f + UnityEngine.Random.Range(0f, 0.3f);
                        turn.Away = AwayPoint(__instance);
                        if (turn.Away.HasValue)
                        {
                            // It forgets the village and roams out there from now on.
                            __instance.m_spawnPoint = turn.Away.Value;
                            if (__instance.GetTargetCreature() is Villager)
                            {
                                __instance.m_targetCreature = null;
                            }

                            __instance.m_targetStatic = null;
                        }
                    }

                    if (!turn.Away.HasValue)
                    {
                        return true;
                    }

                    if (__instance.MoveTo(dt, turn.Away.Value, 3f, false))
                    {
                        turn.Away = null;
                    }

                    __result = true;
                    return false;
                }
                catch (Exception ex)
                {
                    VillheimPlugin.Debug($"KeepApart turn: {ex.Message}");
                    return true;
                }
            }
        }

        /// <summary>For 'vh keepapart': the lists and what the nearest village keeps away from.</summary>
        public static string Command()
        {
            Player player = Player.m_localPlayer;
            VillageHearth hearth = player != null ? VillageHearth.Closest(player.transform.position, 300f) : null;
            string head = $"KeepApart {(On ? "on" : "off")}: creatures {string.Join(", ", Creatures().Select(c => $"{c.Key} {c.Value:0} m"))}; " +
                          $"turn back {LogicConfig.KeepApartMargin?.Value ?? 25f:0} m before the edge.";
            if (hearth == null || !hearth.IsValid)
            {
                return head + "\n   No village within 300 m.";
            }

            Zones.Remove(hearth.VillageId);
            List<(Vector3 Position, float Meters)> zones = ZonesNear(hearth.VillageId, hearth.transform.position);
            return head + $"\n   {hearth.VillageName} keeps away from {zones.Count} camp(s)" +
                   (zones.Count > 0
                       ? ": " + string.Join(", ", zones.Select(z => $"{Utils.DistanceXZ(z.Position, hearth.transform.position):0} m off ({z.Meters:0} m clear)"))
                       : ".");
        }
    }
}
