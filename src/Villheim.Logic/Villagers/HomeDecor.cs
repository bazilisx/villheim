using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using UnityEngine;
using Villheim.Logic.Designs;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Residents fix up their own home in idle time (Tyler, D-073, step 4). A home built from a design with decor
    /// stages (names ending in _s2d1, _s2d2, _s2d3) gets the next stage's pieces, one at a time, by day, when its
    /// people have nothing else to do. Village work comes first: this runs only after every chore, repair and
    /// errand (Brain), and never while an essential amenity is due. Others may help: an idle villager now and then
    /// joins a neighbor who is at it, two at most per home.
    ///
    /// - The next stage's design is laid over the home as it stands (same place and turn, as Repairs does), and only the
    ///   pieces that are not standing yet are made, in the design's build order (ground up). This works whether the
    ///   next stage holds the whole house or only what it adds.
    /// - A design that does not line up with what stands (fewer than four in five of its shell pieces found) is left
    ///   alone, logged once with DebugLog on.
    /// - When every piece of the next stage stands, the home's plot takes that design's name, and the stage after it is
    ///   next.
    /// - Cost (D-066): each piece's tracked materials, scaled as the building's were. A material the village's biome
    ///   lacks is paid in its own wood instead (fine or core wood) or let off (anything else); untracked ingredients
    ///   (resin, leather, metal, coal) are let off. Paid from the village chest, never from what the building going up
    ///   or the next amenity still needs.
    /// </summary>
    internal static class HomeDecor
    {
        public static bool On => LogicConfig.IsOn(LogicConfig.HomeDecor);

        private static readonly Regex StageName = new Regex(@"^(?<base>.+_s\d+)d(?<d>\d)$", RegexOptions.IgnoreCase);

        private const float SkipSeconds = 600f;
        private const int MostHelpers = 2;
        private const float HammerInterval = 1.2f;

        // ---------------------------------------------------------------- what a home is missing

        private sealed class HomePlan
        {
            public string Design;
            public string Next;
            public List<DesignSpawner.PlanEntry> Plan;
            public Dictionary<string, float> Factors;
            public List<int> Missing = new List<int>();
            public bool Lines;
            public float CheckedAt = -100f;
        }

        private static readonly Dictionary<string, HomePlan> Plans = new Dictionary<string, HomePlan>();
        private static readonly Dictionary<string, Dictionary<int, Villager>> Claims = new Dictionary<string, Dictionary<int, Villager>>();
        private static readonly Dictionary<string, float> SkipUntil = new Dictionary<string, float>();
        private static readonly Dictionary<int, float> ShortUntil = new Dictionary<int, float>();
        private static readonly HashSet<string> Warned = new HashSet<string>();

        private static string Key(int villageId, Plot plot) =>
            $"{villageId}:{Mathf.RoundToInt(plot.Position.x * 2f)}:{Mathf.RoundToInt(plot.Position.z * 2f)}";

        /// <summary>The name of the home's next decor stage when that design exists ("bp:house1_s2d2"), else null.</summary>
        public static string NextDesign(Plot plot)
        {
            Match match = plot?.Design != null ? StageName.Match(plot.Design) : Match.Empty;
            if (!match.Success || !int.TryParse(match.Groups["d"].Value, out int decor) || decor >= 3)
            {
                return null;
            }

            string next = match.Groups["base"].Value + "d" + (decor + 1);
            return Blueprints.Find(next)?.Name;
        }

        /// <summary>The home's next stage and what of it is missing, looked at again every 30 seconds (or now).</summary>
        private static HomePlan Scan(VillageHearth hearth, Plot plot, bool now = false)
        {
            string key = Key(hearth.VillageId, plot);
            string next = NextDesign(plot);
            if (next == null || !ZoneSystem.instance.IsZoneLoaded(plot.Position))
            {
                Plans.Remove(key);
                return null;
            }

            if (!Plans.TryGetValue(key, out HomePlan plan) || plan.Design != plot.Design || plan.Next != next)
            {
                Blueprints.Blueprint blueprint = Blueprints.Find(next);
                plan = new HomePlan
                {
                    Design = plot.Design, Next = next, Plan = Blueprints.MakePlan(blueprint, plot.Position, plot.Yaw),
                    Factors = Blueprints.RawTotals(blueprint).ToDictionary(t => t.Key, t => DesignLibrary.CostFactor(t.Value)),
                };
                Plans[key] = plan;
            }
            else if (!now && Time.time - plan.CheckedAt < 30f)
            {
                return plan;
            }

            plan.CheckedAt = Time.time;
            plan.Missing.Clear();
            Quaternion turn = Quaternion.Euler(0f, plot.Yaw, 0f);
            int shell = 0, shellStanding = 0;
            for (int i = 0; i < plan.Plan.Count; i++)
            {
                DesignSpawner.PlanEntry entry = plan.Plan[i];
                bool standing = Repairs.Present(entry.Prefab, plot.Position + turn * entry.LocalPosition);
                if (entry.Shell)
                {
                    shell++;
                    shellStanding += standing ? 1 : 0;
                }

                if (!standing)
                {
                    plan.Missing.Add(i);
                }
            }

            plan.Lines = shell == 0 || shellStanding >= shell * 0.8f;
            if (!plan.Lines && Warned.Add(key + plan.Next))
            {
                VillheimPlugin.Debug($"{hearth.VillageName}: the {plot.Design} at {plot.Position.ToString("F0")} does not line up with " +
                                     $"{plan.Next} ({shellStanding} of {shell} shell pieces found); its decor is left alone.");
            }

            return plan;
        }

        /// <summary>
        /// Every piece of the next stage stands: the home now is that stage. Its plot takes the design's name, and
        /// the stage after it comes next.
        /// </summary>
        private static bool Advance(VillageHearth hearth, Plot plot, HomePlan plan)
        {
            if (plan == null || !plan.Lines || plan.Missing.Count > 0)
            {
                return false;
            }

            var state = new VillageState(hearth.Zdo);
            state.ReplacePlot(plot.Position, new Plot { Design = plan.Next, Position = plot.Position, Yaw = plot.Yaw, Radius = plot.Radius, Role = plot.Role });
            Plans.Remove(Key(hearth.VillageId, plot));
            Households.Household home = Households.At(hearth, plot);
            string whose = home == null ? "A home" : home.IsFamily ? $"The {Households.FamilyName(home)} home" : $"{home.Head.VillagerName}'s home";
            Chronicle.Add(hearth, $"{whose} was fixed up a little more.");
            VillheimPlugin.Log.LogInfo($"{hearth.VillageName}: the {plot.Design} at {plot.Position.ToString("F0")} is now {plan.Next}.");
            return true;
        }

        /// <summary>What the piece costs the village (D-066), scaled as the building's pieces are.</summary>
        private static Dictionary<string, int> Cost(DesignSpawner.PlanEntry entry, HomePlan plan, Heightmap.Biome biome)
        {
            var cost = new Dictionary<string, int>();
            HashSet<string> allowed = Materials.AllowedIn(biome);
            foreach (KeyValuePair<string, int> part in entry.Cost)
            {
                plan.Factors.TryGetValue(part.Key, out float factor);
                int amount = Mathf.CeilToInt(part.Value * factor);
                if (amount <= 0)
                {
                    continue;
                }

                string material = part.Key;
                if (!allowed.Contains(material))
                {
                    // Wood the biome lacks is paid in the village's own wood; anything else is let off.
                    if (!Materials.WoodTypes.Contains(material) || !allowed.Contains(Materials.Wood))
                    {
                        continue;
                    }

                    material = Materials.Wood;
                }

                cost.TryGetValue(material, out int n);
                cost[material] = n + amount;
            }

            return cost;
        }

        /// <summary>What decor may not touch: the building going up and the next amenity keep theirs.</summary>
        private static Dictionary<string, int> Reserved(VillageHearth hearth)
        {
            var reserved = new Dictionary<string, int>(ConstructionSite.Remaining(hearth));
            Amenities.Job due = Amenities.Upcoming(hearth);
            if (due?.Cost != null)
            {
                foreach (KeyValuePair<string, int> part in Amenities.StartCost(due))
                {
                    reserved.TryGetValue(part.Key, out int n);
                    reserved[part.Key] = n + part.Value;
                }
            }

            return reserved;
        }

        // ---------------------------------------------------------------- the villager at work

        private sealed class Work
        {
            public Vector3 PlotAt;
            public string Key;
            public int Index = -1;
            public DesignSpawner.PlanEntry Entry;
            public Vector3 World;
            public Vector3 Stand;
            public float Deadline;
            public float Timer;
            public float SessionEnd;
            public int Made;
            public bool Helping;
        }

        private sealed class State
        {
            public Work Work;
            public float NextLook;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        private static bool Daytime()
        {
            if (EnvMan.instance == null || EnvMan.IsNight())
            {
                return false;
            }

            float day = EnvMan.instance.GetDayFraction();
            return day > 0.29f && day < 0.66f;
        }

        public static string Describe(Villager villager)
        {
            if (!States.TryGetValue(villager, out State state) || state.Work == null)
            {
                return null;
            }

            return state.Work.Helping ? "helping a neighbor" : "fixing up the home";
        }

        /// <summary>True while fixing up a home. Called in idle time only (Brain), after all village work.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            if (!On || villager.Zdo == null)
            {
                return false;
            }

            State state = States.GetOrCreateValue(villager);
            if (state.Work != null)
            {
                if (Run(villager, ai, dt, state))
                {
                    return true;
                }

                End(villager, state);
                return false;
            }

            if (Time.time < state.NextLook)
            {
                return false;
            }

            state.NextLook = Time.time + Random.Range(40f, 90f);
            if (!Daytime() || Childhood.IsChild(villager) || Wanderers.IsWanderer(villager) || Roles.IsNightWatch(villager) ||
                Random.value > 0.5f)
            {
                return false;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid || VillageChest.IsLost(hearth) ||
                (ShortUntil.TryGetValue(hearth.VillageId, out float shortUntil) && Time.time < shortUntil))
            {
                return false;
            }

            Amenities.Job due = Amenities.Upcoming(hearth);
            if (due != null && due.Essential)
            {
                return false; // the village's needs first
            }

            // His own home first; else, now and then, a hand for a neighbor who is at it.
            Households.Household own = Households.Of(villager);
            Work work = own != null ? Start(hearth, villager, own.Plot, false) : null;
            if (work == null && Random.value < 0.5f)
            {
                foreach (Households.Household home in Households.Of(hearth))
                {
                    string key = Key(hearth.VillageId, home.Plot);
                    if (home != own && Claims.TryGetValue(key, out var claims) && claims.Count > 0 && claims.Count < MostHelpers &&
                        claims.Values.Any(v => v != null && !v.IsDead()))
                    {
                        work = Start(hearth, villager, home.Plot, true);
                        if (work != null)
                        {
                            break;
                        }
                    }
                }
            }

            if (work == null)
            {
                return false;
            }

            state.Work = work;
            Walker.For(villager).Reset();
            VillheimPlugin.Debug($"{villager.VillagerName} goes to {(work.Helping ? "help fix up a neighbor's home" : "fix up his home")}: {work.Entry.Prefab}.");
            return true;
        }

        /// <summary>The next piece of the home's next stage that he can make now, claimed for him. Null when there is none.</summary>
        private static Work Start(VillageHearth hearth, Villager villager, Plot plot, bool helping, Work session = null)
        {
            HomePlan plan = Scan(hearth, plot);
            if (plan == null || !plan.Lines)
            {
                return null;
            }

            if (plan.Missing.Count == 0)
            {
                Advance(hearth, plot, plan);
                return null;
            }

            string key = Key(hearth.VillageId, plot);
            if (!Claims.TryGetValue(key, out var claims))
            {
                claims = new Dictionary<int, Villager>();
                Claims[key] = claims;
            }

            foreach (int gone in claims.Where(c => c.Value == null || c.Value.IsDead() || !States.TryGetValue(c.Value, out State s) ||
                                                   s.Work == null || s.Work.Key != key).Select(c => c.Key).ToList())
            {
                claims.Remove(gone);
            }

            var state = new VillageState(hearth.Zdo);
            Quaternion turn = Quaternion.Euler(0f, plot.Yaw, 0f);
            Dictionary<string, int> reserved = Reserved(hearth);
            foreach (int index in plan.Missing)
            {
                if ((claims.TryGetValue(index, out Villager holder) && holder != villager) ||
                    (SkipUntil.TryGetValue(key + ":" + index, out float skip) && Time.time < skip))
                {
                    continue;
                }

                DesignSpawner.PlanEntry entry = plan.Plan[index];
                Vector3 world = plot.Position + turn * entry.LocalPosition;
                if (Repairs.Present(entry.Prefab, world))
                {
                    continue;
                }

                if (Occupied(world, villager))
                {
                    return null; // someone stands where it goes: later, so nothing goes up ahead of it
                }

                if (!Amenities.Affordable(hearth, state, Cost(entry, plan, state.Biome), reserved))
                {
                    // In build order: the pieces after it wait for this one.
                    ShortUntil[hearth.VillageId] = Time.time + 120f;
                    return null;
                }

                claims[index] = villager;
                Work work = session ?? new Work { SessionEnd = Time.time + Random.Range(120f, 240f), Helping = helping };
                work.PlotAt = plot.Position;
                work.Key = key;
                work.Index = index;
                work.Entry = entry;
                work.World = world;
                work.Stand = StandSpot(plot, world, villager.transform.position);
                work.Deadline = Time.time + 40f;
                work.Timer = 0f;
                return work;
            }

            return null;
        }

        /// <summary>Someone else stands where the piece goes.</summary>
        private static bool Occupied(Vector3 world, Villager worker)
        {
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character != worker && !character.IsDead() && Utils.DistanceXZ(character.transform.position, world) < 0.8f &&
                    Mathf.Abs(character.transform.position.y - world.y) < 2f)
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>A step from the piece toward the middle of the home (inside), or toward him for a piece in the middle.</summary>
        private static Vector3 StandSpot(Plot plot, Vector3 world, Vector3 from)
        {
            Vector3 toward = (plot.Position - world).Horizontal();
            if (toward.sqrMagnitude < 1f)
            {
                toward = (from - world).Horizontal();
            }

            toward = toward.sqrMagnitude > 0.01f ? toward.normalized : Vector3.forward;
            return world + toward * 1.3f;
        }

        private static bool Run(Villager villager, VillagerAI ai, float dt, State state)
        {
            Work work = state.Work;
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid || !Daytime())
            {
                return false;
            }

            var village = new VillageState(hearth.Zdo);
            Plot plot = village.Plots.FirstOrDefault(p => Utils.DistanceXZ(p.Position, work.PlotAt) < 0.5f);
            if (plot == null || Repairs.Present(work.Entry.Prefab, work.World))
            {
                return Next(villager, hearth, plot, state);
            }

            Vector3 position = villager.transform.position;
            bool near = Utils.DistanceXZ(position, work.World) < 2.6f && Mathf.Abs(position.y - work.World.y) < 3f;
            if (!near)
            {
                WalkResult step = Walker.For(villager).Go(villager, ai, dt, work.Stand, 0.6f);
                if (step == WalkResult.Walking && Time.time < work.Deadline)
                {
                    return true;
                }

                if (Utils.DistanceXZ(villager.transform.position, work.World) > 3.5f)
                {
                    VillheimPlugin.Debug($"{villager.VillagerName} can't get to the {work.Entry.Prefab} in the {plot.Design}; left for later.");
                    SkipUntil[work.Key + ":" + work.Index] = Time.time + SkipSeconds;
                    return false;
                }
            }

            ai.StopMoving();
            VillagerLooks.Hold(villager, VillagerLooks.Tool.Hammer);
            Face(villager, ai, work.World + Vector3.up * 0.3f);
            work.Timer += dt;
            if (work.Timer % HammerInterval < dt)
            {
                Chores.ToolAnimation(villager, VillagerLooks.Tool.Hammer);
            }

            float perPiece = 1.5f * (LogicConfig.SecondsPerPiece != null ? LogicConfig.SecondsPerPiece.Value : 2.5f) /
                             VillagerSkills.WorkFactor(villager, "building");
            if (work.Timer < perPiece)
            {
                return true;
            }

            HomePlan plan = Scan(hearth, plot);
            Dictionary<string, int> cost = plan != null ? Cost(work.Entry, plan, village.Biome) : null;
            if (cost == null || Occupied(work.World, villager) || !Amenities.Affordable(hearth, village, cost, Reserved(hearth)) ||
                !Amenities.Pay(hearth, village, cost))
            {
                ShortUntil[hearth.VillageId] = Time.time + 120f;
                TaskGestures.GaveUp(villager);
                return false;
            }

            GameObject made = DesignSpawner.SpawnEntry(work.Entry, plot.Position, Quaternion.Euler(0f, plot.Yaw, 0f), hearth.VillageId, true);
            if (made == null)
            {
                SkipUntil[work.Key + ":" + work.Index] = Time.time + SkipSeconds;
                return false;
            }

            work.Made++;
            VillheimPlugin.Debug($"{villager.VillagerName} put a {work.Entry.Prefab} in the {plot.Design} " +
                                 $"({(plan != null ? plan.Missing.Count - 1 : 0)} to go for {plan?.Next}).");
            if (plan != null)
            {
                plan.Missing.Remove(work.Index);
                if (plan.Missing.Count == 0)
                {
                    Scan(hearth, plot, true);
                    Advance(hearth, plot, plan);
                }
            }

            return Next(villager, hearth, plot, state);
        }

        /// <summary>On to the next piece of the same home while the session lasts.</summary>
        private static bool Next(Villager villager, VillageHearth hearth, Plot plot, State state)
        {
            Work work = state.Work;
            if (Claims.TryGetValue(work.Key, out var claims))
            {
                claims.Remove(work.Index);
            }

            if (plot == null || Time.time > work.SessionEnd || work.Made >= 4)
            {
                if (work.Made > 0)
                {
                    TaskGestures.Made(villager);
                }

                return false;
            }

            Work next = Start(hearth, villager, plot, work.Helping, work);
            if (next == null)
            {
                return false;
            }

            Walker.For(villager).Reset();
            return true;
        }

        private static void End(Villager villager, State state)
        {
            if (state.Work != null && Claims.TryGetValue(state.Work.Key, out var claims))
            {
                claims.Remove(state.Work.Index);
            }

            state.Work = null;
            state.NextLook = Time.time + Random.Range(30f, 60f);
        }

        private static void Face(Villager villager, VillagerAI ai, Vector3 point)
        {
            ai.LookAt(point);
            Vector3 direction = (point - villager.transform.position).Horizontal();
            if (direction.sqrMagnitude > 0.01f)
            {
                villager.SetLookDir(direction.normalized);
            }
        }

        // ---------------------------------------------------------------- 'vh decor'

        /// <summary>For 'vh decor': each home's design, its next stage and what is missing; 'now' makes the nearest home's next stage at once (test only).</summary>
        public static List<string> Report(VillageHearth hearth, Vector3 player, bool now)
        {
            var lines = new List<string>();
            var state = new VillageState(hearth.Zdo);
            Plot nearest = state.Plots.Where(Households.IsHome).OrderBy(p => Utils.DistanceXZ(p.Position, player)).FirstOrDefault();
            if (now && nearest != null)
            {
                HomePlan plan = Scan(hearth, nearest, true);
                if (plan == null)
                {
                    lines.Add($"The {nearest.Design} has no next decor stage.");
                }
                else
                {
                    Quaternion turn = Quaternion.Euler(0f, nearest.Yaw, 0f);
                    int made = 0;
                    foreach (int index in plan.Missing.ToList())
                    {
                        if (DesignSpawner.SpawnEntry(plan.Plan[index], nearest.Position, turn, hearth.VillageId, true) != null)
                        {
                            made++;
                        }
                    }

                    lines.Add($"Put up {made} pieces of {plan.Next} in the {nearest.Design} at once (test, free).");
                    plan = Scan(hearth, nearest, true);
                    Advance(hearth, nearest, plan);
                    state = new VillageState(hearth.Zdo);
                }
            }

            foreach (Plot plot in state.Plots.Where(Households.IsHome))
            {
                HomePlan plan = Scan(hearth, plot, true);
                string what = plan == null
                    ? (StageName.IsMatch(plot.Design ?? "") ? "at its last decor stage, or the next one is not found" : "no decor stages in its name")
                    : !plan.Lines
                        ? $"next {plan.Next}, but it does not line up with what stands"
                        : $"next {plan.Next}: {plan.Missing.Count} of {plan.Plan.Count} pieces to make";
                string workers = Claims.TryGetValue(Key(hearth.VillageId, plot), out var claims) && claims.Count > 0
                    ? $"; at it now: {string.Join(", ", claims.Values.Where(v => v != null).Select(v => v.VillagerName).Distinct())}"
                    : "";
                lines.Add($"{plot.Design} at {plot.Position.ToString("F0")}: {what}{workers}.");
            }

            if (ShortUntil.TryGetValue(hearth.VillageId, out float shortUntil) && Time.time < shortUntil)
            {
                lines.Add($"Decor waits {shortUntil - Time.time:0} s more: the chest could not spare the next piece.");
            }

            return lines;
        }
    }
}
