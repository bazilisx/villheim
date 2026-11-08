using System;
using System.Collections.Generic;
using System.Linq;
using HarmonyLib;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Wood for Mistlands villages (D-052). No ordinary tree grows in the Mistlands, so a Mistlands village plants the
    /// game's own Yggdrasil shoots in its copse (Groves, Replanting) and marks each with its village id. A small shoot
    /// grows into a full one after YggaGrowDays.
    ///
    /// When the village's own people fell one of their shoots, or a wild one in the Mistlands near them (T-55), it drops
    /// ordinary wood and fine wood instead of Yggdrasil wood (YggdrasilYield for each piece), and so do its logs (marked
    /// as they are made). Anyone else who fells one gets the game's own drops. Villagers' axes are strong enough for
    /// these shoots whatever the tier.
    /// </summary>
    internal static class VillageWood
    {
        private static readonly int KeyVillage = "villheim_vwood".GetStableHashCode();
        private static readonly int KeyPlanted = "villheim_vwood_day".GetStableHashCode();

        private static readonly string[] Small = { "YggaShoot_small1" };
        private static readonly string[] Big = { "YggaShoot1", "YggaShoot2", "YggaShoot3" };

        private static int Today => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;

        private static List<string> Existing(IEnumerable<string> names) =>
            names.Where(n => ZNetScene.instance != null && ZNetScene.instance.GetPrefab(n) != null).ToList();

        /// <summary>The shoot a Mistlands village plants: a small one if the game has it, else a full one. Null if none.</summary>
        public static string MistlandsShoot()
        {
            List<string> small = Existing(Small);
            if (small.Count > 0)
            {
                return small[UnityEngine.Random.Range(0, small.Count)];
            }

            List<string> big = Existing(Big);
            return big.Count > 0 ? big[UnityEngine.Random.Range(0, big.Count)] : null;
        }

        public static bool IsShoot(string prefabName) => prefabName != null && prefabName.StartsWith("YggaShoot");

        private static ZDO ZdoOf(GameObject go)
        {
            ZNetView view = go != null ? go.GetComponentInParent<ZNetView>() : null;
            return view != null && view.IsValid() ? view.GetZDO() : null;
        }

        /// <summary>The village that planted this tree or log, or 0.</summary>
        public static int VillageOf(GameObject go) => ZdoOf(go)?.GetInt(KeyVillage) ?? 0;

        /// <summary>True for a tree or log a village planted (its people get plain wood from it).</summary>
        public static bool IsVillageWood(GameObject go) =>
            go != null && (go.GetComponent<TreeBase>() != null || go.GetComponent<TreeLog>() != null) && VillageOf(go) != 0;

        /// <summary>A wild Yggdrasil shoot or its log: villagers fell these for wood like their own (T-55).</summary>
        public static bool IsWildShoot(GameObject go) =>
            go != null && (go.GetComponent<TreeBase>() != null || go.GetComponent<TreeLog>() != null) && VillageOf(go) == 0 &&
            Utils.GetPrefabName(go).StartsWith("YggaShoot", StringComparison.OrdinalIgnoreCase);

        /// <summary>What a villager gets from a shoot: ordinary and fine wood (or the village's own: also that).</summary>
        public static bool GivesWood(GameObject go) => IsVillageWood(go) || IsWildShoot(go);

        /// <summary>The village of the villager behind the hit, or 0.</summary>
        private static int VillageOfHit(HitData hit) => hit?.GetAttacker() is Villager villager ? villager.VillageId : 0;

        /// <summary>YggdrasilYield: what one piece of Yggdrasil wood counts as, "Wood:2, FineWood:1".</summary>
        private static List<(string Item, int Amount)> Yield()
        {
            var yield = new List<(string, int)>();
            foreach (string part in (LogicConfig.YggdrasilYield?.Value ?? "Wood:2, FineWood:1").Split(','))
            {
                string[] pair = part.Split(':');
                if (pair.Length == 2 && int.TryParse(pair[1].Trim(), out int amount) && amount > 0)
                {
                    yield.Add((pair[0].Trim(), amount));
                }
            }

            return yield.Count > 0 ? yield : new List<(string, int)> { ("Wood", 1) };
        }

        /// <summary>Marks something just planted (or a log just made) as the village's own.</summary>
        public static void Mark(GameObject go, int villageId)
        {
            ZDO zdo = ZdoOf(go);
            if (zdo == null || villageId == 0)
            {
                return;
            }

            zdo.Set(KeyVillage, villageId);
            if (zdo.GetInt(KeyPlanted, -1) < 0)
            {
                zdo.Set(KeyPlanted, Today);
            }
        }

        // ---------------------------------------------------------------- growing

        /// <summary>
        /// Once a day from the copse tick: the village's small shoots that are old enough are swapped for full ones.
        /// </summary>
        public static void Grow(VillageHearth hearth)
        {
            int days = Mathf.Max(0, LogicConfig.YggaGrowDays?.Value ?? 2);
            List<string> big = Existing(Big);
            if (big.Count == 0 || ZNetScene.instance == null)
            {
                return;
            }

            float reach = VillheimConfig.VillageRadius.Value + 60f;
            var shoots = Physics.OverlapSphere(hearth.transform.position, reach)
                .Select(c => c.GetComponentInParent<TreeBase>()).Where(t => t != null).Distinct().ToList();
            foreach (TreeBase tree in shoots)
            {
                ZDO zdo = ZdoOf(tree.gameObject);
                string name = Utils.GetPrefabName(tree.gameObject);
                if (zdo == null || zdo.GetInt(KeyVillage) != hearth.VillageId || !Small.Contains(name) ||
                    Today - zdo.GetInt(KeyPlanted, Today) < days)
                {
                    continue;
                }

                Vector3 at = tree.transform.position;
                Quaternion turn = tree.transform.rotation;
                tree.m_nview.ClaimOwnership();
                ZNetScene.instance.Destroy(tree.gameObject);
                GameObject grown = Object.Instantiate(ZNetScene.instance.GetPrefab(big[UnityEngine.Random.Range(0, big.Count)]), at, turn);
                Mark(grown, hearth.VillageId);
                VillheimPlugin.Debug($"{hearth.VillageName}: a Yggdrasil shoot in the copse has grown.");
            }
        }

        // ---------------------------------------------------------------- plain wood for the village's own people

        private static readonly Dictionary<DropTable, DropTable> WoodTables = new Dictionary<DropTable, DropTable>();

        private static string _yieldFrom;

        /// <summary>
        /// The same drops with Yggdrasil wood swapped for YggdrasilYield (ordinary and fine wood by default): each roll
        /// that would have given Yggdrasil wood gives one of them, its amount times the yield.
        /// </summary>
        private static DropTable WoodTable(DropTable source)
        {
            if (source == null || ObjectDB.instance == null)
            {
                return source;
            }

            string config = LogicConfig.YggdrasilYield?.Value ?? "";
            if (config != _yieldFrom)
            {
                WoodTables.Clear();
                _yieldFrom = config;
            }

            if (WoodTables.TryGetValue(source, out DropTable cached))
            {
                return cached;
            }

            List<(string Item, int Amount)> yield = Yield();
            DropTable table = source.Clone();
            var drops = new List<DropTable.DropData>();
            foreach (DropTable.DropData d in source.m_drops ?? new List<DropTable.DropData>())
            {
                if (d.m_item == null || !d.m_item.name.StartsWith("YggdrasilWood"))
                {
                    drops.Add(d);
                    continue;
                }

                foreach ((string item, int amount) in yield)
                {
                    GameObject prefab = ObjectDB.instance.GetItemPrefab(item);
                    if (prefab == null)
                    {
                        continue;
                    }

                    DropTable.DropData copy = d;
                    copy.m_item = prefab;
                    copy.m_stackMin = Mathf.Max(1, d.m_stackMin * amount);
                    copy.m_stackMax = Mathf.Max(copy.m_stackMin, d.m_stackMax * amount);
                    drops.Add(copy);
                }
            }

            table.m_drops = drops;

            WoodTables[source] = table;
            return table;
        }

        // While a village's tree or log breaks under a villager's axe: the village, so the logs it makes are marked.
        private static int _spawningFor;

        private static bool ByVillager(HitData hit) => hit != null && hit.GetAttacker() is Villager;

        private sealed class Swap
        {
            public DropTable Table;
        }

        [HarmonyPatch(typeof(TreeBase), nameof(TreeBase.RPC_Damage))]
        internal static class TreeDamagePatch
        {
            private static void Prefix(TreeBase __instance, HitData hit, out Swap __state)
            {
                __state = null;
                try
                {
                    int village = VillageOf(__instance.gameObject);
                    if (village == 0 && ByVillager(hit) && IsWildShoot(__instance.gameObject))
                    {
                        village = VillageOfHit(hit); // a wild shoot near a Mistlands village (T-55)
                    }

                    if (village == 0 || !ByVillager(hit))
                    {
                        return;
                    }

                    hit.m_toolTier = (short)Mathf.Max(hit.m_toolTier, __instance.m_minToolTier);
                    __state = new Swap { Table = __instance.m_dropWhenDestroyed };
                    __instance.m_dropWhenDestroyed = WoodTable(__instance.m_dropWhenDestroyed);
                    _spawningFor = village;
                }
                catch (Exception ex)
                {
                    VillheimPlugin.Debug($"Village wood: {ex.Message}");
                }
            }

            private static void Postfix(TreeBase __instance, Swap __state)
            {
                if (__state != null)
                {
                    __instance.m_dropWhenDestroyed = __state.Table;
                    _spawningFor = 0;
                }
            }
        }

        [HarmonyPatch(typeof(TreeLog), nameof(TreeLog.RPC_Damage))]
        internal static class LogDamagePatch
        {
            private static void Prefix(TreeLog __instance, HitData hit, out Swap __state)
            {
                __state = null;
                try
                {
                    int village = VillageOf(__instance.gameObject);
                    if (village == 0 && ByVillager(hit) && IsWildShoot(__instance.gameObject))
                    {
                        village = VillageOfHit(hit); // a wild shoot near a Mistlands village (T-55)
                    }

                    if (village == 0 || !ByVillager(hit))
                    {
                        return;
                    }

                    hit.m_toolTier = (short)Mathf.Max(hit.m_toolTier, __instance.m_minToolTier);
                    __state = new Swap { Table = __instance.m_dropWhenDestroyed };
                    __instance.m_dropWhenDestroyed = WoodTable(__instance.m_dropWhenDestroyed);
                    _spawningFor = village;
                }
                catch (Exception ex)
                {
                    VillheimPlugin.Debug($"Village wood: {ex.Message}");
                }
            }

            private static void Postfix(TreeLog __instance, Swap __state)
            {
                if (__state != null)
                {
                    __instance.m_dropWhenDestroyed = __state.Table;
                    _spawningFor = 0;
                }
            }
        }

        /// <summary>A log made while a village's own tree or log breaks under a villager's axe is the village's too.</summary>
        [HarmonyPatch(typeof(TreeLog), nameof(TreeLog.Awake))]
        internal static class LogMadePatch
        {
            private static void Postfix(TreeLog __instance)
            {
                if (_spawningFor != 0)
                {
                    Mark(__instance.gameObject, _spawningFor);
                }
            }
        }
    }
}
