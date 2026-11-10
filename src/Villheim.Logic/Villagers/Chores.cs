using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Villager work, by day.
    ///
    /// One villager in each village is its builder (a villager with the builder trade if there is one). Whenever the
    /// village chest holds what the next piece needs, the builder builds. Everyone else, and the builder while the chest
    /// is short, gathers what the village still needs, easiest first:
    ///
    /// 1. material already lying on the ground,
    /// 2. loose sticks and stones to pick up,
    /// 3. half-finished work (felled logs, cracked rocks),
    /// 4. and only then something new (a standing tree or a whole rock).
    ///
    /// What they gather goes into the village chest by the hearth (to the hearth itself while there is no chest). When nothing is
    /// needed, nobody harvests.
    ///
    /// Villagers walk to a spot next to what they work on before they swing. A tree is cut from the village side, so
    /// it falls away from the houses. The damage goes straight to the target, so villagers never hurt players or
    /// buildings by accident.
    /// </summary>
    internal static class Chores
    {
        private enum Phase
        {
            Idle,
            Approach,
            Work,
            Pick,
            Collect,
            Deliver,
            Build,
            BuildChest,
            Make,
        }

        private sealed class Profile
        {
            public string Activity;
            public string PartialActivity;
            public VillagerLooks.Tool Tool;
            public Func<GameObject, bool> IsSource;
            public Func<GameObject, bool> IsPartial;
            public bool Pickaxe;
            public int MaxSwingsPerSource;
        }

        private sealed class Work
        {
            public Phase Phase;
            public Profile Profile;

            /// <summary>The kind of gathering he last set off on, kept two minutes (FINDINGS 3, suspect 1).</summary>
            public Profile Sticky;
            public float StickyUntil;
            public bool CanHarvest;
            public readonly HashSet<string> Wanted = new HashSet<string>();
            public GameObject Target;
            public Vector3 TargetSeenAt;
            public Vector3 Stand;
            public Vector3 Contact;

            /// <summary>His place among the helpers when the stand was worked out (0: the builder).</summary>
            public int HelperSlot = -1;

            /// <summary>When a helper next checks that nobody has moved in on his spot.</summary>
            public float StandCheckAt;
            public Vector3 Spot;
            public float Timer;
            public float Deadline;
            public float Cooldown = Random.Range(1f, 3f);
            public string Reason = "";
            public float FacingSince;
            public float StraightUntil;
            public int Picks;
            public float HitAt = -1f;
            public Vector3 HitPoint;
            public Collider HitCollider;
            public float NextCheck;
            public int Swings;
            public readonly Dictionary<string, int> Carrying = new Dictionary<string, int>();
            public readonly HashSet<GameObject> Skip = new HashSet<GameObject>();

            // Against loops: a builder who can't reach a piece waits before trying again (and after two misses on the
            // same piece may place it from further away, as Millenaire's builders do when stuck); jobs that end
            // within seconds with nothing done twice in a row earn a proper break instead of an instant retry.
            public float BuildRetryAt;

            /// <summary>A piece past the next one this villager works on (a helper's own part of the building), or -1.</summary>
            public int OwnPiece = -1;
            public float BlockedSince = -1f;
            public Vector3 BlockedPiece;
            public float BlockedLogAt;
            public Vector3 MissedPiece;
            public int Misses;
            public float StartedAt;
            public bool Progressed;
            public int QuickFails;

            /// <summary>The standing tree being felled (its prefab name), so a sapling is owed once it falls.</summary>
            public string FellingTree;

            /// <summary>When the brain last ran this villager's work (the activity shown is only what he does now).</summary>
            public float LastRun;

            /// <summary>Picking up useful things lying in the village (any kind, not only building materials).</summary>
            public bool Tidying;

            /// <summary>When the builder next looks for an essential amenity to make before the building going up.</summary>
            public float NextNeedCheck;

            /// <summary>The amenity piece the builder is making (Phase.Make), and when he may look for one again.</summary>
            public Amenities.Job Making;
            public float MakeRetryAt;
        }

        private const float MaxFromHearth = 55f;
        private const float WorkReach = 2.6f;
        private const float WorkReachAtSpot = 3.3f;
        private const float StandOff = 1.1f;
        private const float SwingInterval = 1.6f;
        private const float HitDelay = 0.45f;
        private const float PickableRadius = 15f;
        private const int MaxPicksPerTrip = 8;
        private const float WorkRange = 8f;
        private const float BuildRange = 8f;
        private const float HammerInterval = 1.2f;
        private const float DeliverReach = 1.8f;

        private static readonly string[] OreWords = { "copper", "tin", "iron", "silver", "obsidian", "meteor", "flametal", "crystal", "ore" };

        private static readonly Profile Woodcutter = new Profile
        {
            Activity = "felling a tree",
            PartialActivity = "splitting logs",
            Tool = VillagerLooks.Tool.Axe,
            IsSource = go => go.GetComponent<TreeBase>() != null,
            IsPartial = go => go.GetComponent<TreeLog>() != null || IsStump(go),
            Pickaxe = false,
            MaxSwingsPerSource = 90,
        };

        private static readonly Profile Miner = new Profile
        {
            Activity = "breaking rocks",
            PartialActivity = "breaking up a cracked rock",
            Tool = VillagerLooks.Tool.Pickaxe,
            IsSource = IsRock,
            IsPartial = IsCrackedRock,
            Pickaxe = true,
            MaxSwingsPerSource = 30,
        };

        private static readonly ConditionalWeakTable<Villager, Work> States = new ConditionalWeakTable<Villager, Work>();
        private static readonly HashSet<GameObject> Claimed = new HashSet<GameObject>();
        private static readonly Dictionary<GameObject, float> Unreachable = new Dictionary<GameObject, float>();
        private static readonly Dictionary<int, (float Time, ZDOID Builder)> Builders = new Dictionary<int, (float, ZDOID)>();
        private static readonly List<Collider> ColliderBuffer = new List<Collider>();

        /// <summary>Returns true while a chore is driving the villager this update.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            if (States.TryGetValue(villager, out Work ran))
            {
                ran.LastRun = Time.time;
            }

            if (!VillheimConfig.VillagersChopTrees.Value || EnvMan.IsNight() || villager.IsDead() || Childhood.IsChild(villager) ||
                Elders.SkipsHeavyWork(villager))
            {
                Stop(villager);
                return false;
            }

            Work work = States.GetOrCreateValue(villager);
            VillageNeeds needs = VillageNeeds.For(villager.VillageId);
            if (needs == null)
            {
                return false;
            }

            bool builder = IsVillageBuilder(villager);
            if (builder && needs.ChestLost && needs.CanRebuildChest && work.Phase != Phase.BuildChest)
            {
                // The village chest comes before everything else. Hand in what he carries (it may be the wood the
                // chest needs), then build it.
                if (work.Carrying.Count > 0 && work.Phase != Phase.Deliver)
                {
                    BeginDeliver(villager, work);
                }
                else if (work.Phase != Phase.Deliver)
                {
                    ReleaseTarget(work);
                    work.Phase = Phase.BuildChest;
                    work.Timer = 0f;
                    Walker.For(villager).Reset();
                    VillheimPlugin.Debug($"{villager.VillagerName} goes to rebuild the village chest.");
                }
            }
            else if (builder && work.Phase != Phase.Make && work.Phase != Phase.Deliver && Time.time >= work.NextNeedCheck &&
                     EssentialDue(villager, work))
            {
                // Needs before the building going up (T-54): beds, the cooking station, a half-made notice board, a
                // chest when the main one is full. He hands in what he carries first.
                if (work.Carrying.Count > 0)
                {
                    BeginDeliver(villager, work);
                }
                else
                {
                    ReleaseTarget(work);
                    TryMake(villager, work);
                }
            }
            else if (needs.SiteActive && needs.CanBuildNow && work.Phase != Phase.Build && work.Phase != Phase.Make &&
                     Time.time >= work.BuildRetryAt && !Elders.IsElder(villager) && (builder || JoinsBuilding(villager, work)))
            {
                // The chest has what the next part needs: the builder drops what he is doing (keeping what he carries
                // for the chest) and builds, and idle hands join him (T-54: building the village is the point; the
                // materials serve it).
                if (work.Carrying.Count > 0 && work.Phase != Phase.Deliver)
                {
                    BeginDeliver(villager, work);
                }
                else if (work.Phase != Phase.Deliver)
                {
                    ReleaseTarget(work);
                    work.Phase = Phase.Build;
                    work.Timer = 0f;
                    work.Deadline = Time.time + 30f;
                    Walker.For(villager).Reset();
                }
            }

            switch (work.Phase)
            {
                case Phase.Idle:
                    // A main chest three quarters full is sorted into the storage chests before the next trip out
                    // (T-15: it took a while). One villager at a time, never the builder (Sorting).
                    if (!builder && Sorting.Update(villager, ai, dt))
                    {
                        return true;
                    }

                    work.Cooldown -= dt;
                    if (work.Cooldown > 0f)
                    {
                        return false;
                    }

                    StartJob(villager, work, needs, builder);

                    // Look again soon when there was work, less often when there was none (free time meanwhile).
                    work.Cooldown = work.Phase != Phase.Idle ? Random.Range(0.5f, 1.5f) : Random.Range(5f, 8f);
                    return work.Phase != Phase.Idle;

                case Phase.Approach:
                case Phase.Work:
                    return UpdateWork(villager, ai, work, dt);

                case Phase.Pick:
                    return UpdatePick(villager, ai, work, dt);

                case Phase.Collect:
                    return UpdateCollect(villager, ai, work, dt);

                case Phase.Deliver:
                    return UpdateDeliver(villager, ai, work, dt);

                case Phase.Build:
                    return UpdateBuild(villager, ai, work, dt);

                case Phase.BuildChest:
                    return UpdateBuildChest(villager, ai, work, dt);

                case Phase.Make:
                    return UpdateMake(villager, ai, work, dt);
            }

            return false;
        }

        public static string Describe(Villager villager)
        {
            if (!States.TryGetValue(villager, out Work work) || work.Phase == Phase.Idle || Time.time - work.LastRun > 1f)
            {
                return null;
            }

            Profile profile = work.Profile ?? Woodcutter;
            switch (work.Phase)
            {
                case Phase.Build:
                    VillageHearth at = VillageHearth.Find(villager.VillageId);
                    return at != null && at.IsValid && ConstructionSite.Clearing(at) ? "clearing the plot" : "building";
                case Phase.BuildChest:
                    return "rebuilding the village chest";
                case Phase.Make:
                    return work.Making != null ? "making a " + work.Making.Name : "building";
                case Phase.Deliver:
                    return "carrying materials to the site";
                case Phase.Collect:
                case Phase.Pick:
                    return "gathering " + string.Join(" and ", Labels(work.Wanted));
                case Phase.Work:
                case Phase.Approach when work.Target != null && work.Profile != null:
                    // Walking up to the tree or rock, or stepping back in after a swing or a rolling log, is part of
                    // the job: the map showed "relaxing" for it (T-11).
                    return work.Target != null && profile.IsPartial(work.Target) ? profile.PartialActivity : profile.Activity;
                default:
                    return "heading out to work";
            }
        }

        /// <summary>
        /// The tool his chore has in hand right now: the axe or pickaxe on the way to the tree or rock and while working
        /// it, the hammer at the building. Null for everything else (carrying, picking things up, heading out), when
        /// tools are put away (Tyler: pickaxes over the shoulder while traveling; only on the way to mining).
        /// </summary>
        public static VillagerLooks.Tool? ToolInUse(Villager villager)
        {
            if (!States.TryGetValue(villager, out Work work) || Time.time - work.LastRun > 1f)
            {
                return null;
            }

            switch (work.Phase)
            {
                case Phase.Build:
                    VillageHearth site = VillageHearth.Find(villager.VillageId);
                    return site != null && site.IsValid ? ConstructionSite.WorkTool(site) : VillagerLooks.Tool.Hammer;
                case Phase.BuildChest:
                case Phase.Make:
                    return VillagerLooks.Tool.Hammer;
                case Phase.Approach:
                case Phase.Work:
                    return work.Target != null && work.Profile != null ? work.Profile.Tool : (VillagerLooks.Tool?)null;
                default:
                    return null;
            }
        }

        private static IEnumerable<string> Labels(IEnumerable<string> materials)
        {
            foreach (string material in materials)
            {
                yield return Materials.Label(material);
            }
        }

        /// <summary>
        /// The village's builder: a loaded villager with the builder trade, otherwise the first villager. Worked out
        /// the same way on every client.
        /// </summary>
        public static bool IsVillageBuilder(Villager villager)
        {
            int id = villager.VillageId;
            if (Builders.TryGetValue(id, out var cached) && Time.time - cached.Time < 3f)
            {
                return cached.Builder == villager.GetZDOID();
            }

            // Elders never build houses (Tyler: "elders are helping to build and that doesn't mesh"): the builder is a
            // grown villager who is not an elder whenever the village has one. Only a village of elders has an elder
            // builder, and he only makes the small things (Update).
            Villager best = null;
            bool bestIsBuilder = false;
            bool bestYoung = false;
            int bestSeed = int.MaxValue;
            foreach (Character character in Character.GetAllCharacters())
            {
                if (!(character is Villager other) || other.IsDead() || other.VillageId != id || other.Zdo == null ||
                    Childhood.IsChild(other) || Wanderers.IsWanderer(other))
                {
                    continue;
                }

                int seed = other.Zdo.GetInt(Keys.VillagerSeed);
                // The carpenter builds; with none, a generalist with a builder's looks (D-075).
                Roles.Trade trade = Roles.TradeOf(other);
                bool isBuilder = Roles.HasTrade(id, Roles.Trade.Carpenter) ? trade == Roles.Trade.Carpenter
                    : trade == Roles.Trade.None && VillagerLooks.IsBuilder(seed);
                bool young = !Elders.IsElder(other);
                bool better = best == null || (young && !bestYoung) ||
                              (young == bestYoung && ((isBuilder && !bestIsBuilder) || (isBuilder == bestIsBuilder && seed < bestSeed)));
                if (better)
                {
                    best = other;
                    bestIsBuilder = isBuilder;
                    bestYoung = young;
                    bestSeed = seed;
                }
            }

            ZDOID builderId = best != null ? best.GetZDOID() : ZDOID.None;
            Builders[id] = (Time.time, builderId);
            return builderId == villager.GetZDOID();
        }

        /// <summary>
        /// Easiest work first: drops, then loose pickables, then half-finished work, then something new. A villager
        /// tries his own trade's material first (miners stone, the rest wood) and then the other one. Everything is
        /// searched within the village's reach of the hearth, nearest to the villager first.
        /// </summary>
        private static void StartJob(Villager villager, Work work, VillageNeeds needs, bool builder)
        {
            // The builder makes what the village has the materials for (the notice board piece by piece, chests, the map
            // table, benches) before he goes out gathering. Building the house going up comes first (Update).
            if (builder && TryMake(villager, work))
            {
                return;
            }

            if (Elders.IsElder(villager))
            {
                // An elder builder (a village of elders) makes the small things above and picks up what lies about;
                // he never fells, mines or clears ground.
                if (!TryTidy(villager, work))
                {
                    NoWork(villager, work, "an elder leaves the heavy work to younger hands");
                }

                return;
            }

            // Some trades keep to their work, however big the village gets (T-108): a cook keeps the hearth, a farmer
            // the farm, a guard the watch, a healer the hurt and his herbs. None of them clears ground, tidies up or
            // helps build. Hunters and fishers gather like anyone when the village has no meat or fish to fetch.
            Roles.Trade trade = Roles.TradeOf(villager);
            if (trade == Roles.Trade.Cook && !builder)
            {
                NoWork(villager, work, "keeps the hearth and cooks for the village");
                return;
            }

            if (trade == Roles.Trade.Farmer && !builder)
            {
                NoWork(villager, work, "tends the farm");
                return;
            }

            if (trade == Roles.Trade.Guard && !builder)
            {
                NoWork(villager, work, "keeps watch over the village");
                return;
            }

            if (trade == Roles.Trade.Healer && !builder)
            {
                NoWork(villager, work, "tends the hurt and gathers herbs");
                return;
            }

            // An essential the builder has not got to (beds, the cooking station, the notice board, a full chest's
            // spare) is made by someone else after a while (2026-11-09: Fjallseter waited on its board while its only
            // builder was out and Erling had nothing to do).
            if (!builder && HelperMakes(villager, work))
            {
                return;
            }

            if (needs.Missing.Count == 0)
            {
                if (!TryClear(villager, work, needs, false) && !TryTidy(villager, work))
                {
                    NoWork(villager, work, "the village needs nothing right now");
                }

                return;
            }

            // A carpenter goes for wood first, a smith for stone and ore. Everyone else goes where the need is greatest.
            Profile first;
            if (trade == Roles.Trade.Smith)
            {
                first = Miner;
            }
            else if (trade == Roles.Trade.Carpenter)
            {
                first = Woodcutter;
            }
            else
            {
                int wood = 0, stone = 0;
                foreach (KeyValuePair<string, int> need in needs.Missing)
                {
                    if (Materials.WoodTypes.Contains(need.Key)) wood += need.Value;
                    else stone += need.Value;
                }

                first = stone > wood ? Miner : Woodcutter;

                // He keeps to the material he went for last while the village still lacks it (FINDINGS 3, suspect 1):
                // the need list was read again at each trip, and a small swing in it sent him from rock to tree and
                // back, a new "setting off" each time.
                if (work.Sticky != null && Time.time < work.StickyUntil &&
                    (work.Sticky == Miner ? stone > 0 : wood > 0))
                {
                    first = work.Sticky;
                }
            }

            Profile second = first == Miner ? Woodcutter : Miner;
            string firstReason = TryProfile(villager, work, needs, first);
            if (firstReason == null)
            {
                work.Sticky = first;
                work.StickyUntil = Time.time + 120f;
                return;
            }

            string secondReason = TryProfile(villager, work, needs, second);
            if (secondReason == null)
            {
                work.Sticky = second;
                work.StickyUntil = Time.time + 120f;
                return;
            }

            if (TryClear(villager, work, needs, false) || TryTidy(villager, work))
            {
                return;
            }

            NoWork(villager, work, firstReason == "" ? secondReason : firstReason);
        }

        // ---------------------------------------------------------------- clearing the ground

        private static readonly Dictionary<int, (float Time, HashSet<Vector2Int> Cells)> PathCells =
            new Dictionary<int, (float, HashSet<Vector2Int>)>();

        /// <summary>Cells of the paths waiting to be laid, looked up again every ten seconds.</summary>
        private static HashSet<Vector2Int> QueuedPathCells(VillageHearth hearth)
        {
            if (PathCells.TryGetValue(hearth.VillageId, out var cached) && Time.time - cached.Time < 10f)
            {
                return cached.Cells;
            }

            HashSet<Vector2Int> cells = PathLaying.QueuedCells(hearth);
            PathCells[hearth.VillageId] = (Time.time, cells);
            return cells;
        }

        /// <summary>On or right beside a path cell (the path is laid about two metres wide).</summary>
        public static bool OnPath(HashSet<Vector2Int> cells, Vector3 point)
        {
            if (cells.Count == 0)
            {
                return false;
            }

            Vector2Int c = PathPlanner.Cell(point);
            for (int dx = -1; dx <= 1; dx++)
            {
                for (int dz = -1; dz <= 1; dz++)
                {
                    if (cells.Contains(new Vector2Int(c.x + dx, c.y + dz)))
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        /// <summary>
        /// Something natural that has to go from the village ground: a tree, a felled log, a stump, a rock (no ore) or a
        /// loose stick or stone. Never anything the village or a player made or planted.
        /// </summary>
        public static bool IsClutter(GameObject go)
        {
            if (go == null || go.GetComponent<Piece>() != null || go.GetComponent<Character>() != null || go.GetComponent<ItemDrop>() != null)
            {
                return false;
            }

            ZNetView view = go.GetComponent<ZNetView>();
            if (view == null || !view.IsValid() || view.GetZDO().GetInt(Keys.BuiltBy) != 0)
            {
                return false;
            }

            if (go.TryGetComponent(out Pickable pickable))
            {
                string item = pickable.m_itemPrefab != null ? pickable.m_itemPrefab.name : "";
                return !pickable.GetPicked() && (item == Materials.Wood || item == Materials.Stone || item == "Flint");
            }

            return go.GetComponent<TreeBase>() != null || go.GetComponent<TreeLog>() != null || IsStump(go) || IsRock(go);
        }

        /// <summary>
        /// Starts clearing the nearest clutter within ClearingRadius of the hearth or on a path waiting to be laid.
        /// With <paramref name="wantedOnly"/>, only clutter that gives something the village wants (clearing comes before
        /// going further out for it); without, anything (when there is no other work).
        /// </summary>
        private static bool TryClear(Villager villager, Work work, VillageNeeds needs, bool wantedOnly)
        {
            float radius = LogicConfig.ClearingRadius != null ? LogicConfig.ClearingRadius.Value : 20f;
            VillageHearth home = VillageHearth.Find(villager.VillageId);
            if (home == null || !home.IsValid)
            {
                return false;
            }

            Vector3 hearth = home.transform.position;
            Vector3 position = villager.transform.position;
            HashSet<Vector2Int> path = QueuedPathCells(home);
            int axeTier = CarriedTier(villager, Skills.SkillType.Axes);
            int pickTier = CarriedTier(villager, Skills.SkillType.Pickaxes);

            GameObject target = FindNearest(hearth, MaxFromHearth, position, go =>
            {
                if (!IsClutter(go))
                {
                    return false;
                }

                // Round the hearth everything goes; on a road only what the road runs through (it goes round the big ones).
                bool inside = radius > 0f && Utils.DistanceXZ(go.transform.position, hearth) <= radius;
                if (!inside && (!OnPath(path, go.transform.position) || PathPlanner.BigObstacle(go)))
                {
                    return false;
                }

                bool rock = IsRock(go);
                if (go.GetComponent<Pickable>() == null && !TierAllows(go, rock ? pickTier : axeTier))
                {
                    return false;
                }

                return !wantedOnly || Yields.GivesAny(go, needs.Missing.Keys);
            }, null);

            if (target == null)
            {
                return false;
            }

            if (target.TryGetComponent(out Pickable loose))
            {
                work.Profile = Woodcutter;
                work.Wanted.Clear();
                work.Wanted.Add(loose.m_itemPrefab.name);
                Claimed.Add(target);
                Begin(villager, work, Phase.Pick, target, target.transform.position, 30f);
                Started(villager, work, "clearing a loose " + Materials.Label(loose.m_itemPrefab.name) + " off the village ground");
                return true;
            }

            Profile profile = IsRock(target) ? Miner : Woodcutter;
            work.Profile = profile;
            work.Wanted.Clear();
            foreach (string material in Materials.Tracked)
            {
                if (Materials.WoodTypes.Contains(material) == (profile == Woodcutter))
                {
                    work.Wanted.Add(material);
                }
            }

            work.CanHarvest = VillagerLooks.Hold(villager, profile.Tool);
            work.Skip.Clear();
            work.Swings = 0;
            Claimed.Add(target);
            Begin(villager, work, Phase.Approach, target, target.transform.position, 120f);
            Started(villager, work, $"clearing {Utils.GetPrefabName(target)} off the village ground " +
                                    $"({Utils.DistanceXZ(position, target.transform.position):0} m away)");
            return true;
        }

        /// <summary>The best tier of a tool he carries (by its skill), held or not. 0 when he has none.</summary>
        private static int CarriedTier(Villager villager, Skills.SkillType skill)
        {
            int tier = 0;
            Inventory inventory = villager.GetInventory();
            if (inventory == null)
            {
                return 0;
            }

            foreach (ItemDrop.ItemData item in inventory.GetAllItems())
            {
                if (item?.m_shared != null && item.m_shared.m_skillType == skill)
                {
                    tier = Mathf.Max(tier, item.m_shared.m_toolTier);
                }
            }

            return tier;
        }

        // ---------------------------------------------------------------- tidying up

        /// <summary>
        /// Worth carrying to the chest: building materials, food and crafting materials (resin, leather, feathers,
        /// meat...). Never weapons, armour, tools or anything a player is standing over.
        /// </summary>
        public static bool Useful(ItemDrop item)
        {
            ItemDrop.ItemData data = item != null ? item.m_itemData : null;
            if (data?.m_shared == null)
            {
                return false;
            }

            string name = Utils.GetPrefabName(item.gameObject);
            if (Materials.Tracked.Contains(name))
            {
                return true;
            }

            ItemDrop.ItemData.ItemType type = data.m_shared.m_itemType;
            return type == ItemDrop.ItemData.ItemType.Material || type == ItemDrop.ItemData.ItemType.Consumable;
        }

        /// <summary>
        /// With nothing else to do, a villager picks up a useful thing lying in the village (Tyler, T-15: resin on the
        /// ground with nobody touching it) and takes it to the chest. Within the village radius only; nothing a player
        /// stands right by.
        /// </summary>
        private static bool TryTidy(Villager villager, Work work)
        {
            VillageHearth home = VillageHearth.Find(villager.VillageId);
            if (home == null || !home.IsValid || (LogicConfig.IdlePickup != null && !LogicConfig.IdlePickup.Value))
            {
                return false;
            }

            Vector3 hearth = home.transform.position;
            float radius = Mathf.Min(VillheimConfig.VillageRadius.Value, MaxFromHearth);
            GameObject found = FindNearest(hearth, MaxFromHearth, villager.transform.position, go =>
            {
                ItemDrop item = go.GetComponent<ItemDrop>();
                if (item == null || !Useful(item) || Utils.DistanceXZ(go.transform.position, hearth) > radius)
                {
                    return false;
                }

                Player near = Player.GetClosestPlayer(go.transform.position, 4f);
                return near == null;
            }, null);

            if (found == null)
            {
                return false;
            }

            work.Profile = Woodcutter;
            work.Wanted.Clear();
            work.Tidying = true;
            Begin(villager, work, Phase.Collect, null, found.transform.position, 45f);
            work.Spot = found.transform.position;
            work.Target = found;
            Started(villager, work, "picking up " + Utils.GetPrefabName(found) + " lying in the village");
            return true;
        }

        /// <summary>Starts a job with this profile. Returns null when started, or why not ("" when not wanted).</summary>
        private static string TryProfile(Villager villager, Work work, VillageNeeds needs, Profile profile)
        {
            work.Profile = profile;
            work.Wanted.Clear();
            foreach (string material in needs.Missing.Keys)
            {
                if (Materials.WoodTypes.Contains(material) == (profile == Woodcutter))
                {
                    work.Wanted.Add(material);
                }
            }

            if (work.Wanted.Count == 0)
            {
                return "";
            }

            Vector3 position = villager.transform.position;
            Vector3 hearth = villager.Zdo.GetVec3(Keys.VillagerHearth, position);
            work.Skip.Clear();
            work.Swings = 0;
            work.Spot = position;

            // The village works further out as it grows, but only where it has the gear for the land (Knowledge).
            float reach = Village.Knowledge.WorkRadius(villager.VillageId, MaxFromHearth);
            ItemDrop drop = NearestDrop(work.Wanted, hearth, reach, position, work.Skip);
            if (drop != null)
            {
                Begin(villager, work, Phase.Collect, null, drop.transform.position, 45f);
                Started(villager, work, "picking up " + Utils.GetPrefabName(drop.gameObject));
                return null;
            }

            // Then ground to clear (Tyler, T-11/T-12): trees, stumps, rocks and loose sticks and stones round the hearth
            // and on the paths waiting to be laid, when it gives something the village wants. The rest of it is cleared
            // when there is no other work.
            if (TryClear(villager, work, needs, true))
            {
                return null;
            }

            // Everyone carries an axe and a pickaxe, so anyone can fell or mine; the right one goes in hand only once
            // there is something to work (looking for work had taken it out every few seconds).
            work.CanHarvest = VillagerLooks.Carries(villager, profile.Tool) || VillagerLooks.Hold(villager, profile.Tool);
            int tier = ToolTier(villager);
            HashSet<string> wanted = work.Wanted;
            GameObject target = !work.CanHarvest ? null
                : FindNearest(hearth, reach, position,
                      go => profile.IsPartial(go) && Yields.GivesAny(go, wanted) && TierAllows(go, tier) &&
                            Village.Knowledge.MayWork(villager.VillageId, hearth, go.transform.position, MaxFromHearth), null)
                  ?? FindNearest(hearth, reach, position,
                      go => profile.IsSource(go) && Yields.GivesAny(go, wanted) && TierAllows(go, tier) &&
                            Village.Knowledge.MayWork(villager.VillageId, hearth, go.transform.position, MaxFromHearth), null);
            if (target == null)
            {
                // Loose sticks and stones give one each, so they are only worth it when there is nothing bigger to
                // work, and only close by.
                Pickable pickable = NearestPickable(work.Wanted, position, PickableRadius);
                if (pickable != null)
                {
                    Claimed.Add(pickable.gameObject);
                    Begin(villager, work, Phase.Pick, pickable.gameObject, pickable.transform.position, 30f);
                    Started(villager, work, "picking " + Utils.GetPrefabName(pickable.gameObject));
                    return null;
                }

                return !work.CanHarvest
                    ? $"no {profile.Tool.ToString().ToLowerInvariant()} to work with"
                    : $"nothing within reach that gives {string.Join(" or ", Labels(wanted))} for this tool";
            }

            Claimed.Add(target);
            Begin(villager, work, Phase.Approach, target, target.transform.position, 90f);
            VillagerLooks.Hold(villager, profile.Tool);
            Started(villager, work, (profile.IsPartial(target) ? profile.PartialActivity : profile.Activity) +
                                    $" ({Utils.GetPrefabName(target)}, {Utils.DistanceXZ(position, target.transform.position):0} m away)");
            return null;
        }

        private static void Started(Villager villager, Work work, string what)
        {
            work.Reason = "";
            TaskGestures.SettingOff(villager, work.Target != null ? work.Target.transform.position : work.Spot);
            VillheimPlugin.Debug($"{villager.VillagerName}: {what}.");
        }

        /// <summary>Remembers why there is no work, and logs it when the reason changes.</summary>
        private static void NoWork(Villager villager, Work work, string reason)
        {
            if (work.Reason != reason)
            {
                work.Reason = reason;
                VillheimPlugin.Debug($"{villager.VillagerName} has no work: {reason}.");
            }
        }

        /// <summary>
        /// Between two jobs: there is work, he just hasn't started the next one yet (a second or two). He waits where
        /// he is instead of going to sit by the fire for a moment.
        /// </summary>
        public static bool BetweenJobs(Villager villager)
        {
            return VillheimConfig.VillagersChopTrees.Value && !EnvMan.IsNight() &&
                   States.TryGetValue(villager, out Work work) && work.Phase == Phase.Idle && work.Reason == "";
        }

        /// <summary>Why the villager is not working, or null while working.</summary>
        public static string IdleReason(Villager villager)
        {
            return States.TryGetValue(villager, out Work work) && work.Phase == Phase.Idle && work.Reason != ""
                ? work.Reason
                : null;
        }

        private static int ToolTier(Villager villager)
        {
            return villager.GetCurrentWeapon()?.m_shared?.m_toolTier ?? 0;
        }

        /// <summary>The held tool is good enough to break this (an antler pickaxe does nothing to copper, and so on).</summary>
        private static bool TierAllows(GameObject go, int tier)
        {
            if (Village.VillageWood.GivesWood(go)) return true; // Yggdrasil shoots (D-052, T-55)
            if (InMistlands(go) && IsRock(go)) return true; // Mistlands rock: villagers break it whatever their tools (T-55)
            if (go.TryGetComponent(out TreeBase tree)) return tree.m_minToolTier <= tier;
            if (go.TryGetComponent(out TreeLog log)) return log.m_minToolTier <= tier;
            if (go.TryGetComponent(out MineRock5 rock5)) return rock5.m_minToolTier <= tier;
            if (go.TryGetComponent(out MineRock rock)) return rock.m_minToolTier <= tier;
            if (go.TryGetComponent(out Destructible destructible)) return destructible.m_minToolTier <= tier;
            return true;
        }

        private static void Begin(Villager villager, Work work, Phase phase, GameObject target, Vector3 spot, float seconds)
        {
            work.StartedAt = Time.time;
            work.Progressed = false;
            work.Phase = phase;
            work.Target = target;
            work.HitAt = -1f;
            work.StraightUntil = 0f;
            work.Picks = 0;
            work.FellingTree = null;
            work.Spot = spot;
            work.Deadline = Time.time + seconds;
            work.Timer = 0.6f;
            work.TargetSeenAt = new Vector3(float.MaxValue, 0f, 0f);
            Walker.For(villager).Reset();
        }

        private static bool UpdateWork(Villager villager, VillagerAI ai, Work work, float dt)
        {
            Profile profile = work.Profile;
            if (Time.time > work.Deadline || work.Swings >= profile.MaxSwingsPerSource)
            {
                BeginCollect(villager, work);
                return true;
            }

            if (work.Target == null)
            {
                if (work.FellingTree != null)
                {
                    // One sapling planted for every tree felled, out past the village (see Replanting).
                    Replanting.Owe(villager.VillageId, work.FellingTree);
                    work.FellingTree = null;
                }

                // The tree fell or a log split. Keep working what lies around the spot, then collect.
                HashSet<string> wanted = work.Wanted;
                int tier = ToolTier(villager);
                GameObject next = FindNearest(work.Spot, WorkRange, work.Spot,
                    go => profile.IsPartial(go) && Yields.GivesAny(go, wanted) && TierAllows(go, tier), work.Skip);
                if (next == null)
                {
                    BeginCollect(villager, work);
                    return true;
                }

                Claimed.Add(next);
                work.Target = next;
                work.HitAt = -1f;
                work.StraightUntil = 0f;
                work.Swings = 0;
                work.TargetSeenAt = new Vector3(float.MaxValue, 0f, 0f);
                Walker.For(villager).Reset();
            }

            // Work out where to stand once per target, again only if it moves (logs roll).
            if (Vector3.Distance(work.Target.transform.position, work.TargetSeenAt) > 0.5f)
            {
                work.TargetSeenAt = work.Target.transform.position;
                Vector3 hearth = villager.Zdo.GetVec3(Keys.VillagerHearth, villager.transform.position);
                work.Stand = StandSpot(work.Target, villager.transform.position, hearth, out work.Contact);
            }

            Walker walker = Walker.For(villager);
            // Once at work he stays put at the longer reach: a step back from a swing doesn't send him walking again.
            bool close = InReach(villager, work.Contact, walker.IsArrived || work.Phase == Phase.Work);
            if (!close)
            {
                work.Phase = Phase.Approach;
                // Out to a tree or rock: harvesting is work worth hurrying for, so they run there.
                WalkResult step = walker.Go(villager, ai, dt, work.Stand, 0.6f, true);
                if (step != WalkResult.Walking && !InReach(villager, work.Contact, true))
                {
                    // The path often ends short of a tree or rock (it blocks the ground around itself). Walk the
                    // last metres straight at it for a few seconds before giving up.
                    if (work.StraightUntil <= 0f)
                    {
                        work.StraightUntil = Time.time + 4f;
                    }

                    if (Time.time < work.StraightUntil)
                    {
                        Vector3 toTarget = work.Contact - villager.transform.position;
                        toTarget.y = 0f;
                        ai.MoveTowards(toTarget.normalized, false);
                        return true;
                    }
                }

                if (step == WalkResult.Walking)
                {
                    return true;
                }

                // Cannot get next to it. Never hit from a distance: set it aside and look for other work.
                VillheimPlugin.Debug($"{villager.VillagerName} could not get next to {Utils.GetPrefabName(work.Target)}.");
                MarkUnreachable(work.Target);
                work.Skip.Add(work.Target);
                ReleaseTarget(work);
                BeginCollect(villager, work);
                return true;
            }

            if (work.Phase != Phase.Work)
            {
                work.Phase = Phase.Work;
                work.FacingSince = Time.time;
            }

            ai.StopMoving();
            VillagerLooks.Hold(villager, profile.Tool);
            Face(villager, ai, work.Contact);
            LandPendingHit(villager, work, profile);
            work.Timer -= dt;
            Vector3 toContact = work.Contact - villager.transform.position;
            toContact.y = 0f;
            bool facing = Vector3.Angle(villager.transform.forward, toContact) < 20f || Time.time - work.FacingSince > 3f;
            // Only from a standstill: a swing started while still moving carried him on with his legs running.
            bool still = villager.GetVelocity().magnitude < 0.3f || Time.time - work.FacingSince > 3f;
            if (work.Timer <= 0f && facing && still && work.HitAt < 0f)
            {
                // Check the reach again on every swing: never hit something that is out of arm's length. A standing
                // tree is struck at the trunk.
                Collider struck = null;
                Vector3 contact = work.Target.GetComponent<TreeBase>() != null
                    ? work.Target.transform.position + Vector3.up
                    : ContactPoint(work.Target, villager.transform.position, out struck);
                if (!CanHit(villager, work.Target, contact))
                {
                    work.Phase = Phase.Approach;
                    work.TargetSeenAt = new Vector3(float.MaxValue, 0f, 0f);
                    walker.Reset();
                    return true;
                }

                // The swing starts now; the blow lands when the tool comes down.
                work.Timer = SwingInterval;
                work.Swings++;
                work.Contact = contact;
                work.HitPoint = contact;
                work.HitCollider = struck;
                work.HitAt = Time.time + HitDelay;
                SwingAnimation(villager);
            }

            return true;
        }

        private static bool UpdatePick(Villager villager, VillagerAI ai, Work work, float dt)
        {
            if (Time.time > work.Deadline || work.Target == null)
            {
                BeginCollect(villager, work);
                return true;
            }

            WalkResult step = Walker.For(villager).Go(villager, ai, dt, work.Target.transform.position, 1.2f, true);
            if (step == WalkResult.Walking)
            {
                return true;
            }

            if (step == WalkResult.Stuck && Utils.DistanceXZ(villager.transform.position, work.Target.transform.position) > 2.5f)
            {
                MarkUnreachable(work.Target);
                ReleaseTarget(work);
                BeginCollect(villager, work);
                return true;
            }

            ai.StopMoving();
            Face(villager, ai, work.Target.transform.position);
            if (work.Target.TryGetComponent(out Pickable pickable))
            {
                pickable.Interact(villager, false, false);
                work.Progressed = true;
            }

            ReleaseTarget(work);

            // Pick up the next stick or stone close by before carrying them all back.
            work.Picks++;
            Pickable next = work.Picks < MaxPicksPerTrip ? NearestPickable(work.Wanted, villager.transform.position, 8f) : null;
            if (next != null)
            {
                Claimed.Add(next.gameObject);
                work.Target = next.gameObject;
                work.Deadline = Time.time + 20f;
                Walker.For(villager).Reset();
                return true;
            }

            BeginCollect(villager, work);
            work.Deadline = Time.time + 15f;
            return true;
        }

        private static void BeginCollect(Villager villager, Work work)
        {
            ReleaseTarget(work);
            work.Phase = Phase.Collect;
            work.Deadline = Time.time + 45f;
            work.NextCheck = 0f;
            Walker.For(villager).Reset();
        }

        private static bool UpdateCollect(Villager villager, VillagerAI ai, Work work, float dt)
        {
            if (Time.time > work.Deadline)
            {
                BeginDeliver(villager, work);
                return true;
            }

            // Pick a drop to walk to a couple of times a second, not every frame.
            if (Time.time >= work.NextCheck || work.Target == null)
            {
                work.NextCheck = Time.time + 0.5f;
                ItemDrop drop = work.Tidying
                    ? NearestUseful(work.Spot, 4f, work.Skip)
                    : NearestDrop(Materials.Tracked, work.Spot, WorkRange, work.Spot, work.Skip);
                if (drop == null)
                {
                    BeginDeliver(villager, work);
                    return true;
                }

                if (work.Target != drop.gameObject)
                {
                    work.Target = drop.gameObject;
                    Walker.For(villager).Reset();
                }
            }

            if (work.Target == null)
            {
                return true;
            }

            Vector3 at = work.Target.transform.position;
            float distance = Utils.DistanceXZ(villager.transform.position, at);
            WalkResult step = distance < 2f ? WalkResult.Arrived : Walker.For(villager).Go(villager, ai, dt, at, 1.4f, true);
            if (step == WalkResult.Walking)
            {
                return true;
            }

            if (step == WalkResult.Stuck && distance > 3.5f)
            {
                // Wedged somewhere unreachable (under a log, on a ledge). Leave it.
                work.Skip.Add(work.Target);
                work.Target = null;
                return true;
            }

            ai.StopMoving();
            Face(villager, ai, at);
            PickUpAround(work, villager.transform.position, 3f, work.Tidying);
            work.Target = null;
            work.NextCheck = 0f;
            return true;
        }

        private static void PickUpAround(Work work, Vector3 center, float radius, bool anyUseful = false)
        {
            var seen = new HashSet<ItemDrop>();
            foreach (Collider collider in Physics.OverlapSphere(center, radius))
            {
                ItemDrop item = collider.GetComponentInParent<ItemDrop>();
                if (item == null || !seen.Add(item) ||
                    !(anyUseful ? Useful(item) : Materials.Tracked.Contains(Utils.GetPrefabName(item.gameObject))))
                {
                    continue;
                }

                ZNetView view = item.GetComponent<ZNetView>();
                if (view == null || !view.IsValid())
                {
                    continue;
                }

                string material = Utils.GetPrefabName(item.gameObject);
                work.Carrying.TryGetValue(material, out int amount);
                work.Carrying[material] = amount + item.m_itemData.m_stack;
                view.ClaimOwnership();
                ZNetScene.instance.Destroy(item.gameObject);
            }
        }

        private static void BeginDeliver(Villager villager, Work work)
        {
            ReleaseTarget(work);
            if (work.Carrying.Count == 0)
            {
                Finish(work);
                return;
            }

            work.Phase = Phase.Deliver;
            work.Deadline = Time.time + 90f;
            Walker.For(villager).Reset();
        }

        /// <summary>Carries what was gathered to the village chest, or to the hearth while there is none.</summary>
        private static bool UpdateDeliver(Villager villager, VillagerAI ai, Work work, float dt)
        {
            VillageNeeds needs = VillageNeeds.For(villager.VillageId);
            if (needs == null)
            {
                Finish(work);
                return false;
            }

            Vector3 target = needs.DropOff;
            float distance = Utils.DistanceXZ(villager.transform.position, target);
            // Back from harvesting with the load: a run is fine (village chores are walked).
            WalkResult step = Time.time > work.Deadline ? WalkResult.Stuck : Walker.For(villager).Go(villager, ai, dt, target, DeliverReach, true);
            if (step == WalkResult.Walking)
            {
                return true;
            }

            // Stuck far from the chest: the materials still count, as if handed along.
            ai.StopMoving();
            if (distance < 4f)
            {
                Face(villager, ai, target);
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            Container chest = hearth != null && needs.ToChest ? VillageChest.Find(hearth) : null;
            foreach (KeyValuePair<string, int> carried in work.Carrying)
            {
                int left = carried.Value;
                if (chest != null && distance < 4f)
                {
                    left -= VillageChest.Add(chest, carried.Key, left);
                }

                if (left > 0)
                {
                    VillageBrain.AddMaterial(villager.VillageId, carried.Key, left);
                }

                VillheimPlugin.Debug($"{villager.VillagerName} brought {carried.Value} {Materials.Label(carried.Key)} " +
                                     $"to {(chest != null && distance < 4f ? "the village chest" : villager.VillageName)}.");
            }

            work.Carrying.Clear();
            work.Progressed = true;
            VillageNeeds.Forget(villager.VillageId);
            Finish(work);
            return false;
        }

        /// <summary>
        /// The builder walks to the next piece and stands right beside it, then hammers at it for a moment before it
        /// goes up. Once he is in reach he stays put (no more walking) until the piece is placed, so he doesn't shuffle
        /// back and forth. A piece only goes up while he is there. When the chest runs short he goes back to gathering.
        /// </summary>
        private static bool UpdateBuild(Villager villager, VillagerAI ai, Work work, float dt)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid || !ConstructionSite.IsActive(hearth.Zdo) ||
                !ConstructionSite.NextPiecePosition(hearth, out Vector3 piece))
            {
                Finish(work);
                return false;
            }

            Vector3 position = villager.transform.position;
            NoteHelping(villager);
            int slot = HelperSlot(villager);

            // A helper works on his own piece in another part of the building when one is held up already (Tyler: they
            // all walked to the same spot); the builder too, while someone stands where the next piece goes.
            int own = -1;
            if (slot > 0 && ConstructionSite.HelperPiece(hearth, slot, out int helperIndex, out Vector3 helperAt))
            {
                own = helperIndex;
                piece = helperAt;
            }
            else if (slot == 0 && work.OwnPiece >= 0 && ConstructionSite.AheadStillOpen(hearth, work.OwnPiece) &&
                     ConstructionSite.PiecePosition(hearth, work.OwnPiece, out Vector3 detour))
            {
                own = work.OwnPiece;
                piece = detour;
            }

            work.OwnPiece = own;
            if (Vector3.Distance(piece, work.Contact) > 0.3f || slot != work.HelperSlot)
            {
                // A new piece: work out where to stand for it (a helper at his own side of it).
                work.Contact = piece;
                work.HelperSlot = slot;
                work.Stand = slot > 0 && own < 0 ? HelperStand(hearth, villager, piece, slot) : ConstructionSite.StandSpot(hearth, piece, position);
                work.Picks = 0;
                work.Deadline = Time.time + 30f;
                Walker.For(villager).Reset();
            }
            else if (slot > 0 && Time.time >= work.StandCheckAt)
            {
                // The builder (or another helper) moved in on his spot: a new one, so two never work on top of each
                // other (Tyler: two of them stacked, making the same motions).
                work.StandCheckAt = Time.time + 0.75f;
                if (Crowded(villager, work.Stand))
                {
                    work.Stand = own < 0 ? HelperStand(hearth, villager, piece, slot) : ConstructionSite.StandSpot(hearth, piece, position, 1.2f);
                    Walker.For(villager).Reset();
                }
            }

            NoteStand(villager, work.Stand);

            bool stubborn = work.Misses >= 2 && Vector3.Distance(work.MissedPiece, piece) < 0.3f;
            bool inReach = (slot > 0 && own < 0 ? Utils.DistanceXZ(position, work.Stand) < 0.8f && Mathf.Abs(piece.y - position.y) < 7f
                                                : ConstructionSite.InBuildReach(hearth, position, piece)) ||
                           (stubborn && Utils.DistanceXZ(position, piece) < 5f && Mathf.Abs(piece.y - position.y) < 10f);
            if (inReach && own < 0 && ConstructionSite.InsideNextPiece(hearth, villager))
            {
                // Standing where the piece goes: step further out first.
                inReach = false;
                if (work.Picks < 3)
                {
                    work.Picks++;
                    work.Stand = ConstructionSite.StandSpot(hearth, piece, position, 1.2f * work.Picks);
                    Walker.For(villager).Reset();
                }
            }

            if (!inReach)
            {
                // Back to the site with work waiting: he runs (Tyler, T-11), walking only the last metres.
                WalkResult step = Walker.For(villager).Go(villager, ai, dt, work.Stand, 0.5f, true);
                if (step == WalkResult.Walking && Time.time < work.Deadline)
                {
                    work.Timer = 0f;
                    return true;
                }

                if (!ConstructionSite.InBuildReach(hearth, villager.transform.position, piece))
                {
                    if (own >= 0)
                    {
                        // His own piece is out of reach: he helps at the next one instead for a while.
                        work.OwnPiece = -1;
                        Village.Perf.Debug($"{villager.VillagerName} can't get to {VillagerLooks.His(villager)} piece of the building; helping at the next one.");
                        Finish(work);
                        work.Cooldown = 2f;
                        return false;
                    }

                    // Can't get next to it: gather for a while before trying again, instead of walking back at once.
                    work.Misses = Vector3.Distance(work.MissedPiece, piece) < 0.3f ? work.Misses + 1 : 1;
                    work.MissedPiece = piece;
                    if (work.Misses >= 4 && slot == 0)
                    {
                        // Four times and he still can't reach it: it goes up from where he is, rather than the
                        // building standing still for good.
                        VillheimPlugin.Log.LogWarning($"{hearth.VillageName}: {villager.VillagerName} could not reach the next piece of " +
                                                      $"the building at {piece} four times; it is put up from where he stands.");
                        work.Misses = 0;
                        if (ConstructionSite.PlaceNext(hearth, true))
                        {
                            ConstructionSite.NoteBuilder(villager.VillageId);
                            work.Progressed = true;
                        }

                        VillageNeeds.Forget(villager.VillageId);
                        Finish(work);
                        work.Cooldown = 1f;
                        return false;
                    }

                    work.BuildRetryAt = Time.time + 25f;
                    VillheimPlugin.Debug($"{villager.VillagerName} can't get next to the next piece (miss {work.Misses}); trying again later.");
                    Finish(work);
                    work.Cooldown = 2f;
                    return false;
                }
            }

            ai.StopMoving();
            // Clearing the plot (D-087): the axe for wood, the pickaxe for rock, bare hands for a plant.
            VillagerLooks.Tool? tool = ConstructionSite.WorkTool(hearth);
            if (tool.HasValue)
            {
                VillagerLooks.Hold(villager, tool.Value);
            }

            Face(villager, ai, piece);
            work.Timer += dt;
            // Each helper keeps his own beat, so no two swing together (T-107).
            if (tool.HasValue && (work.Timer + slot * HammerInterval * 0.37f) % HammerInterval < dt)
            {
                ToolAnimation(villager, tool.Value);
            }

            // Mood never changes how fast anyone works (D-014); only skill does. Mood changes free time.
            float perPiece = (LogicConfig.SecondsPerPiece != null ? LogicConfig.SecondsPerPiece.Value : 2.5f) *
                             ConstructionSite.WorkTimeFactor(hearth) /
                             VillagerSkills.WorkFactor(villager, "building") + slot * 0.45f;
            if (work.Timer < perPiece)
            {
                return true;
            }

            if (ConstructionSite.PieceBlocked(hearth, own, villager, out string who, out bool player))
            {
                if (Vector3.Distance(work.BlockedPiece, piece) > 0.3f || work.BlockedSince < 0f)
                {
                    work.BlockedPiece = piece;
                    work.BlockedSince = Time.time;
                }

                float waited = Time.time - work.BlockedSince;
                float patience = LogicConfig.BuildBlockedSeconds != null ? Mathf.Max(3f, LogicConfig.BuildBlockedSeconds.Value) : 20f;
                if (work.Reason != "blocked:" + who)
                {
                    work.Reason = "blocked:" + who;
                    Village.Perf.Debug($"{villager.VillagerName} waits for {who} to move out of the way.");
                }

                if (own < 0 && slot == 0 && waited > patience && ConstructionSite.SparePiece(hearth, out int spare))
                {
                    // He works on another part of the building meanwhile.
                    work.OwnPiece = spare;
                    work.Timer = 0f;
                    Village.Perf.Debug($"{villager.VillagerName}: {who} has stood where the next piece goes for {waited:0} s; " +
                                       "working on another part of the building meanwhile.");
                    return true;
                }

                if (!player && waited > patience * 3f)
                {
                    // Nothing has moved for a long while (a model, a stuck animal): the piece goes up anyway, rather
                    // than the builder hammering at nothing for good.
                    VillheimPlugin.Log.LogWarning($"{hearth.VillageName}: {who} stood where a piece of the building goes for " +
                                                  $"{waited:0} s; {villager.VillagerName} put it up anyway.");
                }
                else
                {
                    if (player && Time.time > work.BlockedLogAt)
                    {
                        work.BlockedLogAt = Time.time + 60f;
                        Village.Perf.Debug($"{villager.VillagerName} waits for {who} (a player) to step off the next piece.");
                    }

                    work.Timer = perPiece - 1f;
                    return true;
                }
            }

            work.Reason = "";
            if (own < 0)
            {
                work.BlockedSince = -1f; // a piece put up meanwhile keeps the clock on the blocked one running
            }

            work.Timer = 0f;
            bool placed = own >= 0 ? ConstructionSite.PlaceAhead(hearth, own, true) : ConstructionSite.PlaceNext(hearth, true);
            if (placed)
            {
                ConstructionSite.NoteBuilder(villager.VillageId);
                VillageNeeds.Forget(villager.VillageId);
                work.Progressed = true;
                work.Misses = 0;
                if (own >= 0 && slot == 0)
                {
                    work.OwnPiece = -1; // back to the next piece
                }

                return true;
            }

            if (own >= 0 && !ConstructionSite.AheadStillOpen(hearth, own))
            {
                // Someone else put it up, or it waits on another piece now: a new one next frame.
                work.OwnPiece = -1;
                return true;
            }

            // Out of materials (or done). Back to gathering until the chest fills up again.
            VillageNeeds.Forget(villager.VillageId);
            Finish(work);
            work.Cooldown = 1f;
            return false;
        }

        // Each helper keeps the place he was given when he joined (1, 2, 3...), and stays on the list while he is at
        // the building. The list had been refreshed only when a piece went up and emptied of anyone not refreshed for 3
        // seconds, so a helper still walking over lost his place, counted as the builder and stood where the builder
        // stood (Tyler: two of them stacked on top of each other).
        private static readonly Dictionary<int, Dictionary<Villager, (float Time, int Slot)>> Helpers =
            new Dictionary<int, Dictionary<Villager, (float, int)>>();

        // Where everyone at the building stands right now, so a helper can keep clear of the builder and the others.
        private static readonly Dictionary<int, Dictionary<Villager, (float Time, Vector3 Stand)>> Stands =
            new Dictionary<int, Dictionary<Villager, (float, Vector3)>>();

        private const float HelperSeconds = 10f;
        private const float HelperGap = 2.5f;

        /// <summary>
        /// A villager between jobs (not carrying, not out at a tree or rock) joins the builder while the chest covers the
        /// next part of the building, up to BuildHelpers of them (T-54). Elders, children and wanderers never do.
        /// </summary>
        private static bool JoinsBuilding(Villager villager, Work work)
        {
            int most = LogicConfig.BuildHelpers != null ? LogicConfig.BuildHelpers.Value : 3;
            Roles.Trade trade = Roles.TradeOf(villager);
            if (most <= 0 || work.Phase != Phase.Idle || work.Carrying.Count > 0 || Wanderers.IsWanderer(villager) ||
                trade == Roles.Trade.Cook || trade == Roles.Trade.Farmer || trade == Roles.Trade.Healer || Elders.IsElder(villager))
            {
                return false;
            }

            if (!Helpers.TryGetValue(villager.VillageId, out Dictionary<Villager, (float Time, int Slot)> helping))
            {
                Helpers[villager.VillageId] = helping = new Dictionary<Villager, (float, int)>();
            }

            foreach (Villager gone in helping.Where(h => h.Key == null || h.Key.IsDead() || Time.time - h.Value.Time > HelperSeconds)
                         .Select(h => h.Key).ToList())
            {
                helping.Remove(gone);
            }

            if (!helping.ContainsKey(villager) && helping.Count >= most)
            {
                return false;
            }

            int slot = helping.TryGetValue(villager, out var mine) ? mine.Slot : 1;
            while (!helping.ContainsKey(villager) && helping.Values.Any(h => h.Slot == slot))
            {
                slot++;
            }

            helping[villager] = (Time.time, slot);
            VillheimPlugin.Debug($"{villager.VillagerName} goes to help with the building.");
            return true;
        }

        /// <summary>
        /// A helper's place among the helpers (1, 2, 3...), 0 for the builder or someone not helping. Helpers stand
        /// round the piece at their own side (HelperStand), so nobody works on top of anyone else (T-105, T-107).
        /// </summary>
        private static int HelperSlot(Villager villager)
        {
            return !IsVillageBuilder(villager) && Helpers.TryGetValue(villager.VillageId, out var helping) &&
                   helping.TryGetValue(villager, out var mine) && Time.time - mine.Time <= HelperSeconds
                ? mine.Slot
                : 0;
        }

        /// <summary>Still building as a helper: keeps his place among the helpers.</summary>
        private static void NoteHelping(Villager villager)
        {
            if (Helpers.TryGetValue(villager.VillageId, out var helping) && helping.TryGetValue(villager, out var mine))
            {
                helping[villager] = (Time.time, mine.Slot);
            }
        }

        private static void NoteStand(Villager villager, Vector3 stand)
        {
            if (!Stands.TryGetValue(villager.VillageId, out var stands))
            {
                Stands[villager.VillageId] = stands = new Dictionary<Villager, (float, Vector3)>();
            }

            stands[villager] = (Time.time, stand);
        }

        /// <summary>The others at the building right now: where each stands, and where each is going to stand.</summary>
        private static IEnumerable<Vector3> OthersAtBuilding(Villager villager)
        {
            if (!Stands.TryGetValue(villager.VillageId, out var stands))
            {
                yield break;
            }

            foreach (KeyValuePair<Villager, (float Time, Vector3 Stand)> other in stands)
            {
                if (other.Key == villager || other.Key == null || other.Key.IsDead() || Time.time - other.Value.Time > 2f)
                {
                    continue;
                }

                yield return other.Value.Stand;
                yield return other.Key.transform.position;
            }
        }

        /// <summary>Someone else at the building stands, or means to stand, within HelperGap of the spot.</summary>
        private static bool Crowded(Villager villager, Vector3 spot) =>
            OthersAtBuilding(villager).Any(p => Utils.DistanceXZ(p, spot) < HelperGap);

        /// <summary>
        /// Where a helper stands: round the next piece, starting a third of a turn from the builder's side for each
        /// helper, at the first place at least HelperGap from the builder and every other helper (where they stand and
        /// where they are headed). Further out when the near ring is full.
        /// </summary>
        private static Vector3 HelperStand(VillageHearth hearth, Villager villager, Vector3 piece, int slot)
        {
            Vector3 builderStand = ConstructionSite.StandSpot(hearth, piece, hearth.transform.position);
            Vector3 out_ = (builderStand - piece).Horizontal();
            out_ = out_.sqrMagnitude > 0.01f ? out_.normalized : Vector3.forward;
            List<Vector3> others = OthersAtBuilding(villager).ToList();
            float near = ConstructionSite.NextPieceHalfWidth(hearth) + 1.4f;
            Vector3 fallback = piece;
            float fallbackGap = -1f;
            for (int ring = 0; ring < 3; ring++)
            {
                float radius = near + ring * 1.2f + 0.3f * slot;
                for (int step = 0; step < 12; step++)
                {
                    float angle = 120f * slot + (slot > 2 ? 60f : 0f) + (step % 2 == 0 ? 1 : -1) * 30f * ((step + 1) / 2);
                    Vector3 spot = piece + Quaternion.Euler(0f, angle, 0f) * out_ * radius;
                    if (ZoneSystem.instance.GetGroundHeight(spot, out float y))
                    {
                        spot.y = y;
                    }

                    float gap = others.Count == 0 ? float.MaxValue : others.Min(p => Utils.DistanceXZ(p, spot));
                    if (gap >= HelperGap)
                    {
                        return spot;
                    }

                    if (gap > fallbackGap)
                    {
                        fallbackGap = gap;
                        fallback = spot;
                    }
                }
            }

            return fallback;
        }

        /// <summary>An essential amenity (see Amenities.Find) is due and the chest pays for it. Looked at every few seconds.</summary>
        private static bool EssentialDue(Villager villager, Work work)
        {
            work.NextNeedCheck = Time.time + 3f;
            if (Time.time < work.MakeRetryAt)
            {
                return false;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            Amenities.Job job = hearth != null && hearth.IsValid ? Amenities.Due(hearth) : null;
            return job != null && job.Essential;
        }

        /// <summary>The village's builder is about and makes the amenities (FreeTime leaves them to him).</summary>
        public static bool BuilderMakes(int villageId) =>
            Builders.TryGetValue(villageId, out var cached) && Time.time - cached.Time < 10f && cached.Builder != ZDOID.None;

        private static readonly Dictionary<int, (string Job, float Since)> EssentialWaiting = new Dictionary<int, (string, float)>();
        private static readonly Dictionary<int, (ZDOID Maker, float Until)> HelperMaking = new Dictionary<int, (ZDOID, float)>();

        /// <summary>One helper at a time makes an essential that has waited 90 s for the builder.</summary>
        private static bool HelperMakes(Villager villager, Work work)
        {
            if (Time.time < work.MakeRetryAt || Childhood.IsChild(villager))
            {
                return false;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            Amenities.Job job = hearth != null && hearth.IsValid ? Amenities.Due(hearth) : null;
            int id = villager.VillageId;
            if (job == null || !job.Essential)
            {
                EssentialWaiting.Remove(id);
                return false;
            }

            string key = $"{job.Prefab}:{Mathf.RoundToInt(job.Spot.x)}:{Mathf.RoundToInt(job.Spot.z)}";
            if (!EssentialWaiting.TryGetValue(id, out var waiting) || waiting.Job != key)
            {
                EssentialWaiting[id] = (key, Time.time);
                return false;
            }

            if (Time.time - waiting.Since < 90f)
            {
                return false;
            }

            ZDOID me = villager.GetZDOID();
            if (HelperMaking.TryGetValue(id, out var maker) && maker.Until > Time.time && maker.Maker != me)
            {
                return false;
            }

            HelperMaking[id] = (me, Time.time + 90f);
            if (!TryMake(villager, work))
            {
                return false;
            }

            VillheimPlugin.Debug($"{villager.VillagerName} makes the {job.Name}: it waited {Time.time - waiting.Since:0} s for the builder.");
            return true;
        }

        /// <summary>Starts making the next amenity piece the chest can pay for. False when there is none.</summary>
        private static bool TryMake(Villager villager, Work work)
        {
            if (Time.time < work.MakeRetryAt)
            {
                return false;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            Amenities.Job job = hearth != null && hearth.IsValid ? Amenities.Due(hearth) : null;
            if (job == null)
            {
                return false;
            }

            Begin(villager, work, Phase.Make, null, job.Spot, 60f);
            work.Making = job;
            work.Timer = 0f;
            work.Stand = MakeStand(job, villager.transform.position);
            Started(villager, work, $"making a {job.Name}{(job.Pieces > 1 ? $" ({job.Pieces} pieces to go)" : "")}");
            return true;
        }

        /// <summary>Where to stand to make a piece: in front of it inside a building, else a step from it on his side.</summary>
        private static Vector3 MakeStand(Amenities.Job job, Vector3 from)
        {
            Vector3 stand;
            if (job.Inside)
            {
                stand = job.Spot + job.Rotation * Vector3.forward * 1.6f;
            }
            else
            {
                Vector3 away = (from - job.Spot).Horizontal();
                stand = job.Spot + (away.sqrMagnitude > 0.01f ? away.normalized : Vector3.forward) * 1.6f;
            }

            if (ZoneSystem.instance.GetGroundHeight(stand, out float y) && (!job.Inside || Mathf.Abs(y - job.Spot.y) < 1f))
            {
                stand.y = y;
            }

            return stand;
        }

        /// <summary>
        /// The builder makes an amenity the way he builds a house: he goes (runs) to it, hammers, and the piece goes up,
        /// paid from the chest. Something of several pieces (the notice board) goes up one piece at a time, ground up;
        /// he stays on it while the chest pays for the next piece, then goes back to other work.
        /// </summary>
        private static bool UpdateMake(Villager villager, VillagerAI ai, Work work, float dt)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            Amenities.Job job = work.Making;
            if (hearth == null || !hearth.IsValid || job == null)
            {
                Finish(work);
                return false;
            }

            Vector3 position = villager.transform.position;
            bool near = Utils.DistanceXZ(position, job.Spot) < 2.6f && Mathf.Abs(position.y - job.Spot.y) < 4f;
            if (!near)
            {
                WalkResult step = Walker.For(villager).Go(villager, ai, dt, work.Stand, 0.6f, true);
                if (step == WalkResult.Walking && Time.time < work.Deadline)
                {
                    work.Timer = 0f;
                    return true;
                }

                if (Utils.DistanceXZ(villager.transform.position, job.Spot) > 4f)
                {
                    VillheimPlugin.Debug($"{villager.VillagerName} can't get to the {job.Name}; trying again later.");
                    work.MakeRetryAt = Time.time + 30f;
                    Finish(work);
                    work.Cooldown = 2f;
                    return false;
                }
            }

            ai.StopMoving();
            VillagerLooks.Hold(villager, VillagerLooks.Tool.Hammer);
            Face(villager, ai, job.Spot + Vector3.up * 0.5f);
            work.Timer += dt;
            if (work.Timer % HammerInterval < dt)
            {
                ToolAnimation(villager, VillagerLooks.Tool.Hammer);
            }

            float perPiece = (LogicConfig.SecondsPerPiece != null ? LogicConfig.SecondsPerPiece.Value : 2.5f) /
                             VillagerSkills.WorkFactor(villager, "building");
            if (work.Timer < perPiece)
            {
                return true;
            }

            work.Timer = 0f;
            bool made;
            using (Perf.Time("Amenities.Make " + job.Name))
            {
                made = Amenities.Make(hearth, job);
                VillageNeeds.Forget(villager.VillageId);
                Amenities.Forget(villager.VillageId);
            }

            if (made)
            {
                work.Progressed = true;
                if (job.Pieces <= 1)
                {
                    VillageBrain.Announce(hearth, $"{villager.VillagerName} made a {job.Name} for {hearth.VillageName}.");
                    TaskGestures.Made(villager);
                }
            }

            // The next piece of the same thing, if the chest pays for it: he stays on it. Only for things of several
            // pieces (the notice board): after a single piece (a chest, its sign) the next job is looked for on a later
            // frame, not in the same frame the piece went up (Tyler: lag when a chest went up by the notice board).
            Amenities.Job next;
            using (Perf.Time("Amenities.Due after making"))
            {
                next = made && job.Pieces > 1 ? Amenities.Due(hearth, true) : null;
            }

            if (next != null && next.Name == job.Name && Utils.DistanceXZ(next.Spot, job.Spot) < 8f)
            {
                work.Making = next;
                work.Stand = MakeStand(next, villager.transform.position);
                work.Deadline = Time.time + 60f;
                Walker.For(villager).Reset();
                return true;
            }

            if (!made)
            {
                // The chest can't pay for the piece: he leaves it for now.
                work.MakeRetryAt = Time.time + 20f;
                TaskGestures.GaveUp(villager);
            }

            Finish(work);
            work.Cooldown = 0.5f;
            return false;
        }

        /// <summary>The builder puts a new village chest where the old one stood, hammering at it for a few seconds.</summary>
        private static bool UpdateBuildChest(Villager villager, VillagerAI ai, Work work, float dt)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid || !VillageChest.IsLost(hearth))
            {
                Finish(work);
                return false;
            }

            Vector3 spot = VillageChest.Spot(hearth);
            WalkResult step = Walker.For(villager).Go(villager, ai, dt, spot, 1.5f, true);
            if (step == WalkResult.Walking)
            {
                return true;
            }

            if (step == WalkResult.Stuck && Utils.DistanceXZ(villager.transform.position, spot) > 6f)
            {
                Finish(work);
                work.Cooldown = 3f;
                return false;
            }

            ai.StopMoving();
            VillagerLooks.Hold(villager, VillagerLooks.Tool.Hammer);
            Face(villager, ai, spot + Vector3.up * 0.5f);
            work.Timer += dt;
            if (work.Timer % HammerInterval < dt)
            {
                ToolAnimation(villager, VillagerLooks.Tool.Hammer);
            }

            float perPiece = LogicConfig.SecondsPerPiece != null ? LogicConfig.SecondsPerPiece.Value : 2.5f;
            if (work.Timer < perPiece * 2f)
            {
                return true;
            }

            if (VillageChest.Rebuild(hearth))
            {
                VillageBrain.Announce(hearth, $"{villager.VillagerName} built a new chest for {hearth.VillageName}.");
            }

            VillageNeeds.Forget(villager.VillageId);
            Finish(work);
            return false;
        }

        private static void SwingAnimation(Villager villager)
        {
            ToolAnimation(villager, null);
        }

        /// <summary>
        /// Plays the held tool's own use animation: the hammer's tap when building, the axe or pickaxe swing when
        /// harvesting. With <paramref name="expected"/> set, nothing plays unless that tool is in hand, so a villager
        /// whose tool went missing never punches the piece with bare fists.
        /// </summary>
        public static void ToolAnimation(Villager villager, VillagerLooks.Tool? expected)
        {
            ItemDrop.ItemData weapon = villager.GetRightItem();
            if (weapon == null || (expected.HasValue && !VillagerLooks.IsHolding(villager, expected.Value)))
            {
                return;
            }

            string animation = weapon.m_shared?.m_attack?.m_attackAnimation;
            if (!string.IsNullOrEmpty(animation) && villager.m_zanim != null)
            {
                villager.m_zanim.SetTrigger(weapon.m_shared.m_attack.m_attackChainLevels > 1 ? animation + "0" : animation);
            }
        }

        /// <summary>Lands a swing started earlier, if the target is still there and still in reach.</summary>
        private static void LandPendingHit(Villager villager, Work work, Profile profile)
        {
            if (work.HitAt < 0f || Time.time < work.HitAt)
            {
                return;
            }

            work.HitAt = -1f;
            if (work.Target != null && CanHit(villager, work.Target, work.HitPoint))
            {
                work.FellingTree = work.Target.GetComponent<TreeBase>() != null ? Utils.GetPrefabName(work.Target) : null;
                Hit(villager, work.Target, work.HitPoint, work.HitCollider, profile.Pickaxe);
                work.Progressed = true;
            }
        }

        /// <summary>
        /// How hard a villager's blow lands against the tool's full damage. A player's blow is scaled by his skill and
        /// varies from swing to swing; villagers hit like a player with modest skill (VillagerToolStrength, 0.45 by
        /// default, give or take a quarter), so felling a tree takes about as many swings as it does a player.
        /// </summary>
        private static float Strength()
        {
            float strength = LogicConfig.VillagerToolStrength != null ? LogicConfig.VillagerToolStrength.Value : 0.45f;
            return strength * Random.Range(0.75f, 1.15f);
        }

        private static bool InMistlands(GameObject go) =>
            go != null && WorldGenerator.instance != null && WorldGenerator.instance.GetBiome(go.transform.position) == Heightmap.Biome.Mistlands;

        /// <summary>
        /// The collider a blow on a big rock lands on: the one struck if it is one of the rock's live parts, else the
        /// live part nearest the point. Any other collider made the game drop the hit ("Minerock hit has no collider or
        /// invalid hit area", 2026-11-09), and the miner gave up after one swing.
        /// </summary>
        private static Collider RockPart(GameObject target, Collider struck, Vector3 point)
        {
            MineRock5 rock = target != null ? target.GetComponentInParent<MineRock5>() ?? target.GetComponentInChildren<MineRock5>() : null;
            if (rock == null || rock.m_hitAreas == null)
            {
                return struck;
            }

            Collider best = null;
            float bestDistance = float.MaxValue;
            foreach (MineRock5.HitArea area in rock.m_hitAreas)
            {
                if (area == null || area.m_collider == null || area.m_health <= 0f)
                {
                    continue;
                }

                if (area.m_collider == struck)
                {
                    return struck;
                }

                float distance = (area.m_collider.ClosestPointOnBounds(point) - point).sqrMagnitude;
                if (distance < bestDistance)
                {
                    best = area.m_collider;
                    bestDistance = distance;
                }
            }

            return best ?? struck;
        }

        private static void Hit(Villager villager, GameObject target, Vector3 point, Collider struck, bool pickaxe)
        {
            IDestructible destructible = target.GetComponentInParent<IDestructible>() ?? target.GetComponentInChildren<IDestructible>();
            if (destructible == null)
            {
                return;
            }

            ItemDrop.ItemData weapon = villager.GetCurrentWeapon();
            Vector3 direction = point - villager.transform.position;
            direction.y = 0f;
            var hit = new HitData
            {
                m_point = point,
                m_dir = direction.sqrMagnitude > 0.01f ? direction.normalized : villager.transform.forward,
                // Mistlands rock gives way to villagers whatever their tools (T-55); the shoots see to themselves (VillageWood).
                m_toolTier = (short)(pickaxe && InMistlands(target) ? 10 : weapon?.m_shared?.m_toolTier ?? 0),
                m_attacker = villager.GetZDOID(),

                // Big rocks pick the part that breaks from the collider that was hit, and ignore hits without one.
                m_hitCollider = RockPart(target, struck, point),
            };

            if (pickaxe)
            {
                hit.m_damage.m_pickaxe = Mathf.Max(weapon?.m_shared?.m_damages.m_pickaxe ?? 0f, 20f) * Strength() * VillagerSkills.WorkFactor(villager, "mining");
            }
            else
            {
                hit.m_damage.m_chop = Mathf.Max(weapon?.m_shared?.m_damages.m_chop ?? 0f, 15f) * Strength() * VillagerSkills.WorkFactor(villager, "woodcutting");
            }

            if (hit.m_hitCollider == null && destructible is MineRock5)
            {
                // No part of the rock left standing as far as this client knows (FINDINGS 4: the game logged "Minerock
                // hit has no collider or invalid hit area on Rock_3_frac" for each such swing). The swing does nothing;
                // the swing count moves him on to another rock.
                VillheimPlugin.Debug($"{villager.VillagerName} swung at {Utils.GetPrefabName(target)} with no part of it left to hit.");
                return;
            }

            destructible.Damage(hit);
        }

        /// <summary>
        /// Where to stand to work on something. A standing tree is cut from the side facing the village, so it falls
        /// away from the houses. Logs, stumps and rocks are worked from the side the villager comes from, a step back
        /// from their surface.
        /// </summary>
        private static Vector3 StandSpot(GameObject target, Vector3 from, Vector3 hearth, out Vector3 contact)
        {
            Vector3 center = target.transform.position;
            Vector3 stand;
            if (target.GetComponent<TreeBase>() != null)
            {
                float radius = TrunkRadius(target);
                Vector3 toVillage = hearth - center;
                toVillage.y = 0f;
                if (toVillage.sqrMagnitude < 0.01f)
                {
                    toVillage = from - center;
                    toVillage.y = 0f;
                }

                stand = center + toVillage.normalized * (radius + StandOff);
                if (!Walkable(stand, center.y))
                {
                    Vector3 toMe = from - center;
                    toMe.y = 0f;
                    stand = center + toMe.normalized * (radius + StandOff);
                }

                contact = center + Vector3.up * 1f;
            }
            else
            {
                contact = ContactPoint(target, from, out _);
                Vector3 away = from - contact;
                away.y = 0f;
                if (away.sqrMagnitude < 0.01f)
                {
                    away = from - center;
                    away.y = 0f;
                }

                stand = contact + away.normalized * StandOff;
            }

            if (ZoneSystem.instance.GetGroundHeight(stand, out float y))
            {
                stand.y = y;
            }

            return stand;
        }

        private static bool Walkable(Vector3 spot, float referenceHeight)
        {
            return ZoneSystem.instance.GetGroundHeight(spot, out float y) &&
                   y > ZoneSystem.instance.m_waterLevel - 0.3f && Mathf.Abs(y - referenceHeight) < 1.5f;
        }

        /// <summary>Half the narrowest width of the tree's lowest solid collider.</summary>
        private static float TrunkRadius(GameObject tree)
        {
            float radius = 0.4f;
            float lowest = float.MaxValue;
            ColliderBuffer.Clear();
            tree.GetComponentsInChildren(false, ColliderBuffer);
            foreach (Collider collider in ColliderBuffer)
            {
                if (collider == null || collider.isTrigger || !collider.enabled)
                {
                    continue;
                }

                Bounds bounds = collider.bounds;
                if (bounds.min.y < lowest)
                {
                    lowest = bounds.min.y;
                    radius = Mathf.Min(bounds.extents.x, bounds.extents.z);
                }
            }

            return Mathf.Clamp(radius, 0.2f, 1.2f);
        }

        /// <summary>
        /// The last check before a swing. A standing tree is hit at the trunk, so the villager has to stand next to the
        /// trunk itself (the canopy would make anything look close). Everything else at the nearest surface.
        /// </summary>
        private static bool CanHit(Villager villager, GameObject target, Vector3 contact)
        {
            if (target.GetComponent<TreeBase>() != null)
            {
                return Utils.DistanceXZ(villager.transform.position, target.transform.position) <= TrunkRadius(target) + 2f;
            }

            return InReach(villager, contact, true);
        }

        private static bool InReach(Villager villager, Vector3 contact, bool atSpot)
        {
            Vector3 chest = villager.transform.position + Vector3.up * 1f;
            return Vector3.Distance(chest, contact) <= (atSpot ? WorkReachAtSpot : WorkReach);
        }

        private static void ReleaseTarget(Work work)
        {
            work.HitAt = -1f;
            work.FellingTree = null;
            if (work.Target != null)
            {
                Claimed.Remove(work.Target);
            }

            work.Target = null;
        }

        private static void Finish(Work work)
        {
            if (work.Phase != Phase.Idle && work.Phase != Phase.Build && work.Phase != Phase.BuildChest && work.Phase != Phase.Make)
            {
                work.QuickFails = !work.Progressed && Time.time - work.StartedAt < 8f ? work.QuickFails + 1 : 0;
                if (work.QuickFails >= 2)
                {
                    // Two jobs in a row that came to nothing: a real break, not an instant retry (no twitchy loops).
                    work.QuickFails = 0;
                    work.Cooldown = Random.Range(25f, 40f);
                    work.Reason = "taking a short break";
                }
            }

            ReleaseTarget(work);
            work.Phase = Phase.Idle;
            work.HelperSlot = -1;
            work.Making = null;
            work.Tidying = false;
            work.Skip.Clear();
            Claimed.RemoveWhere(go => go == null);
            PruneUnreachable();
        }

        private static void Stop(Villager villager)
        {
            if (!States.TryGetValue(villager, out Work work) || work.Phase == Phase.Idle)
            {
                return;
            }

            // Whatever he carries still reaches the village.
            foreach (KeyValuePair<string, int> carried in work.Carrying)
            {
                VillageBrain.AddMaterial(villager.VillageId, carried.Key, carried.Value);
            }

            work.Carrying.Clear();
            Finish(work);
        }

        private static bool IsStump(GameObject go)
        {
            return go.GetComponent<Destructible>() != null && go.name.IndexOf("stub", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static bool IsRock(GameObject go)
        {
            if (go.GetComponent<MineRock5>() == null && go.GetComponent<MineRock>() == null && go.GetComponent<Destructible>() == null)
            {
                return false;
            }

            string name = go.name.ToLowerInvariant();
            bool mistlandsCliff = name.Contains("cliff_mistlands") || (name.Contains("mistland") && go.GetComponent<MineRock5>() != null);
            if ((!name.Contains("rock") && !mistlandsCliff) || go.GetComponent<Piece>() != null)
            {
                return false;
            }

            foreach (string ore in OreWords)
            {
                if (name.Contains(ore))
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>A big rock someone has already started on (a MineRock5 with damaged parts).</summary>
        private static bool IsCrackedRock(GameObject go)
        {
            if (!IsRock(go) || !go.TryGetComponent(out MineRock5 rock) || rock.m_hitAreas == null)
            {
                return false;
            }

            // A whole rock turns into its broken-up copy (Rock_3 into Rock_3_frac) on the first blow, with every part still
            // whole. That copy is started work: without this the miner took one swing and went to the next rock (2026-11-09).
            if (go.name.Contains("_frac"))
            {
                return true;
            }

            foreach (MineRock5.HitArea area in rock.m_hitAreas)
            {
                if (area != null && area.m_health < rock.m_health)
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>
        /// The point on the target's solid colliders closest to the villager, and the collider it is on. Logs are
        /// long, so their center is useless. Unity cannot find the closest point on a concave mesh collider (rocks
        /// use them): it hands back the point it was given, which made everything look in reach, and the bounding box
        /// can sit metres from the real face of a big rock. For those a ray is cast at the collider itself, which
        /// lands on its real surface; a collider no ray reaches does not count.
        /// </summary>
        private static Vector3 ContactPoint(GameObject target, Vector3 from, out Collider struck)
        {
            Vector3 best = target.transform.position;
            float bestDistance = float.MaxValue;
            struck = null;
            ColliderBuffer.Clear();
            target.GetComponentsInChildren(false, ColliderBuffer);
            Vector3 chest = from + Vector3.up;
            foreach (Collider collider in ColliderBuffer)
            {
                if (collider == null || collider.isTrigger || !collider.enabled)
                {
                    continue;
                }

                bool concave = collider is MeshCollider mesh && !mesh.convex;
                Vector3 point;
                if (!concave)
                {
                    point = collider.ClosestPoint(chest);
                }
                else if (!SurfaceByRay(collider, chest, out point))
                {
                    continue;
                }

                float distance = (point - chest).sqrMagnitude;
                if (distance < bestDistance)
                {
                    best = point;
                    bestDistance = distance;
                    struck = collider;
                }
            }

            return best;
        }

        /// <summary>
        /// A point on a concave collider's real surface, seen from <paramref name="from"/>: a ray toward the nearest
        /// corner of its box, then toward its middle.
        /// </summary>
        private static bool SurfaceByRay(Collider collider, Vector3 from, out Vector3 point)
        {
            Bounds bounds = collider.bounds;
            foreach (Vector3 aim in new[] { bounds.ClosestPoint(from), bounds.center })
            {
                Vector3 direction = aim - from;
                float length = direction.magnitude;
                if (length < 0.01f)
                {
                    continue;
                }

                if (collider.Raycast(new Ray(from, direction / length), out RaycastHit hit, length + bounds.extents.magnitude))
                {
                    point = hit.point;
                    return true;
                }
            }

            point = from + Vector3.up * 1000f;
            return false;
        }

        /// <summary>
        /// Aims the villager's look at a point. The game turns the body toward the look direction by itself, standing
        /// or moving; turning the body here as well made two things steer it at once, which showed as a wobble.
        /// Swings wait until he faces it.
        /// </summary>
        private static void Face(Villager villager, VillagerAI ai, Vector3 point)
        {
            ai.LookAt(point);
            Vector3 direction = point - villager.transform.position;
            direction.y = 0f;
            if (direction.sqrMagnitude < 0.01f)
            {
                return;
            }

            villager.SetLookDir(direction.normalized);
        }

        private static void MarkUnreachable(GameObject target)
        {
            if (target != null)
            {
                Unreachable[target] = Time.time + 300f;
            }
        }

        private static void PruneUnreachable()
        {
            if (Unreachable.Count < 50)
            {
                return;
            }

            var stale = new List<GameObject>();
            foreach (KeyValuePair<GameObject, float> entry in Unreachable)
            {
                if (entry.Key == null || entry.Value < Time.time)
                {
                    stale.Add(entry.Key);
                }
            }

            foreach (GameObject key in stale)
            {
                Unreachable.Remove(key);
            }
        }

        private static bool Available(GameObject go, HashSet<GameObject> skip)
        {
            return !Claimed.Contains(go) && (skip == null || !skip.Contains(go)) &&
                   !(Unreachable.TryGetValue(go, out float until) && until > Time.time) && !UnderWater(go);
        }

        private static readonly Dictionary<GameObject, bool> Wet = new Dictionary<GameObject, bool>();

        /// <summary>
        /// The ground under it is more than half a metre under the sea: nobody swims out for it (2026-11-09: a miner swam
        /// out to a rock in the water). Kept per object; the list is dropped when it grows large.
        /// </summary>
        private static bool UnderWater(GameObject go)
        {
            if (Wet.TryGetValue(go, out bool wet))
            {
                return wet;
            }

            if (Wet.Count > 4000)
            {
                Wet.Clear();
            }

            Vector3 p = go.transform.position;
            float water = ZoneSystem.instance != null ? ZoneSystem.instance.m_waterLevel : 30f;
            wet = ZoneSystem.instance != null && ZoneSystem.instance.GetGroundHeight(p, out float ground) && ground < water - 0.5f;
            Wet[go] = wet;
            return wet;
        }

        private static readonly Dictionary<(int, int, int), (float Time, List<GameObject> Objects)> Scans =
            new Dictionary<(int, int, int), (float, List<GameObject>)>();

        /// <summary>
        /// Networked objects (trees, rocks, drops, pickables...) within the radius. Searches around the hearth are
        /// shared by all its villagers and kept for three seconds, so a village does one big search, not one per
        /// villager per look.
        /// </summary>
        private static List<GameObject> Objects(Vector3 center, float radius)
        {
            var key = (Mathf.RoundToInt(center.x), Mathf.RoundToInt(center.z), Mathf.RoundToInt(radius));
            bool shared = radius >= MaxFromHearth - 0.01f;
            if (shared && Scans.TryGetValue(key, out var cached) && Time.time - cached.Time < 3f)
            {
                return cached.Objects;
            }

            var seen = new HashSet<GameObject>();
            var list = new List<GameObject>();
            foreach (Collider collider in Physics.OverlapSphere(center, radius, ~0, QueryTriggerInteraction.Collide))
            {
                ZNetView view = collider.GetComponentInParent<ZNetView>();
                if (view != null && seen.Add(view.gameObject))
                {
                    list.Add(view.gameObject);
                }
            }

            if (shared)
            {
                if (Scans.Count > 32)
                {
                    Scans.Clear();
                }

                Scans[key] = (Time.time, list);
            }

            return list;
        }

        /// <summary>The available object within <paramref name="radius"/> of <paramref name="center"/> nearest to <paramref name="from"/>.</summary>
        private static GameObject FindNearest(Vector3 center, float radius, Vector3 from, Func<GameObject, bool> match,
            HashSet<GameObject> skip)
        {
            GameObject best = null;
            float bestDistance = float.MaxValue;
            foreach (GameObject go in Objects(center, radius))
            {
                if (go == null || Utils.DistanceXZ(go.transform.position, center) > radius || !Available(go, skip) || !match(go))
                {
                    continue;
                }

                float distance = Utils.DistanceXZ(go.transform.position, from);
                if (distance < bestDistance)
                {
                    best = go;
                    bestDistance = distance;
                }
            }

            return best;
        }

        private static Pickable NearestPickable(HashSet<string> wanted, Vector3 from, float radius)
        {
            GameObject go = FindNearest(from, radius, from, candidate =>
                candidate.TryGetComponent(out Pickable pickable) && !pickable.GetPicked() && pickable.m_itemPrefab != null &&
                wanted.Contains(pickable.m_itemPrefab.name), null);
            return go != null ? go.GetComponent<Pickable>() : null;
        }

        private static ItemDrop NearestUseful(Vector3 center, float radius, HashSet<GameObject> skip)
        {
            GameObject go = FindNearest(center, radius, center, candidate =>
                candidate.TryGetComponent(out ItemDrop item) && Useful(item) && Player.GetClosestPlayer(candidate.transform.position, 4f) == null,
                skip);
            return go != null ? go.GetComponent<ItemDrop>() : null;
        }

        private static ItemDrop NearestDrop(ICollection<string> wanted, Vector3 center, float radius, Vector3 from,
            HashSet<GameObject> skip)
        {
            ItemDrop best = null;
            float bestDistance = float.MaxValue;
            foreach (GameObject go in Objects(center, radius))
            {
                ItemDrop item = go != null ? go.GetComponent<ItemDrop>() : null;
                if (item == null || !wanted.Contains(Utils.GetPrefabName(item.gameObject)) || skip.Contains(item.gameObject) ||
                    Utils.DistanceXZ(item.transform.position, center) > radius)
                {
                    continue;
                }

                float distance = Utils.DistanceXZ(item.transform.position, from);
                if (distance < bestDistance)
                {
                    best = item;
                    bestDistance = distance;
                }
            }

            return best;
        }
    }
}
