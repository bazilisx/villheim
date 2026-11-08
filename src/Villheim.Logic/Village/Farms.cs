using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Farms: rows of the game's own berry bushes and mushroom patches by each farm building, and tamed animals, both
    /// growing with the village on a schedule (Tyler, 2026-11-06) rather than by breeding:
    ///
    /// - Each farm wants 6 plants plus 4 per village tier (at most 18), in rows behind the building (away from the
    ///   hearth), off paths and other buildings. The farmer plants them one at a time (see Villagers.Farming).
    /// - Each farm wants 1 animal plus 1 per tier (at most 4). One new animal comes per in-game day per village: a
    ///   grown boar for a farm with none, a piglet once it has one. So babies come when the village reaches a new
    ///   stage (the farm wants one more) or to take the place of an animal that died or was killed (D-015). They are
    ///   tamed and marked as the village's.
    /// - Village animals never breed by themselves and never eat (NoBreedingPatch, NoEatingPatch): the herd only grows
    ///   on the schedule, and no real food is used. The farmer acts out feeding (Villagers.Farming, Tend). Animals
    ///   tamed by players carry no village mark and behave as in vanilla.
    /// </summary>
    internal static class Farms
    {
        private static readonly int KeyAnimalDay = "villheim_animal_day".GetStableHashCode();

        // Plants by biome: the first that exists is used for each row in turn.
        private static readonly string[] MeadowsPlants = { "RaspberryBush", "Pickable_Mushroom" };
        private static readonly string[] ForestPlants = { "BlueberryBush", "RaspberryBush", "Pickable_Mushroom" };

        private const float RowStep = 1.8f;

        public static int WantedPlants(int tier) => Mathf.Min(18, 6 + 4 * tier);
        public static int WantedAnimals(int tier) => Mathf.Min(4, 1 + tier);

        public static IEnumerable<Plot> FarmPlots(VillageState state) => state.Plots.Where(p => p.Role == nameof(Role.Farm));

        /// <summary>The planting spots of a farm, in order: rows behind the building, on flat open ground.</summary>
        public static List<Vector3> Spots(VillageHearth hearth, Plot farm, int count)
        {
            Vector3 away = farm.Position - hearth.transform.position;
            away.y = 0f;
            away = away.sqrMagnitude > 0.01f ? away.normalized : Vector3.forward;
            Vector3 side = Vector3.Cross(Vector3.up, away);
            Vector3 start = farm.Position + away * (farm.Radius * 0.6f + 2.5f);
            var spots = new List<Vector3>();
            var state = new VillageState(hearth.Zdo);
            HashSet<Vector2Int> network = PathPlanner.Network(hearth);
            for (int row = 0; row < 6 && spots.Count < count; row++)
            {
                for (int col = -3; col <= 3 && spots.Count < count; col++)
                {
                    Vector3 spot = start + away * (row * RowStep) + side * (col * RowStep);
                    if (!ZoneSystem.instance.GetGroundHeight(spot, out float y) || y < ZoneSystem.instance.m_waterLevel + 0.5f ||
                        PathPlanner.DistanceToNetwork(network, spot) < 1.5f ||
                        state.Plots.Any(p => Utils.DistanceXZ(p.Position, spot) < p.Radius * 0.6f + 0.8f))
                    {
                        continue;
                    }

                    spot.y = y;
                    spots.Add(spot);
                }
            }

            return spots;
        }

        public static string PlantFor(VillageState state, int index)
        {
            string[] plants = state.Biome == Heightmap.Biome.BlackForest ? ForestPlants : MeadowsPlants;
            var existing = plants.Where(p => ZNetScene.instance && ZNetScene.instance.GetPrefab(p) != null).ToList();
            return existing.Count == 0 ? null : existing[(index / 6) % existing.Count];
        }

        /// <summary>The next spot on a farm with no plant yet, and what goes there. False when the farm is full.</summary>
        public static bool NextPlanting(VillageHearth hearth, out Vector3 spot, out string prefab)
        {
            spot = Vector3.zero;
            prefab = null;
            var state = new VillageState(hearth.Zdo);
            int tier = VillageBrain.TierIndex(state.Plots.Count);
            foreach (Plot farm in FarmPlots(state))
            {
                List<Vector3> spots = Spots(hearth, farm, WantedPlants(tier));
                for (int i = 0; i < spots.Count; i++)
                {
                    if (!HasPlant(spots[i]))
                    {
                        spot = spots[i];
                        prefab = PlantFor(state, i);
                        return prefab != null;
                    }
                }
            }

            return false;
        }

        public static void Plant(VillageHearth hearth, Vector3 spot, string prefabName)
        {
            GameObject prefab = ZNetScene.instance.GetPrefab(prefabName);
            if (prefab == null || HasPlant(spot))
            {
                return;
            }

            GameObject made = Object.Instantiate(prefab, spot, Quaternion.Euler(0f, Random.Range(0f, 360f), 0f));
            made.GetComponent<ZNetView>()?.GetZDO()?.Set(Keys.BuiltBy, hearth.VillageId);
        }

        private static bool HasPlant(Vector3 spot)
        {
            foreach (Collider collider in Physics.OverlapSphere(spot, 0.7f))
            {
                if (collider.GetComponentInParent<Pickable>() != null)
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>Ripe plants on the village's farms (its own, not wild ones).</summary>
        public static List<Pickable> Ripe(VillageHearth hearth)
        {
            var state = new VillageState(hearth.Zdo);
            var ripe = new List<Pickable>();
            foreach (Plot farm in FarmPlots(state))
            {
                foreach (Collider collider in Physics.OverlapSphere(farm.Position, farm.Radius + 14f))
                {
                    Pickable pickable = collider.GetComponentInParent<Pickable>();
                    ZNetView view = pickable != null ? pickable.GetComponent<ZNetView>() : null;
                    if (view != null && view.IsValid() && !pickable.GetPicked() && view.GetZDO().GetInt(Keys.BuiltBy) == hearth.VillageId &&
                        !ripe.Contains(pickable))
                    {
                        ripe.Add(pickable);
                    }
                }
            }

            return ripe;
        }

        // ---------------------------------------------------------------- animals, on a schedule

        /// <summary>Called with the hearth's tick: at most one new animal per in-game day, and no breeding.</summary>
        public static void Tick(VillageHearth hearth)
        {
            if (EnvMan.instance == null || EnvMan.IsNight())
            {
                return;
            }

            var state = new VillageState(hearth.Zdo);
            List<Plot> farms = FarmPlots(state).ToList();
            if (farms.Count == 0)
            {
                return;
            }

            int tier = VillageBrain.TierIndex(state.Plots.Count);
            int day = EnvMan.instance.GetDay();
            foreach (Plot farm in farms)
            {
                List<Character> herd = Herd(hearth, farm);
                foreach (Character animal in herd)
                {
                    // The game's own breeding stays off: the village decides how many animals there are (the
                    // component switched off, and NoBreedingPatch, since its timer runs even when it is off).
                    Procreation procreation = animal.GetComponent<Procreation>();
                    if (procreation != null && procreation.enabled)
                    {
                        procreation.enabled = false;
                    }
                }

                if (herd.Count >= WantedAnimals(tier) || hearth.Zdo.GetInt(KeyAnimalDay, -1) == day)
                {
                    continue;
                }

                string kind = herd.Count == 0 ? "Boar" : "Boar_piggy";
                GameObject prefab = ZNetScene.instance.GetPrefab(kind) ?? ZNetScene.instance.GetPrefab("Boar");
                List<Vector3> spots = Spots(hearth, farm, 4);
                if (prefab == null || spots.Count == 0)
                {
                    continue;
                }

                Vector3 spot = spots[Random.Range(0, spots.Count)] + Vector3.up * 0.5f;
                GameObject made = Object.Instantiate(prefab, spot, Quaternion.Euler(0f, Random.Range(0f, 360f), 0f));
                made.GetComponent<ZNetView>()?.GetZDO()?.Set(Keys.BuiltBy, hearth.VillageId);
                made.GetComponent<Tameable>()?.Tame();
                Procreation breeding = made.GetComponent<Procreation>();
                if (breeding != null)
                {
                    breeding.enabled = false;
                }

                hearth.Zdo.Set(KeyAnimalDay, day);
                Chronicle.Add(hearth, herd.Count == 0 ? "The farm got its first boar." : "A piglet joined the farm's herd.");
                VillheimPlugin.Debug($"{state.Name}: a {kind} came to the farm ({herd.Count + 1}/{WantedAnimals(tier)}).");
                return;
            }
        }

        /// <summary>The village's animals near a farm: only those it spawned, and piglets of its own that grew up.</summary>
        public static List<Character> Herd(VillageHearth hearth, Plot farm)
        {
            var herd = new List<Character>();
            foreach (Character c in Character.GetAllCharacters())
            {
                if (c == null || c.IsDead() || c is Villager || c.IsPlayer() || c.m_nview == null || !c.m_nview.IsValid() ||
                    Utils.DistanceXZ(c.transform.position, farm.Position) > farm.Radius + 25f)
                {
                    continue;
                }

                // Only animals the village spawned (or that grew from one, see GrowUpPatch). No other animal is ever
                // claimed: a player's tamed boar or wolf near a farm stays the player's and keeps its normal look.
                if (c.m_nview.GetZDO().GetInt(Keys.BuiltBy) == hearth.VillageId)
                {
                    herd.Add(c);
                }
            }

            return herd;
        }

        /// <summary>The animal was spawned by a village (or grew up from one of its piglets).</summary>
        private static bool IsVillageAnimal(Component component)
        {
            ZNetView view = component != null ? component.GetComponent<ZNetView>() : null;
            return view != null && view.IsValid() && view.GetZDO().GetInt(Keys.BuiltBy) != 0;
        }

        /// <summary>Village animals never breed by themselves (D-015). The game's breeding check runs on a timer.</summary>
        [HarmonyLib.HarmonyPatch(typeof(Procreation), nameof(Procreation.Procreate))]
        internal static class NoBreedingPatch
        {
            private static bool Prefix(Procreation __instance) => !IsVillageAnimal(__instance);
        }

        /// <summary>Village animals never eat food lying about (D-015: no real food is used).</summary>
        [HarmonyLib.HarmonyPatch(typeof(MonsterAI), nameof(MonsterAI.UpdateConsumeItem))]
        internal static class NoEatingPatch
        {
            private static bool Prefix(MonsterAI __instance, ref bool __result)
            {
                if (!IsVillageAnimal(__instance))
                {
                    return true;
                }

                __result = false;
                return false;
            }
        }

        /// <summary>
        /// A piglet growing up is replaced by a new adult object, which would lose the village's mark. The mark is
        /// handed to the adult that appears where the village's piglet stood, in the same moment.
        /// </summary>
        [HarmonyLib.HarmonyPatch(typeof(Growup), nameof(Growup.GrowUpdate))]
        internal static class GrowUpPatch
        {
            private static void Prefix(Growup __instance, out (int Village, Vector3 Position) __state)
            {
                ZNetView view = __instance != null ? __instance.GetComponent<ZNetView>() : null;
                int village = view != null && view.IsValid() ? view.GetZDO().GetInt(Keys.BuiltBy) : 0;
                __state = (village, __instance != null ? __instance.transform.position : Vector3.zero);
            }

            private static void Postfix((int Village, Vector3 Position) __state)
            {
                if (__state.Village == 0)
                {
                    return;
                }

                foreach (Character grown in Character.GetAllCharacters())
                {
                    ZNetView view = grown != null ? grown.m_nview : null;
                    if (view != null && view.IsValid() && view.IsOwner() && view.GetZDO().GetInt(Keys.BuiltBy) == 0 &&
                        grown.GetComponent<Growup>() == null && Vector3.Distance(grown.transform.position, __state.Position) < 0.6f)
                    {
                        view.GetZDO().Set(Keys.BuiltBy, __state.Village);
                        return;
                    }
                }
            }
        }
    }
}
