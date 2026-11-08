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
    /// - Where: in a row along the main chest's side, beyond the notice board's posts, facing the hearth. They are
    ///   amenity jobs (Amenities): paid from the chest like a bench, the sign after its chest, both made again if
    ///   destroyed.
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

            if (chests > 0)
            {
                chests += hearth.Zdo.GetInt(KeyExtra);
            }

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
            int today = EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;
            if (hearth.Zdo.GetInt(KeyExtraDay, -1) == today)
            {
                return;
            }

            hearth.Zdo.Set(KeyExtraDay, today);
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

            // A chest that stands without its label gets its sign first.
            foreach (Container chest in Of(state.Id))
            {
                if (!HasSign(chest, state.Id))
                {
                    Amenities.Job sign = LabelJob(state, chest);
                    if (sign != null)
                    {
                        return sign;
                    }
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
                    zdo.Set(ZDOVars.s_text, $"<#fff>{Label(job.Kind)}");
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

        /// <summary>The next free place in the row along the main chest's side, alternating left and right.</summary>
        private static bool FreeSpot(VillageHearth hearth, VillageState state, Container main, out Vector3 spot, out Quaternion rotation)
        {
            Vector3 center = hearth.transform.position;
            Vector3 origin = main.transform.position;
            Vector3 out_ = (origin - center).Horizontal();
            out_ = out_.sqrMagnitude > 0.01f ? out_.normalized : Vector3.forward;
            Vector3 along = Vector3.Cross(Vector3.up, out_);
            for (int i = 0; i < 16; i++)
            {
                float offset = (FirstOffset + (i / 2) * Step) * (i % 2 == 0 ? 1f : -1f);
                spot = origin + along * offset;
                if (!Amenities.Usable(hearth, state, spot, out float y) || OwnPieceNear(hearth.VillageId, spot, 1f))
                {
                    continue;
                }

                spot.y = y;
                Vector3 toHearth = (center - spot).Horizontal();
                rotation = toHearth.sqrMagnitude > 0.01f ? Quaternion.LookRotation(toHearth) : main.transform.rotation;
                return true;
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
