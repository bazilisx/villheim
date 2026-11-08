using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Storage chests (Tyler, 2026-11-08, D-016). The main chest stays by the hearth; extra vanilla wood chests come
    /// with growth, each with a vanilla sign on its front saying what it holds.
    ///
    /// - How many: StorageChestSteps gives chests by buildings ("1:1, 2:2, 3:4": one with the first building, two
    ///   with the second, four with the third; the village has no decor stages yet, so its first three buildings
    ///   stand for s1d1 to s1d3). Then one more for every StorageChestPeople villagers past six, and one more each
    ///   time the main chest is full with nowhere to sort to (at most one a day). Never more than StorageChestMax.
    /// - What each holds, in the order they come: wood, stone, fine wood and core wood (where the village has them),
    ///   food, ore and metal, other; past seven, wood and stone again. The kind is kept on the chest.
    /// - Where: a block by the main chest, in stacks two high side by side, rows behind (FreeSpot), all facing the
    ///   hearth, never touching the notice board, the hearth or a path (ClearFor); another side when that one is full. They are amenity jobs (Amenities) the builder makes: paid from the chest like a bench, the sign after
    ///   its chest, both made again if destroyed. While the village has no storehouse, a full main chest asks for one
    ///   more chest every quarter day.
    /// - Sorting (Villagers/Sorting): when the main chest is StorageSortAt full, a villager carries a stack from it to
    ///   the storage chest of its kind. The builder pays from any of them (VillageChest.Take).
    /// </summary>
    internal static class StorageChests
    {
        public const string ChestPrefab = "piece_chest_wood";
        public const string SignPrefab = "sign";
        public const string ChestJob = "storage chest";
        public const string SignJob = "storage sign";

        public static readonly int KeyVillage = "villheim_storage".GetStableHashCode();
        public static readonly int KeyKind = "villheim_storage_kind".GetStableHashCode();
        private static readonly int KeySign = "villheim_storage_sign".GetStableHashCode();
        private static readonly int KeyExtra = "villheim_storage_extra".GetStableHashCode();
        private static readonly int KeyExtraDay = "villheim_storage_extra_day".GetStableHashCode();

        public const string Wood = "wood";
        public const string FineWood = "fine wood";
        public const string CoreWood = "core wood";
        public const string Stone = "stone";
        public const string Metal = "ore and metal";
        public const string Food = "food";
        public const string Other = "other";

        private static readonly HashSet<string> Metals = new HashSet<string>
        {
            "Copper", "Tin", "Bronze", "Iron", "IronScrap", "Silver", "BlackMetal", "BlackMetalScrap", "Flametal", "FlametalNew",
            "CopperScrap", "BronzeNails", "IronNails", "Obsidian", "Coal",
        };

        private const float Step = 1.7f;
        private const float FirstOffset = 2.8f;

        public static bool On => LogicConfig.IsOn(LogicConfig.StorageChests) && LogicConfig.IsOn(LogicConfig.SiteChest);

        private static readonly Dictionary<int, (float Time, List<Container> Chests)> Cache = new Dictionary<int, (float, List<Container>)>();

        /// <summary>The village's storage chests that are loaded, found again every three seconds.</summary>
        public static List<Container> Of(int villageId)
        {
            if (Cache.TryGetValue(villageId, out var cached) && Time.time - cached.Time < 3f && cached.Chests.All(c => c))
            {
                return cached.Chests;
            }

            var chests = new List<Container>();
            VillageHearth hearth = VillageHearth.Find(villageId);
            if (hearth != null && hearth.IsValid)
            {
                foreach (Collider collider in Physics.OverlapSphere(hearth.transform.position, 25f, LayerMask.GetMask("piece", "piece_nonsolid")))
                {
                    Container container = collider.GetComponentInParent<Container>();
                    if (container && container.m_nview && container.m_nview.IsValid() && !chests.Contains(container) &&
                        container.m_nview.GetZDO().GetInt(KeyVillage) == villageId)
                    {
                        chests.Add(container);
                    }
                }
            }

            Cache[villageId] = (Time.time, chests);
            return chests;
        }

        public static string KindOf(Container chest) =>
            chest && chest.m_nview && chest.m_nview.IsValid() ? chest.m_nview.GetZDO().GetString(KeyKind, Other) : Other;

        /// <summary>Which kind of storage an item belongs in.</summary>
        public static string KindOfItem(ItemDrop.ItemData item)
        {
            string prefab = item?.m_dropPrefab != null ? item.m_dropPrefab.name : "";
            switch (prefab)
            {
                case Materials.Wood: return Wood;
                case Materials.FineWood: return FineWood;
                case Materials.CoreWood: return CoreWood;
                case Materials.Stone: return Stone;
            }

            if (prefab.EndsWith("Ore") || Metals.Contains(prefab))
            {
                return Metal;
            }

            return item?.m_shared != null && item.m_shared.m_food > 0f ? Food : Other;
        }

        // ---------------------------------------------------------------- how many, and what

        public static int Wanted(VillageHearth hearth, VillageState state)
        {
            if (!On)
            {
                return 0;
            }

            int chests = 0;
            foreach (string part in (LogicConfig.StorageChestSteps?.Value ?? "1:1, 2:2, 3:4").Split(','))
            {
                string[] pair = part.Split(':');
                if (pair.Length == 2 && int.TryParse(pair[0].Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out int buildings) &&
                    int.TryParse(pair[1].Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out int count) &&
                    state.Plots.Count >= buildings)
                {
                    chests = Mathf.Max(chests, count);
                }
            }

            int per = LogicConfig.StorageChestPeople?.Value ?? 3;
            int people = VillageBrain.CountVillagers(state.Id);
            if (chests > 0 && per > 0 && people > 6)
            {
                chests += (people - 6) / per;
            }

            // Asked for by a full main chest (NeedMore), even before the first building.
            chests += hearth.Zdo.GetInt(KeyExtra);

            return Mathf.Clamp(chests, 0, LogicConfig.StorageChestMax?.Value ?? 8);
        }

        /// <summary>The kinds of the first n storage chests, in the order they come.</summary>
        private static List<string> Kinds(VillageState state, int n)
        {
            HashSet<string> allowed = Materials.AllowedIn(state.Biome);
            var order = new List<string> { Wood, Stone };
            if (allowed.Contains(Materials.FineWood)) order.Add(FineWood);
            if (allowed.Contains(Materials.CoreWood)) order.Add(CoreWood);
            order.Add(Food);
            order.Add(Metal);
            order.Add(Other);
            var kinds = new List<string>();
            for (int i = 0; i < n; i++)
            {
                kinds.Add(i < order.Count ? order[i] : (i - order.Count) % 2 == 0 ? Wood : Stone);
            }

            return kinds;
        }

        /// <summary>The main chest is full and nothing can be sorted out of it: the village wants one more chest (once a day).</summary>
        public static void NeedMore(VillageHearth hearth)
        {
            // Without a storehouse yet, one more stack's chest every quarter day while the chest stays full (T-12); with
            // one, once a day.
            var state = new VillageState(hearth.Zdo);
            bool storehouse = state.Plots.Any(p => p.Role == nameof(Designs.Role.Storage));
            int quarters = EnvMan.instance != null ? Mathf.FloorToInt((float)(ZNet.instance.GetTimeSeconds() / (VillageBrain.DayLength() / 4.0))) : 0;
            int stamp = storehouse ? quarters / 4 * 4 : quarters;
            if (hearth.Zdo.GetInt(KeyExtraDay, -1) == stamp)
            {
                return;
            }

            hearth.Zdo.Set(KeyExtraDay, stamp);
            int extra = hearth.Zdo.GetInt(KeyExtra);
            if (extra < (LogicConfig.StorageChestMax?.Value ?? 8))
            {
                hearth.Zdo.Set(KeyExtra, extra + 1);
                Amenities.Forget(hearth.VillageId);
            }
        }

        // ---------------------------------------------------------------- the amenity jobs

        /// <summary>The next storage chest or label to make, or null.</summary>
        public static Amenities.Job Job(VillageHearth hearth, VillageState state)
        {
            int wanted = Wanted(hearth, state);
            Container main = VillageChest.Find(hearth);
            if (wanted <= 0 || main == null)
            {
                return null;
            }

            // A stack without its label gets its sign first. One sign per stack, on the lower chest's front, where it
            // has the chest to hang on: a sign on the upper chest counted as hanging in the air and broke (T-43). It
            // names both chests, the upper one first.
            foreach (Container chest in Of(state.Id))
            {
                if (Below(state.Id, chest) != null)
                {
                    continue; // labelled on the chest under it
                }

                if (!HasSign(chest, state.Id))
                {
                    Amenities.Job sign = LabelJob(state, chest);
                    if (sign != null)
                    {
                        return sign;
                    }
                }
                else
                {
                    Relabel(state.Id, chest);
                }
            }

            List<string> have = Of(state.Id).Select(KindOf).ToList();
            string kind = null;
            foreach (string want in Kinds(state, wanted))
            {
                if (!have.Remove(want))
                {
                    kind = want;
                    break;
                }
            }

            GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(ChestPrefab) : null;
            if (kind == null || prefab == null || !Amenities.Buildable(prefab, state.Biome, out Dictionary<string, int> cost, true) ||
                !FreeSpot(hearth, state, main, out Vector3 spot, out Quaternion rotation))
            {
                return null;
            }

            return new Amenities.Job
            {
                Prefab = ChestPrefab, Name = ChestJob, Spot = spot, Rotation = rotation, Cost = cost, Kind = kind,
            };
        }

        /// <summary>The store's chest this one stands on, or null.</summary>
        private static Container Below(int villageId, Container chest)
        {
            Vector3 under = chest.transform.position - Vector3.up * ChestSize().y;
            Container below = StorageAt(villageId, under);
            return below != null && below != chest ? below : null;
        }

        /// <summary>The store's chest standing on this one, or null.</summary>
        private static Container Above(int villageId, Container chest)
        {
            Container above = StorageAt(villageId, chest.transform.position + Vector3.up * ChestSize().y);
            return above != null && above != chest ? above : null;
        }

        /// <summary>What a stack's sign says: the upper chest's kind over the lower one's.</summary>
        private static string LabelText(int villageId, Container lower)
        {
            Container upper = Above(villageId, lower);
            return upper != null ? $"<#fff>{Label(KindOf(upper))}<br>{Label(KindOf(lower))}" : $"<#fff>{Label(KindOf(lower))}";
        }

        /// <summary>Brings the stack's sign up to date once a chest goes on top (the text only, nothing is built).</summary>
        private static void Relabel(int villageId, Container lower)
        {
            SignPlace(lower, out Vector3 spot, out _);
            string text = LabelText(villageId, lower);
            foreach (Collider collider in Physics.OverlapSphere(spot, 0.4f))
            {
                Sign sign = collider.GetComponentInParent<Sign>();
                ZNetView view = sign != null ? sign.GetComponent<ZNetView>() : null;
                if (view != null && view.IsValid() && view.GetZDO().GetInt(KeySign) == villageId &&
                    view.GetZDO().GetString(ZDOVars.s_text, "") != text)
                {
                    view.ClaimOwnership();
                    view.GetZDO().Set(ZDOVars.s_text, text);
                    sign.UpdateText();
                }
            }
        }

        /// <summary>The main chest is (nearly) full: another storage chest comes before anything but the essentials (T-42).</summary>
        public static bool Urgent(VillageHearth hearth)
        {
            Container main = VillageChest.Find(hearth);
            Inventory inventory = main != null ? main.GetInventory() : null;
            return On && inventory != null && (inventory.GetEmptySlots() <= 1 || inventory.SlotsUsedPercentage() >= 90f);
        }

        private static Amenities.Job LabelJob(VillageState state, Container chest)
        {
            GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(SignPrefab) : null;
            if (prefab == null || !Amenities.Buildable(prefab, state.Biome, out Dictionary<string, int> cost, true))
            {
                return null;
            }

            SignPlace(chest, out Vector3 spot, out Quaternion rotation);
            return new Amenities.Job
            {
                Prefab = SignPrefab, Name = SignJob, Spot = spot, Rotation = rotation, Cost = cost, Kind = KindOf(chest),
            };
        }

        /// <summary>Puts the chest or its sign down (already paid for). False when the spot is taken.</summary>
        public static bool Make(VillageHearth hearth, VillageState state, Amenities.Job job)
        {
            GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(job.Prefab) : null;
            if (prefab == null)
            {
                return false;
            }

            GameObject made = Object.Instantiate(prefab, job.Spot, job.Rotation);
            ZNetView view = made.GetComponent<ZNetView>();
            if (view == null || view.GetZDO() == null)
            {
                return false;
            }

            ZDO zdo = view.GetZDO();
            zdo.Set(Keys.BuiltBy, hearth.VillageId);
            if (job.Name == ChestJob)
            {
                zdo.Set(KeyVillage, hearth.VillageId);
                zdo.Set(KeyKind, job.Kind);
                Cache.Remove(hearth.VillageId);
            }
            else
            {
                zdo.Set(KeySign, hearth.VillageId);
                if (made.TryGetComponent(out Sign sign))
                {
                    Container labelled = Of(hearth.VillageId).OrderBy(c => Vector3.Distance(c.transform.position, job.Spot)).FirstOrDefault();
                    zdo.Set(ZDOVars.s_text, labelled != null ? LabelText(hearth.VillageId, labelled) : $"<#fff>{Label(job.Kind)}");
                    sign.UpdateText();
                }
            }

            if (made.TryGetComponent(out Piece piece))
            {
                piece.m_placeEffect?.Create(job.Spot, job.Rotation, made.transform);
            }

            VillheimPlugin.Log.LogInfo($"{state.Name} made a {job.Name} for {job.Kind} by the hearth.");
            return true;
        }

        public static string Label(string kind) =>
            string.IsNullOrEmpty(kind) ? "Other" : char.ToUpperInvariant(kind[0]) + kind.Substring(1);

        // ---------------------------------------------------------------- places

        /// <summary>The front of the chest (the side toward the hearth), where its label goes.</summary>
        private static void SignPlace(Container chest, out Vector3 spot, out Quaternion rotation)
        {
            Transform t = chest.transform;
            Bounds? bounds = Designs.BuildOrder.Measure(ZNetScene.instance.GetPrefab(ChestPrefab), ChestPrefab, Vector3.zero,
                Quaternion.identity, Vector3.one);
            float depth = bounds.HasValue ? bounds.Value.extents.z + Mathf.Abs(bounds.Value.center.z) : 0.4f;
            float height = bounds.HasValue ? bounds.Value.center.y : 0.4f;
            spot = t.position + t.forward * (depth + 0.03f) + Vector3.up * height;
            rotation = Quaternion.LookRotation(t.forward);
        }

        private static bool HasSign(Container chest, int villageId)
        {
            SignPlace(chest, out Vector3 spot, out _);
            foreach (Collider collider in Physics.OverlapSphere(spot, 0.4f))
            {
                ZNetView view = collider.GetComponentInParent<ZNetView>();
                if (view != null && view.IsValid() && view.GetComponent<Sign>() != null && view.GetZDO().GetInt(KeySign) == villageId)
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>The wood chest's size: width (along its front), depth and height. Measured once.</summary>
        private static Vector3 ChestSize()
        {
            if (_chestSize == Vector3.zero)
            {
                GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(ChestPrefab) : null;
                Bounds? bounds = prefab != null
                    ? Designs.BuildOrder.Measure(prefab, ChestPrefab, Vector3.zero, Quaternion.identity, Vector3.one)
                    : null;
                _chestSize = bounds.HasValue ? bounds.Value.size : new Vector3(1.4f, 0.8f, 0.8f);
            }

            return _chestSize;
        }

        private static Vector3 _chestSize;

        /// <summary>A storage chest of this village stands at the spot (within a hand's width).</summary>
        private static Container StorageAt(int villageId, Vector3 spot)
        {
            foreach (Container chest in Of(villageId))
            {
                if (chest && Utils.DistanceXZ(chest.transform.position, spot) < 0.35f && Mathf.Abs(chest.transform.position.y - spot.y) < 0.35f)
                {
                    return chest;
                }
            }

            return null;
        }

        /// <summary>
        /// Nothing but the ground where a chest (or a stack of <paramref name="levels"/>) would stand, with a hand's width
        /// round it: none of the village's pieces (the notice board over the main chest, the main chest, a bench), no
        /// tree or rock, not by the hearth, not on a path (Tyler: the store must never clip into the notice board).
        /// The store's own chests and signs (its neighbours in the block) don't count.
        /// </summary>
        private static bool ClearFor(VillageHearth hearth, HashSet<Vector2Int> paths, Vector3 spot, Quaternion rotation, int levels, Container below)
        {
            if (Utils.DistanceXZ(spot, hearth.transform.position) < 3f || PathPlanner.DistanceToNetwork(paths, spot) < 1.6f)
            {
                return false;
            }

            Vector3 size = ChestSize();
            var half = new Vector3(size.x * 0.5f + 0.25f, size.y * levels * 0.5f - 0.05f, size.z * 0.5f + 0.25f);
            Vector3 middle = spot + Vector3.up * (size.y * levels * 0.5f + 0.05f);
            foreach (Collider collider in Physics.OverlapBox(middle, half, rotation, ~0, QueryTriggerInteraction.Ignore))
            {
                if (collider.GetComponentInParent<Heightmap>() != null || collider.GetComponentInParent<Character>() != null)
                {
                    continue;
                }

                ZNetView view = collider.GetComponentInParent<ZNetView>();
                // Its neighbours in the block (the store's own chests and their signs) stand close on purpose.
                if (view == null || (below != null && view.gameObject == below.gameObject) || view.GetComponent<ItemDrop>() != null ||
                    (view.IsValid() && (view.GetZDO().GetInt(KeyVillage) == hearth.VillageId || view.GetZDO().GetInt(KeySign) == hearth.VillageId)))
                {
                    continue;
                }

                return false;
            }

            return true;
        }

        /// <summary>
        /// The next place in the store block (Tyler, T-15): chests in stacks two high, the stacks side by side in a row,
        /// rows behind, every chest facing the hearth so the block reads as one. A stack's lower chest comes first, then
        /// the one on top. Tried in turn, each checked to stand clear (ClearFor): along the main chest's side, beyond the
        /// notice board's posts; then a row behind the main chest; then the far side of the hearth.
        /// </summary>
        private static bool FreeSpot(VillageHearth hearth, VillageState state, Container main, out Vector3 spot, out Quaternion rotation)
        {
            Vector3 center = hearth.transform.position;
            Vector3 origin = main.transform.position;
            Vector3 out_ = (origin - center).Horizontal();
            out_ = out_.sqrMagnitude > 0.01f ? out_.normalized : Vector3.forward;
            Vector3 along = Vector3.Cross(Vector3.up, out_);
            Vector3 size = ChestSize();
            float width = Mathf.Max(size.x, size.z) + 0.15f;
            float depth = Mathf.Min(size.x, size.z);
            float fromHearth = Utils.DistanceXZ(origin, center);
            HashSet<Vector2Int> paths = PathPlanner.PlannedNetwork(hearth);
            var layouts = new List<(Vector3 Origin, Vector3 Along, Vector3 Back, float First)>
            {
                (origin, along, out_, FirstOffset),
                (origin + out_ * (depth + 2.2f), along, out_, 0.9f),
                (center - out_ * fromHearth, -along, -out_, 0.9f),
            };

            foreach ((Vector3 start, Vector3 side, Vector3 back, float first) in layouts)
            {
                Quaternion facing = Quaternion.LookRotation(-back);
                for (int row = 0; row < 3; row++)
                {
                    for (int column = 0; column < 8; column++)
                    {
                        float offset = (first + (column / 2) * width) * (column % 2 == 0 ? 1f : -1f);
                        Vector3 ground = start + side * offset + back * (row * (depth + 0.9f));
                        Container bottom = StorageAt(hearth.VillageId, ground);
                        if (bottom == null)
                        {
                            // The store's own neighbours are fine; anything else of the village is checked by ClearFor.
                            if (!Amenities.Usable(hearth, state, ground, out float y, false))
                            {
                                continue;
                            }

                            var at = new Vector3(ground.x, y, ground.z);
                            if (!ClearFor(hearth, paths, at, facing, 2, null))
                            {
                                continue;
                            }

                            spot = at;
                            rotation = facing;
                            return true;
                        }

                        Vector3 top = bottom.transform.position + Vector3.up * size.y;
                        if (StorageAt(hearth.VillageId, top) == null && ClearFor(hearth, paths, top, bottom.transform.rotation, 1, bottom))
                        {
                            spot = top;
                            rotation = bottom.transform.rotation;
                            return true;
                        }
                    }
                }
            }

            spot = origin;
            rotation = Quaternion.identity;
            return false;
        }

        /// <summary>Something this village made stands within the radius (the notice board's posts, another chest).</summary>
        private static bool OwnPieceNear(int villageId, Vector3 spot, float radius)
        {
            foreach (Collider collider in Physics.OverlapSphere(spot + Vector3.up * 0.5f, radius, LayerMask.GetMask("piece", "piece_nonsolid")))
            {
                ZNetView view = collider.GetComponentInParent<ZNetView>();
                if (view != null && view.IsValid() && view.GetZDO().GetInt(Keys.BuiltBy) == villageId)
                {
                    return true;
                }
            }

            return false;
        }

        public static string Describe(VillageHearth hearth)
        {
            var state = new VillageState(hearth.Zdo);
            List<Container> chests = Of(state.Id);
            return $"storage chests {chests.Count} of {Wanted(hearth, state)}" +
                   (chests.Count > 0 ? ": " + string.Join(", ", chests.Select(c => $"{KindOf(c)} ({c.GetInventory().NrOfItems()} stacks)")) : "");
        }
    }
}
