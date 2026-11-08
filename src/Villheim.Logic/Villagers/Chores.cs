using System;
using System.Collections.Generic;
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
            public bool CanHarvest;
            public readonly HashSet<string> Wanted = new HashSet<string>();
            public GameObject Target;
            public Vector3 TargetSeenAt;
            public Vector3 Stand;
            public Vector3 Contact;
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
            else if (builder && needs.SiteActive && needs.CanBuildNow && work.Phase != Phase.Build && Time.time >= work.BuildRetryAt)
            {
                // The chest has what the next piece needs: the builder drops what he is doing (keeping what he
                // carries for the chest) and builds.
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
                    return "building";
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

            Villager best = null;
            bool bestIsBuilder = false;
            int bestSeed = int.MaxValue;
            foreach (Character character in Character.GetAllCharacters())
            {
                if (!(character is Villager other) || other.IsDead() || other.VillageId != id || other.Zdo == null ||
                    Childhood.IsChild(other))
                {
                    continue;
                }

                int seed = other.Zdo.GetInt(Keys.VillagerSeed);
                Roles.Trade trade = Roles.TradeOf(other);
                bool isBuilder = trade != Roles.Trade.None ? trade == Roles.Trade.Carpenter : VillagerLooks.IsBuilder(seed);
                if (best == null || (isBuilder && !bestIsBuilder) || (isBuilder == bestIsBuilder && seed < bestSeed))
                {
                    best = other;
                    bestIsBuilder = isBuilder;
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

            if (needs.Missing.Count == 0)
            {
                if (!TryClear(villager, work, needs, false) && !TryTidy(villager, work))
                {
                    NoWork(villager, work, "the village needs nothing right now");
                }

                return;
            }

            // Trades (from six villagers on): a cook keeps the hearth and only gathers when hands are short.
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

            // A woodcutter or carpenter goes for wood first, a miner for stone. Without trades, everyone goes where
            // the need is greatest.
            Profile first;
            if (trade == Roles.Trade.Miner)
            {
                first = Miner;
            }
            else if (trade != Roles.Trade.None)
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
            }

            Profile second = first == Miner ? Woodcutter : Miner;
            string firstReason = TryProfile(villager, work, needs, first);
            if (firstReason == null)
            {
                return;
            }

            string secondReason = TryProfile(villager, work, needs, second);
            if (secondReason == null)
            {
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

            // Everyone carries an axe and a pickaxe, so anyone can fell or mine; they take the right one in hand.
            work.CanHarvest = VillagerLooks.Hold(villager, profile.Tool);
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
            Started(villager, work, (profile.IsPartial(target) ? profile.PartialActivity : profile.Activity) +
                                    $" ({Utils.GetPrefabName(target)}, {Utils.DistanceXZ(position, target.transform.position):0} m away)");
            return null;
        }

        private static void Started(Villager villager, Work work, string what)
        {
            work.Reason = "";
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
            if (Village.VillageWood.IsVillageWood(go)) return true; // the village's own Yggdrasil shoots (D-052)
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
            if (Vector3.Distance(piece, work.Contact) > 0.3f)
            {
                // A new piece: work out where to stand for it.
                work.Contact = piece;
                work.Stand = ConstructionSite.StandSpot(hearth, piece, position);
                work.Picks = 0;
                work.Deadline = Time.time + 30f;
                Walker.For(villager).Reset();
            }

            bool stubborn = work.Misses >= 2 && Vector3.Distance(work.MissedPiece, piece) < 0.3f;
            bool inReach = ConstructionSite.InBuildReach(hearth, position, piece) ||
                           (stubborn && Utils.DistanceXZ(position, piece) < 5f && Mathf.Abs(piece.y - position.y) < 10f);
            if (inReach && ConstructionSite.InsideNextPiece(hearth, villager))
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
                    // Can't get next to it: gather for a while before trying again, instead of walking back at once.
                    work.Misses = Vector3.Distance(work.MissedPiece, piece) < 0.3f ? work.Misses + 1 : 1;
                    work.MissedPiece = piece;
                    work.BuildRetryAt = Time.time + 25f;
                    VillheimPlugin.Debug($"{villager.VillagerName} can't get next to the next piece (miss {work.Misses}); trying again later.");
                    Finish(work);
                    work.Cooldown = 2f;
                    return false;
                }
            }

            ai.StopMoving();
            VillagerLooks.Hold(villager, VillagerLooks.Tool.Hammer);
            Face(villager, ai, piece);
            work.Timer += dt;
            if (work.Timer % HammerInterval < dt)
            {
                ToolAnimation(villager, VillagerLooks.Tool.Hammer);
            }

            // Mood never changes how fast anyone works (D-014); only skill does. Mood changes free time.
            float perPiece = (LogicConfig.SecondsPerPiece != null ? LogicConfig.SecondsPerPiece.Value : 2.5f) /
                             VillagerSkills.WorkFactor(villager, "building");
            if (work.Timer < perPiece)
            {
                return true;
            }

            if (ConstructionSite.NextPieceBlocked(hearth, villager, out string who))
            {
                // Someone stands where the piece goes: keep hammering and try again in a moment.
                if (work.Reason != "blocked:" + who)
                {
                    work.Reason = "blocked:" + who;
                    VillheimPlugin.Debug($"{villager.VillagerName} waits for {who} to move out of the way.");
                }

                work.Timer = perPiece - 1f;
                return true;
            }

            work.Reason = "";
            work.Timer = 0f;
            if (ConstructionSite.PlaceNext(hearth, true))
            {
                ConstructionSite.NoteBuilder(villager.VillageId);
                VillageNeeds.Forget(villager.VillageId);
                work.Progressed = true;
                work.Misses = 0;
                return true;
            }

            // Out of materials (or done). Back to gathering until the chest fills up again.
            VillageNeeds.Forget(villager.VillageId);
            Finish(work);
            work.Cooldown = 1f;
            return false;
        }

        /// <summary>The village's builder is about and makes the amenities (FreeTime leaves them to him).</summary>
        public static bool BuilderMakes(int villageId) =>
            Builders.TryGetValue(villageId, out var cached) && Time.time - cached.Time < 10f && cached.Builder != ZDOID.None;

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
            bool made = Amenities.Make(hearth, job);
            VillageNeeds.Forget(villager.VillageId);
            Amenities.Forget(villager.VillageId);
            if (made)
            {
                work.Progressed = true;
                if (job.Pieces <= 1)
                {
                    VillageBrain.Announce(hearth, $"{villager.VillagerName} made a {job.Name} for {hearth.VillageName}.");
                }
            }

            // The next piece of the same thing, if the chest pays for it: he stays on it.
            Amenities.Job next = made ? Amenities.Due(hearth, true) : null;
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
                work.MakeRetryAt = Time.time + 20f;
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
                m_toolTier = (short)(weapon?.m_shared?.m_toolTier ?? 0),
                m_attacker = villager.GetZDOID(),

                // Big rocks pick the part that breaks from the collider that was hit, and ignore hits without one.
                m_hitCollider = struck,
            };

            if (pickaxe)
            {
                hit.m_damage.m_pickaxe = Mathf.Max(weapon?.m_shared?.m_damages.m_pickaxe ?? 0f, 20f) * Strength() * VillagerSkills.WorkFactor(villager, "mining");
            }
            else
            {
                hit.m_damage.m_chop = Mathf.Max(weapon?.m_shared?.m_damages.m_chop ?? 0f, 15f) * Strength() * VillagerSkills.WorkFactor(villager, "woodcutting");
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
            if (!name.Contains("rock") || go.GetComponent<Piece>() != null)
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
                   !(Unreachable.TryGetValue(go, out float until) && until > Time.time);
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
