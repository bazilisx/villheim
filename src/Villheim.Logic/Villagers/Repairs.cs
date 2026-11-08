using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Designs;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// The builder mends the village when there is nothing to build. Structural work comes first:
    ///
    /// 1. pieces of a finished building that were destroyed are put back where the design has them, ground up, with the
    ///    ground levelled under a floor or bottom wall first, paid from the village chest;
    /// 2. then badly damaged pieces (under half health) are repaired,
    /// 3. then lightly damaged ones (under 90%).
    ///
    /// He walks to the piece, taps it with the hammer for a moment and it is mended. Finished buildings are checked
    /// for missing pieces one at a time, every minute and a half.
    /// </summary>
    internal static class Repairs
    {
        private const float HammerSeconds = 2.5f;
        private const float ScanSeconds = 90f;

        private sealed class Job
        {
            public Palisade.Segment Fence;
            public WearNTear Damaged;
            public DesignSpawner.PlanEntry Missing;
            public Plot Plot;
            public Dictionary<string, int> Cost;
            public Vector3 Position;
        }

        private sealed class State
        {
            public Job Job;
            public float Timer;
            public float GiveUpAt;
            public float NextLook;
        }

        private sealed class VillageScan
        {
            public float NextScan;
            public int NextPlot;
            public readonly List<Job> Missing = new List<Job>();
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();
        private static readonly Dictionary<int, VillageScan> Scans = new Dictionary<int, VillageScan>();

        public static string Describe(Villager villager)
        {
            if (!States.TryGetValue(villager, out State state) || state.Job == null)
            {
                return null;
            }

            if (state.Job.Fence != null)
            {
                return state.Job.Fence.Remove != null ? "taking down the old fence" : "putting up the fence";
            }

            return state.Job.Missing != null ? "putting back a broken piece" : "repairing";
        }

        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            if (EnvMan.IsNight() || !Chores.IsVillageBuilder(villager))
            {
                return false;
            }

            State state = States.GetOrCreateValue(villager);
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid)
            {
                return false;
            }

            if (state.Job == null || !StillNeeded(state.Job))
            {
                state.Job = null;
                if (Time.time < state.NextLook)
                {
                    return false;
                }

                state.NextLook = Time.time + 5f;
                state.Job = Next(hearth);
                if (state.Job == null)
                {
                    return false;
                }

                state.Timer = 0f;
                state.GiveUpAt = Time.time + 40f;
                Walker.For(villager).Reset();
            }

            Job job = state.Job;
            float reach = Utils.DistanceXZ(villager.transform.position, job.Position);
            if (reach > 2.6f)
            {
                Vector3 toMe = villager.transform.position - job.Position;
                toMe.y = 0f;
                Vector3 stand = job.Position + (toMe.sqrMagnitude > 0.01f ? toMe.normalized : Vector3.forward) * 1.6f;
                if (Walker.For(villager).Go(villager, ai, dt, stand, 0.6f) == WalkResult.Walking && Time.time < state.GiveUpAt)
                {
                    return true;
                }

                if (Utils.DistanceXZ(villager.transform.position, job.Position) > 4f)
                {
                    Forget(hearth, job);
                    state.Job = null;
                    return false;
                }
            }

            ai.StopMoving();
            VillagerLooks.Hold(villager, VillagerLooks.Tool.Hammer);
            ai.LookAt(job.Position + Vector3.up * 0.5f);
            state.Timer += dt;
            if (state.Timer % 1.2f < dt)
            {
                Chores.ToolAnimation(villager, VillagerLooks.Tool.Hammer);
            }

            if (state.Timer < HammerSeconds)
            {
                return true;
            }

            Finish(villager, hearth, job);
            state.Job = null;
            return false;
        }

        private static readonly Dictionary<string, (int Count, double Since)> Repaired = new Dictionary<string, (int, double)>();

        private static string RepairKey(VillageHearth hearth, Vector3 at, string prefab) =>
            $"{hearth.VillageId}:{prefab}:{Mathf.RoundToInt(at.x * 2f)}:{Mathf.RoundToInt(at.y * 2f)}:{Mathf.RoundToInt(at.z * 2f)}";

        /// <summary>
        /// A piece mended or put back: counted, so one that breaks again straight after (a sign with nothing to hang on,
        /// T-43) is noticed. Three times in a game day and it is left alone until the next.
        /// </summary>
        private static void NoteRepair(VillageHearth hearth, Vector3 at, string prefab)
        {
            string key = RepairKey(hearth, at, prefab);
            double now = ZNet.instance != null ? ZNet.instance.GetTimeSeconds() : Time.time;
            Repaired[key] = Repaired.TryGetValue(key, out var seen) && now - seen.Since < VillageBrain.DayLength()
                ? (seen.Count + 1, seen.Since)
                : (1, now);
            if (Repaired[key].Count == 3)
            {
                VillheimPlugin.Log.LogWarning($"{hearth.VillageName}: the {prefab} at {at} broke again after three repairs today; " +
                                              "it is left alone until tomorrow.");
            }
        }

        private static bool GivenUp(VillageHearth hearth, Vector3 at, string prefab)
        {
            if (!Repaired.TryGetValue(RepairKey(hearth, at, prefab), out var seen))
            {
                return false;
            }

            double now = ZNet.instance != null ? ZNet.instance.GetTimeSeconds() : Time.time;
            return seen.Count >= 3 && now - seen.Since < VillageBrain.DayLength();
        }

        private static void Finish(Villager villager, VillageHearth hearth, Job job)
        {
            if (job.Fence != null)
            {
                Palisade.Build(hearth, job.Fence);
                return;
            }

            if (job.Damaged != null)
            {
                if (job.Damaged.Repair())
                {
                    NoteRepair(hearth, job.Damaged.transform.position, Utils.GetPrefabName(job.Damaged.gameObject));
                    VillheimPlugin.Debug($"{villager.VillagerName} repaired a {Utils.GetPrefabName(job.Damaged.gameObject)}.");
                }

                return;
            }

            var state = new VillageState(hearth.Zdo);
            Container chest = VillageChest.Find(hearth);
            if (job.Cost.Count > 0 && (chest == null || !VillageChest.Take(chest, job.Cost)))
            {
                return; // the chest can't pay for it right now
            }

            Quaternion turn = Quaternion.Euler(0f, job.Plot.Yaw, 0f);
            Bounds? bounds = job.Missing.Bounds;
            if (bounds.HasValue && bounds.Value.min.y < 1.2f)
            {
                Vector3 center = job.Plot.Position + turn * new Vector3(bounds.Value.center.x, 0f, bounds.Value.center.z);
                float baseY = job.Plot.Position.y + bounds.Value.min.y;
                float half = Mathf.Clamp(Mathf.Max(bounds.Value.extents.x, bounds.Value.extents.z), 0.6f, 3f);
                if (ZoneSystem.instance.GetGroundHeight(center, out float ground) && Mathf.Abs(ground - baseY) > 0.25f)
                {
                    TerrainShaper.LevelPad(new Vector3(center.x, baseY, center.z), half, half + 1.5f);
                }
            }

            DesignSpawner.SpawnEntry(job.Missing, job.Plot.Position, turn, state.Id, true);
            NoteRepair(hearth, job.Position, job.Missing.Prefab);
            Forget(hearth, job);
            VillheimPlugin.Debug($"{villager.VillagerName} put back a {job.Missing.Prefab} in the {job.Plot.Design}.");
        }

        private static bool StillNeeded(Job job)
        {
            if (job.Fence != null)
            {
                return job.Fence.Remove != null ? job.Fence.Remove : true;
            }

            if (job.Damaged != null)
            {
                return job.Damaged && job.Damaged.GetHealthPercentage() < 0.9f;
            }

            return job.Missing != null && !Present(job.Missing.Prefab, job.Position);
        }

        /// <summary>Missing structure first (ground up), then badly damaged pieces, then lightly damaged ones.</summary>
        private static Job Next(VillageHearth hearth)
        {
            VillageScan scan = Scan(hearth);
            Container chest = VillageChest.Find(hearth);
            foreach (Job missing in scan.Missing.OrderBy(j => j.Position.y))
            {
                if (!Present(missing.Missing.Prefab, missing.Position) && Affordable(chest, missing.Cost) &&
                    !GivenUp(hearth, missing.Position, missing.Missing.Prefab))
                {
                    return missing;
                }
            }

            // Then the fence around the village, before cosmetic repairs.
            Palisade.Segment fence = Palisade.Next(hearth);
            if (fence != null)
            {
                return new Job { Fence = fence, Position = fence.Position };
            }

            WearNTear worst = null;
            float worstHealth = 0.9f;
            float radius = VillheimConfig.VillageRadius.Value + 10f;
            foreach (WearNTear wear in WearNTear.GetAllInstances())
            {
                if (wear == null || wear.m_nview == null || !wear.m_nview.IsValid() ||
                    wear.m_nview.GetZDO().GetInt(Keys.BuiltBy) != hearth.VillageId ||
                    Utils.DistanceXZ(wear.transform.position, hearth.transform.position) > radius)
                {
                    continue;
                }

                float health = wear.GetHealthPercentage();
                if (health < worstHealth && !GivenUp(hearth, wear.transform.position, Utils.GetPrefabName(wear.gameObject)))
                {
                    worst = wear;
                    worstHealth = health;
                }
            }

            return worst != null ? new Job { Damaged = worst, Position = worst.transform.position } : null;
        }

        /// <summary>Checks one finished building for missing shell pieces every minute and a half.</summary>
        private static VillageScan Scan(VillageHearth hearth)
        {
            if (!Scans.TryGetValue(hearth.VillageId, out VillageScan scan))
            {
                scan = new VillageScan { NextScan = Time.time + 30f };
                Scans[hearth.VillageId] = scan;
            }

            var state = new VillageState(hearth.Zdo);
            if (Time.time < scan.NextScan || state.Plots.Count == 0)
            {
                return scan;
            }

            scan.NextScan = Time.time + ScanSeconds;
            int index = scan.NextPlot % state.Plots.Count;
            scan.NextPlot = index + 1;
            Plot plot = state.Plots[index];
            scan.Missing.RemoveAll(j => j.Plot.Position == plot.Position);

            // Only buildings that are loaded: an unloaded one would look entirely missing.
            if (!ZoneSystem.instance.IsZoneLoaded(plot.Position) || (ConstructionSite.IsActive(hearth.Zdo) &&
                                                                     Utils.DistanceXZ(ConstructionSite.Get(hearth.Zdo).Position, plot.Position) < 0.5f))
            {
                return scan;
            }

            List<DesignSpawner.PlanEntry> shell = ConstructionSite.ShellOf(plot, out Dictionary<string, float> factors);
            Quaternion turn = Quaternion.Euler(0f, plot.Yaw, 0f);
            Vector3 fire = hearth.transform.position;
            int present = 0;
            var missing = new List<Job>();
            foreach (DesignSpawner.PlanEntry entry in shell)
            {
                Vector3 world = plot.Position + turn * entry.LocalPosition;
                if (Utils.DistanceXZ(world, fire) < 2.5f && Mathf.Abs(world.y - fire.y) < 1.5f)
                {
                    continue;
                }

                if (Present(entry.Prefab, world))
                {
                    present++;
                    continue;
                }

                var cost = new Dictionary<string, int>();
                foreach (KeyValuePair<string, int> c in entry.Cost)
                {
                    factors.TryGetValue(c.Key, out float factor);
                    int amount = Mathf.CeilToInt(c.Value * factor);
                    if (amount > 0)
                    {
                        cost[c.Key] = amount;
                    }
                }

                missing.Add(new Job { Missing = entry, Plot = plot, Cost = cost, Position = world });
            }

            // A building with most of its shell gone was most likely never a match for this plan (random parts, an
            // older build); only fill gaps in buildings that mostly stand.
            if (present >= missing.Count * 3)
            {
                scan.Missing.AddRange(missing);
                if (missing.Count > 0)
                {
                    VillheimPlugin.Debug($"{state.Name}: {missing.Count} pieces of the {plot.Design} are missing.");
                }
            }

            return scan;
        }

        private static void Forget(VillageHearth hearth, Job job)
        {
            if (job.Missing != null && Scans.TryGetValue(hearth.VillageId, out VillageScan scan))
            {
                scan.Missing.Remove(job);
            }
        }

        private static readonly List<Piece> Nearby = new List<Piece>();

        /// <summary>
        /// A piece of that kind stands at that spot. Goes by the pieces' own positions (the game's piece list), never by
        /// colliders: many pieces have their pivot outside their collider, and a collider test would call them missing.
        /// </summary>
        private static bool Present(string prefab, Vector3 world)
        {
            Nearby.Clear();
            Piece.GetAllPiecesInRadius(world, 0.5f, Nearby);
            foreach (Piece piece in Nearby)
            {
                if (piece != null && Utils.GetPrefabName(piece.gameObject) == prefab)
                {
                    return true;
                }
            }

            return false;
        }

        private static bool Affordable(Container chest, Dictionary<string, int> cost)
        {
            if (cost.Count == 0)
            {
                return true;
            }

            return chest != null && VillageChest.Usable(chest) && cost.All(c => VillageChest.Count(chest, c.Key) >= c.Value);
        }
    }
}
