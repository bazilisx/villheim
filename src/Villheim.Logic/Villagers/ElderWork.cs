using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// The elders' share of the work (Tyler: they sat at the fire all day; they should help with anything in the village
    /// that is not building, felling or mining). By day an elder takes one small job at a time, at his own pace, and
    /// rests between them (free time, usually by the fire):
    ///
    /// - tending the fire, cooking at the cooking station, seeing to the chests,
    /// - sweeping and tidying by the homes, feeding the animals (acted: no feed is used, D-015),
    /// - helping with the crops now and then (acted, never as the farmer: D-075, D-078),
    /// - mending worn pieces inside the village, never the outer fence (D-078),
    /// - making arrows at the workbench (acted),
    /// - carrying things lying about in the village to the chest (real: what he carries goes in).
    ///
    /// Sorting a full chest (Sorting) is real work the elders also take, ahead of these. Foraging is in Foraging.
    /// </summary>
    internal static class ElderWork
    {
        private enum Kind
        {
            None,
            Fire,
            Cook,
            Chests,
            Tidy,
            Farm,
            Animals,
            Arrows,
            Carry,
            Mend,
        }

        private sealed class State
        {
            public Kind Kind;
            public Vector3 Spot;
            public Vector3 Look;
            public bool Arrived;
            public float Until;
            public float GiveUpAt;
            public float NextAct;
            public float RestUntil;
            public float LastRun;
            public ItemDrop Item;
            public string Material;
            public int Amount;
            public bool ToChest;
            public WearNTear Damaged;
        }

        private const float VillageReach = 30f;
        private const float EveningStart = 0.68f;

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        public static string Describe(Villager villager)
        {
            if (!States.TryGetValue(villager, out State state) || state.Kind == Kind.None || Time.time - state.LastRun > 1f)
            {
                return null;
            }

            switch (state.Kind)
            {
                case Kind.Fire: return "tending the fire";
                case Kind.Cook: return "cooking at the cooking station";
                case Kind.Chests: return "seeing to the village chests";
                case Kind.Tidy: return "sweeping and tidying";
                case Kind.Farm: return "tending the farm";
                case Kind.Animals: return "feeding the animals";
                case Kind.Arrows: return "making arrows at the workbench";
                case Kind.Carry: return state.ToChest ? "carrying things to the chest" : "picking up things lying about";
                case Kind.Mend: return "mending";
                default: return null;
            }
        }

        /// <summary>The tool his elder's job has in hand: the hoe at the farm, the hammer for arrows. Null otherwise.</summary>
        public static VillagerLooks.Tool? ToolInUse(Villager villager)
        {
            if (!States.TryGetValue(villager, out State state) || Time.time - state.LastRun > 1f || !state.Arrived)
            {
                return null;
            }

            return state.Kind == Kind.Farm ? VillagerLooks.Tool.Hoe :
                state.Kind == Kind.Arrows || state.Kind == Kind.Mend ? VillagerLooks.Tool.Hammer : (VillagerLooks.Tool?)null;
        }

        /// <summary>True while an elder is at (or on his way to) one of his jobs.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            State state = States.GetOrCreateValue(villager);
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (!Elders.IsElder(villager) || Chores.IsVillageBuilder(villager) || hearth == null || !hearth.IsValid ||
                EnvMan.instance == null || EnvMan.IsNight() || EnvMan.instance.GetDayFraction() > EveningStart)
            {
                Stop(villager, state);
                return false;
            }

            if (state.Kind == Kind.None)
            {
                if (Time.time < state.RestUntil || !Begin(villager, state, hearth))
                {
                    return false;
                }
            }

            state.LastRun = Time.time;
            if (!state.Arrived)
            {
                // An elder walks: no running to a chore.
                WalkResult step = Walker.For(villager).Go(villager, ai, dt, state.Spot, 0.9f);
                if (step == WalkResult.Walking && Time.time < state.GiveUpAt)
                {
                    return true;
                }

                if (Utils.DistanceXZ(villager.transform.position, state.Spot) > 2.5f)
                {
                    Done(villager, state, 30f);
                    return false;
                }

                ai.StopMoving();
                if (state.Kind == Kind.Carry)
                {
                    return Carry(villager, ai, state, hearth);
                }

                state.Arrived = true;
                state.Until = Time.time + Random.Range(25f, 45f);
                state.NextAct = Time.time + Random.Range(0.5f, 1.5f);
            }

            ai.StopMoving();
            ai.LookAt(state.Look);
            if (Time.time >= state.Until)
            {
                Done(villager, state, 0f);
                return false;
            }

            if (Time.time >= state.NextAct)
            {
                Act(villager, state);
            }

            if (state.Kind == Kind.Fire || state.Kind == Kind.Animals || state.Kind == Kind.Tidy)
            {
                // Down on one knee for a while at the fire, by the animals, picking up after the others.
                if ((state.Until - Time.time) % 12f > 6f)
                {
                    Poses.Hold(villager, Poses.Kneel);
                }
            }

            return true;
        }

        private static void Act(Villager villager, State state)
        {
            switch (state.Kind)
            {
                case Kind.Farm:
                    VillagerLooks.Hold(villager, VillagerLooks.Tool.Hoe);
                    Chores.ToolAnimation(villager, VillagerLooks.Tool.Hoe);
                    state.NextAct = Time.time + Random.Range(3.5f, 5f);
                    break;
                case Kind.Arrows:
                    VillagerLooks.Hold(villager, VillagerLooks.Tool.Hammer);
                    Chores.ToolAnimation(villager, VillagerLooks.Tool.Hammer);
                    state.NextAct = Time.time + Random.Range(3f, 4.5f);
                    break;
                case Kind.Mend:
                    VillagerLooks.Hold(villager, VillagerLooks.Tool.Hammer);
                    Chores.ToolAnimation(villager, VillagerLooks.Tool.Hammer);
                    state.NextAct = Time.time + Random.Range(2.5f, 3.5f);
                    // A few slow swings, then it is whole again (as the hammer's repair does for a player).
                    if (state.Damaged != null && ++state.Amount >= 3)
                    {
                        state.Damaged.Repair();
                        state.Damaged = null;
                        state.Until = Time.time + 1f;
                    }

                    break;
                default:
                    Poses.Trigger(villager, "interact");
                    state.NextAct = Time.time + Random.Range(2.5f, 4.5f);
                    break;
            }
        }

        /// <summary>Picks up what lies at the spot, then takes it to the chest and puts it in.</summary>
        private static bool Carry(Villager villager, VillagerAI ai, State state, VillageHearth hearth)
        {
            if (!state.ToChest)
            {
                ItemDrop item = state.Item;
                ZNetView view = item != null ? item.GetComponent<ZNetView>() : null;
                if (view == null || !view.IsValid())
                {
                    Done(villager, state, 10f);
                    return false;
                }

                Poses.Trigger(villager, "interact");
                state.Amount = item.m_itemData.m_stack;
                view.ClaimOwnership();
                ZNetScene.instance.Destroy(item.gameObject);
                Container chest = VillageChest.Find(hearth);
                if (chest == null)
                {
                    VillageBrain.AddMaterial(villager.VillageId, state.Material, state.Amount);
                    Done(villager, state, 0f);
                    return false;
                }

                state.ToChest = true;
                state.Spot = chest.transform.position;
                state.Look = chest.transform.position + Vector3.up * 0.5f;
                state.GiveUpAt = Time.time + 45f;
                Walker.For(villager).Reset();
                return true;
            }

            Container main = VillageChest.Find(hearth);
            int left = state.Amount - (main != null ? VillageChest.Add(main, state.Material, state.Amount) : 0);
            if (left > 0)
            {
                VillageBrain.AddMaterial(villager.VillageId, state.Material, left);
            }

            ai.LookAt(state.Look);
            Poses.Trigger(villager, "interact");
            VillageNeeds.Forget(villager.VillageId);
            VillheimPlugin.Debug($"{villager.VillagerName} put {state.Amount} {Materials.Label(state.Material)} in the village chest.");
            state.Amount = 0;
            Done(villager, state, 0f);
            return false;
        }

        private static void Done(Villager villager, State state, float extraRest)
        {
            if (state.Kind == Kind.Carry && state.ToChest && state.Amount > 0)
            {
                // Never lose what he carried: it counts for the village even if he could not reach the chest.
                VillageBrain.AddMaterial(villager.VillageId, state.Material, state.Amount);
            }

            state.Kind = Kind.None;
            state.Arrived = false;
            state.Item = null;
            state.Damaged = null;
            state.Amount = 0;
            state.ToChest = false;
            // Elders rest more than they work: a good while by the fire between jobs.
            state.RestUntil = Time.time + Random.Range(40f, 90f) + extraRest;
            Walker.For(villager).Reset();
        }

        private static void Stop(Villager villager, State state)
        {
            if (state.Kind != Kind.None)
            {
                Done(villager, state, 0f);
                state.RestUntil = Time.time + Random.Range(5f, 15f);
            }
        }

        private static bool Begin(Villager villager, State state, VillageHearth hearth)
        {
            var state0 = new VillageState(hearth.Zdo);
            Vector3 center = hearth.transform.position;
            var options = new List<(Kind Kind, float Weight)>
            {
                (Kind.Fire, 2f),
                (Kind.Chests, VillageChest.Find(hearth) != null ? 1.5f : 0f),
                (Kind.Tidy, state0.Plots.Count > 0 ? 1.5f : 0f),
                (Kind.Cook, 0f), // real cooking happens through Healing; no pretend cooking
                // Never the farmer (D-075), but an elder helps with the crops now and then (D-078).
                (Kind.Farm, state0.Plots.Any(p => p.Role == nameof(Designs.Role.Farm)) ? 0.75f : 0f),
                // Mending inside the village, never the outer fence (D-078).
                (Kind.Mend, Damaged(hearth) != null ? 2f : 0f),
                (Kind.Animals, Animal(center) != null ? 1.5f : 0f),
                (Kind.Arrows, Workbench(center) != null ? 1f : 0f),
                (Kind.Carry, Loose(center) != null ? 3f : 0f),
            };

            float total = options.Sum(o => o.Weight);
            float roll = Random.value * total;
            Kind kind = Kind.None;
            foreach ((Kind k, float w) in options)
            {
                roll -= w;
                if (w > 0f && roll <= 0f)
                {
                    kind = k;
                    break;
                }
            }

            if (kind == Kind.None || !Place(villager, state, hearth, state0, kind))
            {
                state.RestUntil = Time.time + 20f;
                return false;
            }

            state.Kind = kind;
            state.Arrived = false;
            state.GiveUpAt = Time.time + 45f;
            Walker.For(villager).Reset();
            return true;
        }

        /// <summary>Where to stand for the job, and what to look at.</summary>
        private static bool Place(Villager villager, State state, VillageHearth hearth, VillageState village, Kind kind)
        {
            Vector3 center = hearth.transform.position;
            Vector3 target;
            float stand = 1.5f;
            switch (kind)
            {
                case Kind.Fire:
                    target = center;
                    stand = 2.4f;
                    break;
                case Kind.Cook:
                    CookingStation cook = Nearest<CookingStation>(center, VillageReach);
                    if (cook == null) return false;
                    target = cook.transform.position;
                    stand = 1.4f;
                    break;
                case Kind.Chests:
                    List<Container> chests = StorageChests.Of(villager.VillageId);
                    Container chest = chests.Count > 0 && Random.value < 0.5f ? chests[Random.Range(0, chests.Count)] : VillageChest.Find(hearth);
                    if (chest == null) return false;
                    target = chest.transform.position;
                    break;
                case Kind.Tidy:
                    Plot home = village.Plots[Random.Range(0, village.Plots.Count)];
                    Vector3 dir = Quaternion.Euler(0f, Random.Range(0f, 360f), 0f) * Vector3.forward;
                    target = home.Position + dir * (home.Radius * 0.6f + 1.5f);
                    stand = 0.6f;
                    break;
                case Kind.Farm:
                    List<Plot> farms = village.Plots.Where(p => p.Role == nameof(Designs.Role.Farm)).ToList();
                    Plot farm = farms[Random.Range(0, farms.Count)];
                    target = farm.Position + Quaternion.Euler(0f, Random.Range(0f, 360f), 0f) * Vector3.forward * Random.Range(0f, farm.Radius * 0.5f);
                    stand = 1f;
                    break;
                case Kind.Animals:
                    Character animal = Animal(center);
                    if (animal == null) return false;
                    target = animal.transform.position;
                    stand = 1.3f;
                    break;
                case Kind.Mend:
                    WearNTear damaged = Damaged(hearth);
                    if (damaged == null) return false;
                    state.Damaged = damaged;
                    target = damaged.transform.position;
                    stand = 1.6f;
                    break;
                case Kind.Arrows:
                    CraftingStation bench = Workbench(center);
                    if (bench == null) return false;
                    target = bench.transform.position;
                    stand = 1.4f;
                    break;
                case Kind.Carry:
                    ItemDrop item = Loose(center);
                    if (item == null) return false;
                    state.Item = item;
                    state.Material = Utils.GetPrefabName(item.gameObject);
                    state.ToChest = false;
                    target = item.transform.position;
                    stand = 0.6f;
                    break;
                default:
                    return false;
            }

            Vector3 away = (villager.transform.position - target).Horizontal();
            away = away.sqrMagnitude > 0.01f ? away.normalized : Vector3.forward;
            Vector3 spot = target + away * stand;
            if (ZoneSystem.instance.GetGroundHeight(spot, out float y) && Mathf.Abs(y - spot.y) < 2f)
            {
                spot.y = y;
            }

            state.Spot = spot;
            state.Look = target + Vector3.up * 0.5f;
            return true;
        }

        private static readonly Dictionary<int, (float At, WearNTear Piece)> DamagedCache = new Dictionary<int, (float, WearNTear)>();
        private static readonly List<Piece> MendPieces = new List<Piece>();

        /// <summary>
        /// A piece the village built, inside the village and off its outer fence, below 80 % of its health; the most
        /// worn first. Looked for every 15 s per village.
        /// </summary>
        private static WearNTear Damaged(VillageHearth hearth)
        {
            if (DamagedCache.TryGetValue(hearth.VillageId, out var kept) && Time.time - kept.At < 15f &&
                (kept.Piece == null || kept.Piece.GetHealthPercentage() < 0.8f))
            {
                return kept.Piece;
            }

            WearNTear worst = null;
            float lowest = 0.8f;
            MendPieces.Clear();
            PieceIndex.InRadius(hearth.transform.position, VillheimConfig.VillageRadius.Value * 0.75f, MendPieces);
            foreach (Piece piece in MendPieces)
            {
                if (piece == null || piece.m_nview == null || !piece.m_nview.IsValid() ||
                    piece.m_nview.GetZDO().GetInt(Keys.BuiltBy) != hearth.VillageId || PlotFinder.OwnFence(piece.gameObject, hearth.VillageId))
                {
                    continue;
                }

                WearNTear wear = piece.GetComponent<WearNTear>();
                float health = wear != null ? wear.GetHealthPercentage() : 1f;
                if (wear != null && health < lowest)
                {
                    lowest = health;
                    worst = wear;
                }
            }

            DamagedCache[hearth.VillageId] = (Time.time, worst);
            return worst;
        }

        private static T Nearest<T>(Vector3 center, float reach) where T : Component
        {
            T best = null;
            float bestDistance = float.MaxValue;
            foreach (Collider collider in Physics.OverlapSphere(center, reach, LayerMask.GetMask("piece", "piece_nonsolid")))
            {
                T found = collider.GetComponentInParent<T>();
                if (found == null)
                {
                    continue;
                }

                float d = Utils.DistanceXZ(found.transform.position, center);
                if (d < bestDistance)
                {
                    best = found;
                    bestDistance = d;
                }
            }

            return best;
        }

        private static CraftingStation Workbench(Vector3 center)
        {
            foreach (Collider collider in Physics.OverlapSphere(center, VillageReach, LayerMask.GetMask("piece", "piece_nonsolid")))
            {
                CraftingStation station = collider.GetComponentInParent<CraftingStation>();
                if (station != null && station.m_name == "$piece_workbench")
                {
                    return station;
                }
            }

            return null;
        }

        private static Character Animal(Vector3 center)
        {
            return Character.GetAllCharacters()
                .Where(c => c != null && !c.IsDead() && c.IsTamed() && !(c is Villager) && !c.IsPlayer() &&
                            Utils.DistanceXZ(c.transform.position, center) < VillageReach + 10f)
                .OrderBy(_ => Random.value).FirstOrDefault();
        }

        /// <summary>Something the village uses lying on the ground in the village, not claimed by another villager.</summary>
        private static ItemDrop Loose(Vector3 center)
        {
            foreach (Collider collider in Physics.OverlapSphere(center, VillageReach, LayerMask.GetMask("item")))
            {
                ItemDrop item = collider.GetComponentInParent<ItemDrop>();
                if (item == null || item.m_itemData == null || !Materials.Tracked.Contains(Utils.GetPrefabName(item.gameObject)) ||
                    Claimed(item))
                {
                    continue;
                }

                return item;
            }

            return null;
        }

        private static bool Claimed(ItemDrop item)
        {
            foreach (Villager other in Character.GetAllCharacters().OfType<Villager>())
            {
                if (States.TryGetValue(other, out State s) && s.Kind == Kind.Carry && s.Item == item)
                {
                    return true;
                }
            }

            return false;
        }
    }
}
