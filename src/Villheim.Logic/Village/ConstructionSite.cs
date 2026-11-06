using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// A building going up piece by piece. The site is stored on the hearth (design, spot, seed and how many
    /// pieces are done), and the full piece list is rebuilt from the design whenever it is needed, so a site
    /// survives logouts and logic reloads.
    ///
    /// Pieces go up in stages, ground first: walls, roof, doors and windows, then furnishing. Each piece costs its
    /// materials when it is placed, taken from the village chest, so a village starts building as soon as it can and
    /// pauses when the chest runs dry. Builders place pieces as they hammer; without a builder nearby the site
    /// still creeps along slowly.
    /// </summary>
    internal static class ConstructionSite
    {
        private static readonly int KeySite = "villheim_site".GetStableHashCode();
        private static readonly int KeySiteIndex = "villheim_site_index".GetStableHashCode();
        private static readonly int KeySiteOwed = "villheim_site_owed".GetStableHashCode();
        private static readonly int KeySiteOrder = "villheim_site_order".GetStableHashCode();

        // 2: shell in support order (BuildOrder). Sites begun earlier have no value and keep the old order.
        private const int SupportOrderVersion = 2;

        private const float BuilderRecentSeconds = 12f;

        internal sealed class Site
        {
            public string Design;
            public Vector3 Position;
            public float Yaw;
            public float Radius;
            public Role Role;
            public int Seed;

            /// <summary>Rebuilds the building that stands here: the old one is taken down first.</summary>
            public bool Upgrade;
        }

        private static readonly int KeySiteTeardown = "villheim_site_teardown".GetStableHashCode();

        private sealed class CachedPlan
        {
            public string Key;
            public List<DesignSpawner.PlanEntry> Entries;
            public Dictionary<string, float> Factors;
            public float Footprint;

            /// <summary>Height of the ground floor's underside above the site's origin (the bottom of the lowest walls and floors).</summary>
            public float Floor;
            public int RemainingIndex = -1;
            public Dictionary<string, float> Remaining;
        }

        private static readonly Dictionary<int, CachedPlan> Plans = new Dictionary<int, CachedPlan>();
        private static readonly Dictionary<int, float> LastBuilderSwing = new Dictionary<int, float>();

        public static Site Get(ZDO zdo)
        {
            string raw = zdo.GetString(KeySite, "");
            if (string.IsNullOrEmpty(raw))
            {
                return null;
            }

            string[] parts = raw.Split('|');
            if (parts.Length < 8)
            {
                return null;
            }

            return new Site
            {
                Design = parts[0],
                Position = new Vector3(P(parts[1]), P(parts[2]), P(parts[3])),
                Yaw = P(parts[4]),
                Radius = P(parts[5]),
                Role = System.Enum.TryParse(parts[6], out Role role) ? role : Role.House,
                Seed = int.TryParse(parts[7], out int seed) ? seed : 1,
                Upgrade = parts.Length > 8 && parts[8] == "u",
            };
        }

        public static bool IsActive(ZDO zdo) => !string.IsNullOrEmpty(zdo.GetString(KeySite, ""));

        public static void Begin(ZDO zdo, Site site)
        {
            string raw = string.Join("|", site.Design, F(site.Position.x), F(site.Position.y), F(site.Position.z),
                F(site.Yaw), F(site.Radius), site.Role.ToString(), site.Seed.ToString(CultureInfo.InvariantCulture),
                site.Upgrade ? "u" : "");
            zdo.Set(KeySite, raw);
            zdo.Set(KeySiteTeardown, site.Upgrade ? 1 : 0);
            zdo.Set(KeySiteIndex, 0);
            zdo.Set(KeySiteOwed, "");
            zdo.Set(KeySiteOrder, SupportOrderVersion);
        }

        private static void End(ZDO zdo)
        {
            zdo.Set(KeySite, "");
            zdo.Set(KeySiteIndex, 0);
            zdo.Set(KeySiteOwed, "");
        }

        /// <summary>"walls 12/40" style progress for summaries, or null when nothing is being built.</summary>
        public static string Progress(VillageHearth hearth)
        {
            Site site = Get(hearth.Zdo);
            CachedPlan plan = site != null ? GetPlan(hearth, site) : null;
            if (plan == null || plan.Entries.Count == 0)
            {
                return null;
            }

            int index = Mathf.Clamp(hearth.Zdo.GetInt(KeySiteIndex), 0, plan.Entries.Count - 1);
            string stage = DesignSpawner.StageNames[plan.Entries[index].Stage];
            int percent = Mathf.RoundToInt(100f * hearth.Zdo.GetInt(KeySiteIndex) / plan.Entries.Count);
            if (TearingDown(hearth))
            {
                return $"taking down the old {VillageBrain.RoleName(site.Role)} to build a bigger one";
            }

            return $"building a {(site.Upgrade ? "bigger " : "")}{VillageBrain.RoleName(site.Role)}: {stage}, {percent}% done";
        }

        /// <summary>Where builders should stand: the next piece to place.</summary>
        public static bool NextPiecePosition(VillageHearth hearth, out Vector3 position)
        {
            position = Vector3.zero;
            if (TearingDown(hearth))
            {
                Piece old = OldPiece(hearth);
                position = old != null ? old.transform.position : Get(hearth.Zdo)?.Position ?? hearth.transform.position;
                return true;
            }

            Site site = Get(hearth.Zdo);
            CachedPlan plan = site != null ? GetPlan(hearth, site) : null;
            if (plan == null)
            {
                return false;
            }

            int index = hearth.Zdo.GetInt(KeySiteIndex);
            if (index >= plan.Entries.Count)
            {
                position = site.Position;
                return true;
            }

            position = site.Position + Quaternion.Euler(0f, site.Yaw, 0f) * plan.Entries[index].LocalPosition;
            return true;
        }

        /// <summary>
        /// Someone (a player or a villager) stands where the next piece goes. The builder waits rather than put a
        /// wall through them.
        /// </summary>
        public static bool NextPieceBlocked(VillageHearth hearth, Character builder, out string who)
        {
            who = null;
            if (TearingDown(hearth))
            {
                return false;
            }

            Site site = Get(hearth.Zdo);
            CachedPlan plan = site != null ? GetPlan(hearth, site) : null;
            int index = hearth.Zdo.GetInt(KeySiteIndex);
            if (plan == null || index >= plan.Entries.Count || !plan.Entries[index].Bounds.HasValue)
            {
                return false;
            }

            // Test each character against the piece's own box, in the design's coordinates.
            Bounds local = plan.Entries[index].Bounds.Value;
            local.Expand(0.4f);
            Quaternion toDesign = Quaternion.Inverse(Quaternion.Euler(0f, site.Yaw, 0f));
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character == null || character == builder || character.IsDead())
                {
                    continue;
                }

                Vector3 feet = toDesign * (character.transform.position - site.Position);
                if (local.Contains(feet) || local.Contains(feet + Vector3.up * 1f))
                {
                    who = character.GetHoverName();
                    return true;
                }
            }

            return false;
        }

        public static void NoteBuilder(int villageId)
        {
            LastBuilderSwing[villageId] = Time.time;
        }

        public static bool BuilderActive(int villageId)
        {
            return LastBuilderSwing.TryGetValue(villageId, out float time) && Time.time - time < BuilderRecentSeconds;
        }

        /// <summary>
        /// Places the next piece if there is wood for it. Returns false when the site is waiting for wood or done.
        /// Completes the site after the last piece.
        /// </summary>
        public static bool PlaceNext(VillageHearth hearth, bool effects)
        {
            if (hearth == null || !hearth.IsValid)
            {
                return false;
            }

            ZDO zdo = hearth.Zdo;
            Site site = Get(zdo);
            CachedPlan plan = site != null ? GetPlan(hearth, site) : null;
            if (plan == null)
            {
                if (site != null)
                {
                    VillheimPlugin.Log.LogWarning($"Construction of {site.Design} could not be planned and was dropped.");
                    End(zdo);
                }

                return false;
            }

            var state = new VillageState(zdo);
            if (TearingDown(hearth))
            {
                return TakeDownNext(hearth, state, site);
            }

            int index = zdo.GetInt(KeySiteIndex);
            if (index >= plan.Entries.Count)
            {
                Complete(hearth, state, site);
                return false;
            }

            DesignSpawner.PlanEntry entry = plan.Entries[index];
            if (!Pay(hearth, state, plan, entry))
            {
                return false;
            }

            if (!hearth.NView.IsOwner())
            {
                hearth.NView.ClaimOwnership();
            }

            Quaternion rotation = Quaternion.Euler(0f, site.Yaw, 0f);
            GroundUnder(site, entry, rotation, plan.Footprint);
            DesignSpawner.SpawnEntry(entry, site.Position, rotation, state.Id, effects);
            zdo.Set(KeySiteIndex, index + 1);
            state.Waiting = "";

            if (index + 1 >= plan.Entries.Count)
            {
                Complete(hearth, state, site);
            }

            return true;
        }

        private static void Complete(VillageHearth hearth, VillageState state, Site site)
        {
            End(hearth.Zdo);
            Plans.Remove(state.Id);
            SnapToGround.SnappAll();

            var plot = new Plot
            {
                Design = site.Design, Position = site.Position, Yaw = site.Yaw, Radius = site.Radius, Role = site.Role.ToString(),
            };

            if (site.Upgrade)
            {
                state.ReplacePlot(site.Position, plot);
                Villagers.Beds.Forget(state.Id);
            }
            else
            {
                state.AddPlot(plot);
            }

            if (VillheimConfig.BuildPaths.Value && !site.Upgrade)
            {
                // A villager walks the route and lays it (see PathLaying).
                Villagers.PathLaying.Queue(hearth, site.Position, site.Radius, site.Yaw, Designs.Doors.Angle(site.Design));
            }

            VillheimPlugin.Log.LogInfo($"{state.Name} finished a {VillageBrain.RoleName(site.Role)} ({site.Design}).");
            Villagers.Dialogue.Note(state.Id, "finished");
            Chronicle.Add(hearth, site.Upgrade ? $"The {VillageBrain.RoleName(site.Role)} was rebuilt bigger." :
                $"A new {VillageBrain.RoleName(site.Role)} was finished.");

            // A few villagers who aren't busy come to have a look at it.
            Vector3 front = site.Position + Quaternion.Euler(0f, site.Yaw, 0f) * Vector3.forward * (Footprint(hearth) + 2f);
            Villagers.Social.Gather(state.Id, null, front, 3, "event:viewbuilding", "cheer", 40f);
            VillageBrain.Announce(hearth, $"{state.Name} has finished a new {VillageBrain.RoleName(site.Role)}.");
        }

        private static CachedPlan GetPlan(VillageHearth hearth, Site site)
        {
            int id = hearth.VillageId;
            bool supportOrder = hearth.Zdo.GetInt(KeySiteOrder) >= SupportOrderVersion;
            string key = $"{site.Design}|{site.Seed}|{site.Position}|{supportOrder}";
            if (Plans.TryGetValue(id, out CachedPlan cached) && cached.Key == key)
            {
                return cached;
            }

            Blueprints.Blueprint blueprint = Blueprints.Find(site.Design);
            if (blueprint != null)
            {
                return Cache(id, key, AroundHearth(hearth, site, Blueprints.MakePlan(blueprint, site.Position, site.Yaw)),
                    Blueprints.RawTotals(blueprint));
            }

            ZoneSystem.ZoneLocation location = DesignLibrary.Find(site.Design);
            if (location == null)
            {
                return null;
            }

            location.m_prefab.Load();
            try
            {
                GameObject asset = location.m_prefab.Asset;
                if (asset == null)
                {
                    return null;
                }

                List<DesignSpawner.PlanEntry> entries = DesignSpawner.MakePlan(asset, site.Position, site.Seed, site.Yaw, supportOrder);
                return Cache(id, key, AroundHearth(hearth, site, entries), DesignLibrary.RawTotals(location));
            }
            finally
            {
                location.m_prefab.Release();
            }
        }

        /// <summary>
        /// Leaves out pieces that would land on the village hearth or its chest: the design's own fire pit when the
        /// longhouse is built around the hearth, and anything else in the way there.
        /// </summary>
        private static List<DesignSpawner.PlanEntry> AroundHearth(VillageHearth hearth, Site site, List<DesignSpawner.PlanEntry> entries)
        {
            Vector3 fire = hearth.transform.position;
            Vector3 chest = VillageChest.Spot(hearth);
            Quaternion turn = Quaternion.Euler(0f, site.Yaw, 0f);
            if (Utils.DistanceXZ(fire, site.Position) > site.Radius + 2f)
            {
                return entries;
            }

            return entries.Where(e =>
            {
                Vector3 world = site.Position + turn * e.LocalPosition;
                if (Mathf.Abs(world.y - fire.y) > 1.5f)
                {
                    return true;
                }

                GameObject prefab = ZNetScene.instance.GetPrefab(e.Prefab);
                bool isFire = prefab != null && prefab.GetComponent<Fireplace>() != null;
                return Utils.DistanceXZ(world, fire) > (isFire ? 2.5f : 1.3f) && Utils.DistanceXZ(world, chest) > 1.1f;
            }).ToList();
        }

        private static CachedPlan Cache(int id, string key, List<DesignSpawner.PlanEntry> entries, Dictionary<string, int> rawTotals)
        {
            var factors = new Dictionary<string, float>();
            foreach (KeyValuePair<string, int> total in rawTotals)
            {
                factors[total.Key] = DesignLibrary.CostFactor(total.Value);
            }

            float footprint = 2f;
            foreach (DesignSpawner.PlanEntry entry in entries)
            {
                if (entry.Structural)
                {
                    footprint = Mathf.Max(footprint, new Vector2(entry.LocalPosition.x, entry.LocalPosition.z).magnitude);
                }
            }

            float floor = FloorOf(entries);
            var plan = new CachedPlan { Key = key, Entries = entries, Factors = factors, Footprint = footprint + 0.5f, Floor = floor };
            Plans[id] = plan;
            return plan;
        }

        /// <summary>
        /// Takes the materials for one piece from the village chest, or from the village stock while the chest is not
        /// loaded. Amounts are scaled (see DesignLibrary.CostFactor) and the fractions carried over between pieces, so
        /// the whole building costs what its summary says. Returns false, with nothing taken, when materials are short.
        /// </summary>
        private static bool Pay(VillageHearth hearth, VillageState state, CachedPlan plan, DesignSpawner.PlanEntry entry)
        {
            if (entry.Cost.Count == 0 || !VillheimConfig.RequireWood.Value)
            {
                return true;
            }

            ZDO zdo = hearth.Zdo;
            Dictionary<string, float> owed = ReadOwed(zdo);
            if (VillageChest.IsLost(hearth))
            {
                state.Waiting = "a new village chest";
                return false;
            }

            Dictionary<string, int> take = Due(plan, entry, owed);
            Container chest = VillageChest.Find(hearth);
            foreach (KeyValuePair<string, int> amount in take)
            {
                int have = chest != null ? VillageChest.Count(chest, amount.Key) : state.Get(amount.Key);
                if (amount.Value > have)
                {
                    state.Waiting = chest != null
                        ? $"{Materials.Label(amount.Key)} in the village chest"
                        : $"{Materials.Label(amount.Key)} to keep building ({have} in stock)";
                    return false;
                }
            }

            if (chest != null)
            {
                if (!VillageChest.Take(chest, take))
                {
                    state.Waiting = "someone to close the village chest";
                    return false;
                }
            }
            else
            {
                foreach (KeyValuePair<string, int> amount in take)
                {
                    if (amount.Value > 0)
                    {
                        state.Add(amount.Key, -amount.Value);
                    }
                }
            }

            WriteOwed(zdo, owed);
            return true;
        }

        /// <summary>Whole amounts due for one piece. Updates the carried fractions in <paramref name="owed"/>.</summary>
        private static Dictionary<string, int> Due(CachedPlan plan, DesignSpawner.PlanEntry entry, Dictionary<string, float> owed)
        {
            var take = new Dictionary<string, int>();
            foreach (KeyValuePair<string, int> cost in entry.Cost)
            {
                plan.Factors.TryGetValue(cost.Key, out float factor);
                owed.TryGetValue(cost.Key, out float carried);
                float due = carried + cost.Value * factor;
                int whole = Mathf.FloorToInt(due);
                take[cost.Key] = whole;
                owed[cost.Key] = due - whole;
            }

            return take;
        }

        /// <summary>
        /// The shell pieces (walls, floors, roof, doors) of a finished building, as the design lays them out, with the
        /// cost factor of each material. Used to find and put back pieces that were destroyed.
        /// </summary>
        public static List<DesignSpawner.PlanEntry> ShellOf(Plot plot, out Dictionary<string, float> factors)
        {
            factors = new Dictionary<string, float>();
            List<DesignSpawner.PlanEntry> entries = null;
            Dictionary<string, int> totals = null;
            Blueprints.Blueprint blueprint = Blueprints.Find(plot.Design);
            if (blueprint != null)
            {
                entries = Blueprints.MakePlan(blueprint, plot.Position, plot.Yaw);
                totals = Blueprints.RawTotals(blueprint);
            }
            else
            {
                ZoneSystem.ZoneLocation location = DesignLibrary.Find(plot.Design);
                if (location == null)
                {
                    return new List<DesignSpawner.PlanEntry>();
                }

                location.m_prefab.Load();
                try
                {
                    GameObject asset = location.m_prefab.Asset;
                    entries = asset != null ? DesignSpawner.MakePlan(asset, plot.Position, 1, plot.Yaw, true) : new List<DesignSpawner.PlanEntry>();
                }
                finally
                {
                    location.m_prefab.Release();
                }

                totals = DesignLibrary.RawTotals(location);
            }

            foreach (KeyValuePair<string, int> total in totals)
            {
                factors[total.Key] = DesignLibrary.CostFactor(total.Value);
            }

            return entries.Where(e => e.Shell).ToList();
        }

        public static bool TearingDown(VillageHearth hearth) => IsActive(hearth.Zdo) && hearth.Zdo.GetInt(KeySiteTeardown) == 1;

        /// <summary>The next piece of the old building to take down: the highest first, so roofs come off before walls.</summary>
        private static Piece OldPiece(VillageHearth hearth)
        {
            Site site = Get(hearth.Zdo);
            if (site == null)
            {
                return null;
            }

            var state = new VillageState(hearth.Zdo);
            Plot old = state.Plots.FirstOrDefault(p => Utils.DistanceXZ(p.Position, site.Position) < 0.5f);
            float radius = (old != null ? old.Radius : site.Radius) * 0.75f;
            Container chest = VillageChest.Find(hearth);
            var pieces = new List<Piece>();
            Piece.GetAllPiecesInRadius(site.Position, radius, pieces);
            Piece best = null;
            foreach (Piece piece in pieces)
            {
                if (piece == null || piece.m_nview == null || !piece.m_nview.IsValid() ||
                    piece.m_nview.GetZDO().GetInt(Keys.BuiltBy) != hearth.VillageId || piece.GetComponent<VillageHearth>() != null ||
                    (chest != null && piece.gameObject == chest.gameObject))
                {
                    continue;
                }

                if (best == null || piece.transform.position.y > best.transform.position.y)
                {
                    best = piece;
                }
            }

            return best;
        }

        /// <summary>
        /// Takes down one piece of the old building and puts half its materials back in the chest. When nothing is
        /// left, the ground is prepared for the new building and the build starts.
        /// </summary>
        private static bool TakeDownNext(VillageHearth hearth, VillageState state, Site site)
        {
            Piece old = OldPiece(hearth);
            if (old == null)
            {
                hearth.Zdo.Set(KeySiteTeardown, 0);
                DesignSpawner.ClearArea(site.Position, site.Radius);
                PrepareGround(hearth, site.Position);
                VillheimPlugin.Log.LogInfo($"{state.Name} took down the old building; the new one starts now.");
                return true;
            }

            Container chest = VillageChest.Find(hearth);
            foreach (KeyValuePair<string, int> cost in DesignSpawner.RecipeCost(old.gameObject))
            {
                int back = cost.Value / 2;
                if (back <= 0)
                {
                    continue;
                }

                int left = back - (chest != null ? VillageChest.Add(chest, cost.Key, back) : 0);
                if (left > 0)
                {
                    state.Add(cost.Key, left);
                }
            }

            WearNTear wear = old.GetComponent<WearNTear>();
            wear?.m_destroyedEffect?.Create(old.transform.position, old.transform.rotation, old.transform);
            old.m_nview.ClaimOwnership();
            ZNetScene.instance.Destroy(old.gameObject);
            return true;
        }

        /// <summary>The material the next piece is short of, or null when it can go up now.</summary>
        public static string NextShort(VillageHearth hearth)
        {
            if (TearingDown(hearth))
            {
                return null;
            }

            Site site = Get(hearth.Zdo);
            CachedPlan plan = site != null ? GetPlan(hearth, site) : null;
            int index = hearth.Zdo.GetInt(KeySiteIndex);
            if (plan == null || index >= plan.Entries.Count || !VillheimConfig.RequireWood.Value)
            {
                return null;
            }

            if (VillageChest.IsLost(hearth))
            {
                return "chest";
            }

            Container chest = VillageChest.Find(hearth);
            var state = new VillageState(hearth.Zdo);
            foreach (KeyValuePair<string, int> amount in Due(plan, plan.Entries[index], ReadOwed(hearth.Zdo)))
            {
                int have = chest != null ? VillageChest.Count(chest, amount.Key) : state.Get(amount.Key);
                if (amount.Value > have)
                {
                    return amount.Key;
                }
            }

            return null;
        }

        /// <summary>Everything the rest of the building still costs, per material.</summary>
        public static Dictionary<string, int> Remaining(VillageHearth hearth)
        {
            var result = new Dictionary<string, int>();
            Site site = Get(hearth.Zdo);
            CachedPlan plan = site != null ? GetPlan(hearth, site) : null;
            if (plan == null || !VillheimConfig.RequireWood.Value)
            {
                return result;
            }

            int index = hearth.Zdo.GetInt(KeySiteIndex);
            if (plan.RemainingIndex != index || plan.Remaining == null)
            {
                var totals = new Dictionary<string, float>();
                for (int i = index; i < plan.Entries.Count; i++)
                {
                    foreach (KeyValuePair<string, int> cost in plan.Entries[i].Cost)
                    {
                        plan.Factors.TryGetValue(cost.Key, out float factor);
                        totals.TryGetValue(cost.Key, out float sum);
                        totals[cost.Key] = sum + cost.Value * factor;
                    }
                }

                plan.Remaining = totals;
                plan.RemainingIndex = index;
            }

            Dictionary<string, float> owed = ReadOwed(hearth.Zdo);
            foreach (KeyValuePair<string, float> total in plan.Remaining)
            {
                owed.TryGetValue(total.Key, out float carried);
                int amount = Mathf.FloorToInt(total.Value + carried);
                if (amount > 0)
                {
                    result[total.Key] = amount;
                }
            }

            return result;
        }

        /// <summary>What the site still needs beyond what is already in its chest (or the stock, when unloaded).</summary>
        public static Dictionary<string, int> Shortfall(VillageHearth hearth)
        {
            Dictionary<string, int> remaining = Remaining(hearth);
            Container chest = VillageChest.Find(hearth);
            var state = new VillageState(hearth.Zdo);
            var shortfall = new Dictionary<string, int>();
            foreach (KeyValuePair<string, int> need in remaining)
            {
                int have = chest != null ? VillageChest.Count(chest, need.Key) : state.Get(need.Key);
                if (need.Value > have)
                {
                    shortfall[need.Key] = need.Value - have;
                }
            }

            return shortfall;
        }

        /// <summary>How far the building reaches from its centre, from its structural pieces.</summary>
        public static float Footprint(VillageHearth hearth)
        {
            Site site = Get(hearth.Zdo);
            CachedPlan plan = site != null ? GetPlan(hearth, site) : null;
            return plan != null ? plan.Footprint : (site != null ? site.Radius * 0.6f : 6f);
        }

        /// <summary>
        /// Where the ground floor sits, above the design's origin: the bottom of its lowest walls (walls stand on the
        /// floor), else of its lowest floors, else of its lowest shell piece. The very lowest piece is not used on its
        /// own: posts, steps and beams can reach below the floor, and a pad levelled to them left a building floating
        /// a metre up (2026-11-06).
        /// </summary>
        public static float FloorOf(List<DesignSpawner.PlanEntry> entries)
        {
            float walls = float.MaxValue, floors = float.MaxValue, any = float.MaxValue;
            foreach (DesignSpawner.PlanEntry entry in entries)
            {
                if (!entry.Shell || !entry.Bounds.HasValue || entry.Bounds.Value.min.y > 1.5f)
                {
                    continue;
                }

                float bottom = entry.Bounds.Value.min.y;
                string name = entry.Prefab.ToLowerInvariant();
                any = Mathf.Min(any, bottom);
                if (name.Contains("wall") && !name.Contains("roof"))
                {
                    walls = Mathf.Min(walls, bottom);
                }
                else if (name.Contains("floor"))
                {
                    floors = Mathf.Min(floors, bottom);
                }
            }

            float floor = walls < float.MaxValue ? walls : floors < float.MaxValue ? floors : any < float.MaxValue ? any : 0f;
            return Mathf.Clamp(floor, -1.5f, 1.5f);
        }

        /// <summary>The height the building's ground floor sits at: where its ground is levelled to.</summary>
        public static float FloorHeight(VillageHearth hearth)
        {
            Site site = Get(hearth.Zdo);
            CachedPlan plan = site != null ? GetPlan(hearth, site) : null;
            return site == null ? hearth.transform.position.y : site.Position.y + (plan != null ? plan.Floor : 0f);
        }

        /// <summary>
        /// Levels the ground under a standing building of the village to the bottom of its lowest walls (else floors,
        /// else lowest piece), measured from the pieces themselves, flat out past the walls, grass cleared. For
        /// 'vh buildingground', to fix a building put up on the wrong ground. Returns what was done.
        /// </summary>
        public static string RelevelBuilding(VillageHearth hearth, Plot plot)
        {
            float walls = float.MaxValue, floors = float.MaxValue, any = float.MaxValue, reach = 2f;
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                if (view == null || !view.IsValid() || view.GetZDO().GetInt(Keys.BuiltBy) != hearth.VillageId ||
                    Utils.DistanceXZ(view.transform.position, plot.Position) > plot.Radius * 0.8f || view.GetComponent<Piece>() == null)
                {
                    continue;
                }

                float bottom = float.MaxValue;
                foreach (Collider collider in view.GetComponentsInChildren<Collider>())
                {
                    if (collider != null && !collider.isTrigger)
                    {
                        bottom = Mathf.Min(bottom, collider.bounds.min.y);
                    }
                }

                if (bottom == float.MaxValue)
                {
                    continue;
                }

                string name = Utils.GetPrefabName(view.gameObject).ToLowerInvariant();
                any = Mathf.Min(any, bottom);
                if (name.Contains("wall") && !name.Contains("roof"))
                {
                    walls = Mathf.Min(walls, bottom);
                    reach = Mathf.Max(reach, Utils.DistanceXZ(view.transform.position, plot.Position));
                }
                else if (name.Contains("floor"))
                {
                    floors = Mathf.Min(floors, bottom);
                    reach = Mathf.Max(reach, Utils.DistanceXZ(view.transform.position, plot.Position));
                }
            }

            float level = walls < float.MaxValue ? walls : floors < float.MaxValue ? floors : any;
            if (level == float.MaxValue)
            {
                return $"no pieces of the {plot.Design} found";
            }

            var center = new Vector3(plot.Position.x, level, plot.Position.z);
            TerrainShaper.LevelPad(center, reach + 1.5f, reach + 5f);
            HearthGround.ClearVegetation(center, reach + 4f);
            HearthGround.Paint(center, reach + 1.5f, TerrainModifier.PaintType.Dirt);
            return $"levelled the ground under the {plot.Design} at {level:0.00} out to {reach + 1.5f:0.0} m";
        }

        /// <summary>
        /// The building's ground, like the hearth's: cleared, perfectly flat at the ground floor's height out past the
        /// walls (so every door opens onto level ground), a smooth slope beyond, grass cleared, bare earth inside.
        /// </summary>
        public static void PrepareGround(VillageHearth hearth, Vector3 position)
        {
            float footprint = Footprint(hearth);
            var floor = new Vector3(position.x, FloorHeight(hearth), position.z);
            Site site = Get(hearth.Zdo);
            VillheimPlugin.Log.LogInfo($"Ground for the {site?.Design ?? "building"} levelled at {floor.y:0.00} " +
                                       $"({floor.y - position.y:+0.00;-0.00} from its origin), out to {footprint + 1.5f:0.0} m.");
            HearthGround.ClearAround(position, footprint + 3f);
            TerrainShaper.LevelPad(floor, footprint + 1.5f, footprint + 5f);
            HearthGround.ClearVegetation(floor, footprint + 4f);
            HearthGround.Paint(floor, footprint + 1.5f, TerrainModifier.PaintType.Dirt);
        }

        /// <summary>True when the point is inside the building's outline (plus a little margin).</summary>
        public static bool InsideFootprint(VillageHearth hearth, Vector3 point)
        {
            Site site = Get(hearth.Zdo);
            return site != null && Utils.DistanceXZ(point, site.Position) < Footprint(hearth) + 0.3f;
        }

        /// <summary>
        /// Ground pieces (floors, the bottom row of walls, posts) rest on the ground. Where the ground under one outside
        /// the building's pad is lower or higher than its base, a pad is levelled to the base first, so nothing goes up
        /// in the air and breaks.
        /// </summary>
        private static void GroundUnder(Site site, DesignSpawner.PlanEntry entry, Quaternion rotation, float footprint)
        {
            if (!entry.Shell || !entry.Bounds.HasValue)
            {
                return;
            }

            // Inside the building's flat pad (see PrepareGround) the ground is already right: little pads under single
            // pieces only made bumps there. This is for pieces that reach past it.
            Vector3 local0 = entry.Bounds.Value.center;
            if (new Vector2(local0.x, local0.z).magnitude < footprint + 1f)
            {
                return;
            }

            Bounds local = entry.Bounds.Value;
            if (local.min.y > 1.2f)
            {
                return; // Upper storeys and roofs rest on other pieces.
            }

            Vector3 center = site.Position + rotation * new Vector3(local.center.x, 0f, local.center.z);
            float baseY = site.Position.y + local.min.y;
            if (!ZoneSystem.instance.GetGroundHeight(center, out float ground) || Mathf.Abs(ground - baseY) < 0.25f)
            {
                return;
            }

            float half = Mathf.Clamp(Mathf.Max(local.extents.x, local.extents.z), 0.6f, 3f);
            TerrainShaper.LevelPad(new Vector3(center.x, baseY, center.z), half, half + 1.5f);
        }

        /// <summary>How far from its centre the next piece reaches sideways (half its width), 0.5 m when unknown.</summary>
        public static float NextPieceHalfWidth(VillageHearth hearth)
        {
            if (TearingDown(hearth))
            {
                return 0.8f;
            }

            Site site = Get(hearth.Zdo);
            CachedPlan plan = site != null ? GetPlan(hearth, site) : null;
            int index = hearth.Zdo.GetInt(KeySiteIndex);
            if (plan == null || index >= plan.Entries.Count || !plan.Entries[index].Bounds.HasValue)
            {
                return 0.5f;
            }

            Bounds bounds = plan.Entries[index].Bounds.Value;
            return Mathf.Clamp(Mathf.Min(bounds.extents.x, bounds.extents.z), 0.3f, 2.5f);
        }

        /// <summary>True when the character stands inside the next piece's space (a builder never builds himself in).</summary>
        public static bool InsideNextPiece(VillageHearth hearth, Character character)
        {
            if (TearingDown(hearth))
            {
                return false;
            }

            Site site = Get(hearth.Zdo);
            CachedPlan plan = site != null ? GetPlan(hearth, site) : null;
            int index = hearth.Zdo.GetInt(KeySiteIndex);
            if (plan == null || index >= plan.Entries.Count || !plan.Entries[index].Bounds.HasValue)
            {
                return false;
            }

            Bounds local = plan.Entries[index].Bounds.Value;
            local.Expand(0.4f);
            Vector3 feet = Quaternion.Inverse(Quaternion.Euler(0f, site.Yaw, 0f)) * (character.transform.position - site.Position);
            return local.Contains(feet) || local.Contains(feet + Vector3.up);
        }

        /// <summary>
        /// Where a builder stands to work on the next piece: right beside it, a step out from its edge on the side
        /// facing away from the middle of the building (walls are built from outside, floors from the edge already
        /// laid). <paramref name="extra"/> moves the spot further out, for when the first spot is inside the piece.
        /// </summary>
        public static Vector3 StandSpot(VillageHearth hearth, Vector3 piece, Vector3 from, float extra = 0f)
        {
            Site site = Get(hearth.Zdo);
            if (site == null)
            {
                return piece;
            }

            Vector3 outward = piece - site.Position;
            outward.y = 0f;
            if (outward.sqrMagnitude < 0.25f)
            {
                outward = from - piece;
                outward.y = 0f;
            }

            if (outward.sqrMagnitude < 0.01f)
            {
                outward = hearth.transform.position - site.Position;
                outward.y = 0f;
            }

            float distance = NextPieceHalfWidth(hearth) + 0.9f + extra;
            Vector3 spot = piece + outward.normalized * distance;
            if (ZoneSystem.instance.GetGroundHeight(spot, out float y))
            {
                // Stand on whatever floor is already there, else on the ground.
                spot.y = y;
                // Only a floor close to the ground counts: a roof or upper storey under the spot is never a place to
                // stand (a builder ended up on a roof).
                if (Physics.Raycast(new Vector3(spot.x, y + 1.6f, spot.z), Vector3.down, out RaycastHit hit, 2f,
                        LayerMask.GetMask("piece"), QueryTriggerInteraction.Ignore) && hit.point.y > y && hit.point.y - y < 1.2f)
                {
                    spot.y = hit.point.y;
                }
            }

            return spot;
        }

        /// <summary>Close enough to put the next piece in place: within a short step of its edge.</summary>
        public static bool InBuildReach(VillageHearth hearth, Vector3 position, Vector3 piece)
        {
            float edge = Utils.DistanceXZ(position, piece) - NextPieceHalfWidth(hearth);
            return edge <= 2.2f && Mathf.Abs(piece.y - position.y) < 7f;
        }

        private static Dictionary<string, float> ReadOwed(ZDO zdo)
        {
            var owed = new Dictionary<string, float>();
            foreach (string entry in zdo.GetString(KeySiteOwed, "").Split(';'))
            {
                int colon = entry.IndexOf(':');
                if (colon > 0)
                {
                    owed[entry.Substring(0, colon)] = P(entry.Substring(colon + 1));
                }
            }

            return owed;
        }

        private static void WriteOwed(ZDO zdo, Dictionary<string, float> owed)
        {
            zdo.Set(KeySiteOwed, string.Join(";", owed.Select(e => e.Key + ":" + F(e.Value))));
        }

        private static string F(float value) => value.ToString("0.###", CultureInfo.InvariantCulture);

        private static float P(string value) =>
            float.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out float result) ? result : 0f;
    }
}
