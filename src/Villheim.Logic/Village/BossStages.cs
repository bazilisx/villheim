using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Villagers;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Boss trophies open the next stage (proposal 10, after VikingColonies' and Friendlies' boss tiers and
    /// MineColonies' research gates; ideas only, our own code). Needs WorldLife and BossStageCap on. Off by default:
    /// growth follows materials, people and needs, never bosses felled (Tyler, 2026-11-08, D-004). The code is kept.
    ///
    /// - A village can grow to stage BossStageStart (2, a hamlet) plus one per boss felled: the world's boss keys
    ///   (defeated_eikthyr and the rest), the boss trophies hung on item stands within the village, or either
    ///   (BossStageSource). Stages: 1 camp, 2 hamlet, 3 village, 4 town.
    /// - A new building that would take the village past its stage waits ("Waiting for ..."). Upgrades still happen,
    ///   and a home always goes up while some villager has no bed.
    /// - Once a game hour the hearth's owner looks for trophies on item stands within the village. A new one: a chronicle
    ///   line, "bossdown" for everyone (+8). A stage opened: a chronicle line and the event "stageopen".
    /// - Tags stagecap (growth waits on a boss); fill-in {nextboss}.
    /// </summary>
    internal static class BossStages
    {
        public const string WaitingPrefix = "the next boss";

        private static readonly (string Key, string Trophy, string Name)[] Bosses =
        {
            ("defeated_eikthyr", "TrophyEikthyr", "Eikthyr"), ("defeated_gdking", "TrophyTheElder", "the Elder"),
            ("defeated_bonemass", "TrophyBonemass", "Bonemass"), ("defeated_dragon", "TrophyDragonQueen", "Moder"),
            ("defeated_goblinking", "TrophyGoblinKing", "Yagluth"), ("defeated_queen", "TrophySeekerQueen", "the Queen"),
            ("defeated_fader", "TrophyFader", "Fader"),
        };

        private static readonly int KeyTrophies = "villheim_trophies".GetStableHashCode();
        private static readonly int KeyCount = "villheim_bosscount".GetStableHashCode();
        private static readonly int KeyAt = "villheim_trophies_at".GetStableHashCode();

        public static bool On => Living.World && Living.On(LogicConfig.BossStages);

        private static string Source => LogicConfig.BossStageSource != null ? LogicConfig.BossStageSource.Value.ToLowerInvariant() : "either";

        private static HashSet<string> Hung(VillageHearth hearth) =>
            new HashSet<string>(hearth.Zdo.GetString(KeyTrophies, "").Split(',').Where(t => t.Length > 0));

        /// <summary>Which bosses count for this village, by index.</summary>
        private static HashSet<int> Felled(VillageHearth hearth)
        {
            var felled = new HashSet<int>();
            HashSet<string> hung = Hung(hearth);
            for (int i = 0; i < Bosses.Length; i++)
            {
                bool key = ZoneSystem.instance != null && ZoneSystem.instance.GetGlobalKey(Bosses[i].Key);
                bool trophy = hung.Contains(Bosses[i].Trophy);
                if ((Source != "trophies" && key) || (Source != "keys" && trophy))
                {
                    felled.Add(i);
                }
            }

            return felled;
        }

        public static int Cap(VillageHearth hearth)
        {
            int start = LogicConfig.BossStageStart != null ? LogicConfig.BossStageStart.Value : 2;
            return Mathf.Clamp(start + Felled(hearth).Count, 1, 4);
        }

        private static string NextBoss(VillageHearth hearth)
        {
            HashSet<int> felled = Felled(hearth);
            for (int i = 0; i < Bosses.Length; i++)
            {
                if (!felled.Contains(i))
                {
                    return Bosses[i].Name;
                }
            }

            return "the next boss";
        }

        /// <summary>True when the next new building would take the village past its stage.</summary>
        public static bool Blocks(VillageHearth hearth, VillageState state, out string why)
        {
            why = null;
            if (!On)
            {
                return false;
            }

            int next = VillageBrain.TierIndex(state.Plots.Count + 1) + 1;
            if (next <= Cap(hearth) || Beds.Of(hearth).Count < VillageBrain.CountVillagers(state.Id))
            {
                return false;
            }

            why = $"{WaitingPrefix} to fall ({NextBoss(hearth)}) before it grows to a {VillageBrain.Tier(state.Plots.Count + 1).ToLowerInvariant()}";
            return true;
        }

        public static void Tick(VillageHearth hearth, VillageState state)
        {
            if (!On)
            {
                return;
            }

            ZDO zdo = hearth.Zdo;
            double at = zdo.GetLong(KeyAt) / 10.0;
            if (at > 0.0 && Living.Now >= at && Living.Now - at < VillageBrain.DayLength() / 24.0)
            {
                return;
            }

            zdo.Set(KeyAt, (long)(Living.Now * 10.0));
            HashSet<string> hung = Hung(hearth);
            float radius = VillheimConfig.VillageRadius.Value + 10f;
            foreach (Collider collider in Physics.OverlapSphere(hearth.transform.position, radius, LayerMask.GetMask("piece", "piece_nonsolid")))
            {
                ItemStand stand = collider.GetComponentInParent<ItemStand>();
                ZNetView view = stand != null ? stand.GetComponent<ZNetView>() : null;
                string item = view != null && view.IsValid() ? Designs.StandItems.ItemName(view.GetZDO()) : "";
                var boss = Bosses.FirstOrDefault(b => b.Trophy == item);
                if (boss.Trophy != null && hung.Add(item))
                {
                    Chronicle.Add(hearth, $"The trophy of {boss.Name} hangs in {state.Name} now.");
                    Moods.VillageThink(state.Id, "bossdown");
                    Dialogue.Note(state.Id, "trophy");
                }
            }

            zdo.Set(KeyTrophies, string.Join(",", hung));
            int count = Felled(hearth).Count;
            int before = zdo.GetInt(KeyCount, -1);
            zdo.Set(KeyCount, count);
            if (before >= 0 && count > before && Cap(hearth) <= 4)
            {
                Chronicle.Add(hearth, $"With another great foe gone, {state.Name} can grow to a {VillageBrain.Tier(TierStart(Cap(hearth))).ToLowerInvariant()}.");
                Dialogue.Note(state.Id, "stageopen");
            }
        }

        /// <summary>Fewest buildings that make a stage (for its name).</summary>
        private static int TierStart(int stage) => stage <= 1 ? 1 : stage == 2 ? 2 : stage == 3 ? 4 : 7;

        public static IEnumerable<string> Tags(VillageHearth hearth)
        {
            if (On && new VillageState(hearth.Zdo).Waiting.StartsWith(WaitingPrefix))
            {
                yield return "stagecap";
            }
        }

        public static string Fill(string line, Villager villager)
        {
            if (!line.Contains("{nextboss}"))
            {
                return line;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            return line.Replace("{nextboss}", hearth != null && hearth.IsValid ? NextBoss(hearth) : "the great stag");
        }

        public static string Describe(VillageHearth hearth)
        {
            var state = new VillageState(hearth.Zdo);
            HashSet<int> felled = Felled(hearth);
            return $"boss stages {(On ? "on" : "off (needs WorldLife and BossStageCap)")}: stage {Living.Stage(state)} of at most {Cap(hearth)}; " +
                   $"felled ({Source}): {(felled.Count > 0 ? string.Join(", ", felled.Select(i => Bosses[i].Name)) : "none")}; " +
                   $"trophies hung: {(Hung(hearth).Count > 0 ? string.Join(", ", Hung(hearth)) : "none")}";
        }
    }
}
