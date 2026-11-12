using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Trophies (T-46). Whoever brings down an animal or a creature picks up its trophy and keeps it himself: a hunter
    /// at the kill, a fighter once the fight is over (he walks back to where it fell and waits a few seconds for the
    /// drops). Other drops are left for the village.
    ///
    /// A villager with a trophy and a home of his own hangs it there when he has nothing else to do: he takes what a
    /// wall item stand costs from the village's chests, walks home, hammers the stand up on a wall inside, and the
    /// trophy goes on it. At most TrophiesPerHome stands in one home; a trophy with no room stays in his pack.
    /// </summary>
    internal static class Trophies
    {
        private const string StandPrefab = "itemstand";
        private static readonly int KeyStandOf = "villheim_trophy_stand".GetStableHashCode();

        private enum Phase
        {
            None,
            Fetch,
            Mount,
        }

        private sealed class State
        {
            public Phase Phase;
            public Vector3 KillSpot;
            public float KillAt = -100f;
            public float WaitUntil;
            public Vector3 Spot;
            public Quaternion Facing;
            public float Deadline;
            public float WorkUntil;
            public float NextSwing;
            public float NextTry;
            public float LastRun;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        private static int PerHome => Mathf.Max(0, LogicConfig.TrophiesPerHome?.Value ?? 2);

        public static string Describe(Villager villager) =>
            States.TryGetValue(villager, out State state) && Time.time - state.LastRun < 1f
                ? state.Phase == Phase.Fetch ? "picking up a trophy" : state.Phase == Phase.Mount ? "hanging a trophy at home" : null
                : null;

        /// <summary>True while he is at the stand, hammering the trophy up (the only part of it that uses a tool).</summary>
        public static bool Hammering(Villager villager) =>
            States.TryGetValue(villager, out State state) && Time.time - state.LastRun < 1f && state.Phase == Phase.Mount && state.WorkUntil > 0f;

        private static bool IsTrophy(ItemDrop.ItemData item) => item?.m_shared != null && item.m_shared.m_itemType == ItemDrop.ItemData.ItemType.Trophy;

        /// <summary>From the hunt: a trophy among the drops goes into the hunter's own pack. True when it was taken.</summary>
        public static bool Keep(Villager villager, ItemDrop item)
        {
            if (item == null || !IsTrophy(item.m_itemData) || ObjectDB.instance == null)
            {
                return false;
            }

            GameObject prefab = ObjectDB.instance.GetItemPrefab(Utils.GetPrefabName(item.gameObject));
            if (prefab == null || villager.PickupPrefab(prefab, 1, false) == null)
            {
                return false;
            }

            item.m_nview.ClaimOwnership();
            ZNetScene.instance.Destroy(item.gameObject);
            VillheimPlugin.Debug($"{villager.VillagerName} keeps the {prefab.name}.");
            return true;
        }

        /// <summary>From Combat: the creature he was fighting fell here; he goes for its trophy once the fight is over.</summary>
        public static void NoteKill(Villager villager, Vector3 spot)
        {
            State state = States.GetOrCreateValue(villager);
            state.KillSpot = spot;
            state.KillAt = Time.time;
        }

        /// <summary>True while he fetches a trophy or hangs one at home.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            if (Childhood.IsChild(villager))
            {
                return false;
            }

            State state = States.GetOrCreateValue(villager);
            if (state.Phase != Phase.None && Time.time - state.LastRun > 5f)
            {
                state.Phase = Phase.None;
            }

            state.LastRun = Time.time;
            if (state.Phase == Phase.None)
            {
                if (Time.time - state.KillAt < 60f)
                {
                    state.Phase = Phase.Fetch;
                    state.KillAt = -100f;
                    state.WaitUntil = 0f;
                    state.Deadline = Time.time + 40f;
                    Walker.For(villager).Reset();
                }
                else if (Time.time >= state.NextTry && Carried(villager) != null && !EnvMan.IsNight())
                {
                    state.NextTry = Time.time + 120f;
                    if (!BeginMount(villager, state))
                    {
                        return false;
                    }
                }
                else
                {
                    return false;
                }
            }

            return state.Phase == Phase.Fetch ? Fetch(villager, ai, dt, state) : Mount(villager, ai, dt, state);
        }

        private static ItemDrop.ItemData Carried(Villager villager) => villager.GetInventory()?.GetAllItems().FirstOrDefault(IsTrophy);

        // ---------------------------------------------------------------- fetching

        private static bool Fetch(Villager villager, VillagerAI ai, float dt, State state)
        {
            if (Walker.For(villager).Go(villager, ai, dt, state.KillSpot, 1.2f, true) == WalkResult.Walking && Time.time < state.Deadline)
            {
                return true;
            }

            ai.StopMoving();
            if (state.WaitUntil <= 0f)
            {
                // Many creatures drop what they carry only as the body fades.
                state.WaitUntil = Time.time + 8f;
            }

            ItemDrop trophy = Physics.OverlapSphere(state.KillSpot, 4f).Select(c => c.GetComponentInParent<ItemDrop>())
                .FirstOrDefault(i => i != null && i.m_nview != null && i.m_nview.IsValid() && IsTrophy(i.m_itemData));
            if (trophy != null)
            {
                Poses.Trigger(villager, "interact");
                Keep(villager, trophy);
                state.Phase = Phase.None;
                return false;
            }

            if (Time.time > state.WaitUntil)
            {
                state.Phase = Phase.None;
                return false;
            }

            return true;
        }

        // ---------------------------------------------------------------- hanging it up

        private static bool BeginMount(Villager villager, State state)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid || villager.Zdo == null || PerHome == 0)
            {
                return false;
            }

            var village = new VillageState(hearth.Zdo);
            Vector3 home = villager.Zdo.GetVec3(Keys.VillagerHome, Vector3.zero);
            Plot plot = village.Plots.FirstOrDefault(p => Utils.DistanceXZ(p.Position, home) < 1f && p.Role != "Farm" && p.Role != "Hub");
            if (plot == null)
            {
                return false;
            }

            GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(StandPrefab) : null;
            Piece piece = prefab != null ? prefab.GetComponent<Piece>() : null;
            if (piece == null || StandsIn(plot, hearth.VillageId) >= PerHome || !Affordable(hearth, piece))
            {
                return false;
            }

            if (!WallSpot(plot, out state.Spot, out state.Facing))
            {
                return false;
            }

            state.Phase = Phase.Mount;
            state.WorkUntil = 0f;
            state.Deadline = Time.time + 60f;
            Walker.For(villager).Reset();
            return true;
        }

        private static int StandsIn(Plot plot, int villageId) =>
            Object.FindObjectsOfType<ItemStand>().Count(s => s != null && s.m_nview != null && s.m_nview.IsValid() &&
                                                             s.m_nview.GetZDO().GetInt(KeyStandOf) == villageId &&
                                                             Utils.DistanceXZ(s.transform.position, plot.Position) < plot.Radius);

        private static Dictionary<string, int> Cost(Piece piece) =>
            piece.m_resources.Where(r => r?.m_resItem != null && r.m_amount > 0)
                .GroupBy(r => r.m_resItem.gameObject.name).ToDictionary(g => g.Key, g => g.Sum(r => r.m_amount));

        private static bool Affordable(VillageHearth hearth, Piece piece)
        {
            Container chest = VillageChest.Find(hearth);
            return chest != null && Cost(piece).All(c => VillageChest.Count(chest, c.Key) >= c.Value);
        }

        /// <summary>A wall inside the home, at head height, facing into the room.</summary>
        private static bool WallSpot(Plot plot, out Vector3 spot, out Quaternion facing)
        {
            spot = Vector3.zero;
            facing = Quaternion.identity;
            Vector3 from = plot.Position + Vector3.up * 1.6f;
            if (ZoneSystem.instance != null && ZoneSystem.instance.GetGroundHeight(plot.Position, out float ground))
            {
                from.y = ground + 1.6f;
            }

            int mask = LayerMask.GetMask("piece");
            float best = float.MaxValue;
            bool found = false;
            for (int i = 0; i < 12; i++)
            {
                float angle = i * Mathf.PI / 6f + Random.Range(-0.1f, 0.1f);
                Vector3 dir = new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle));
                if (Physics.Raycast(from, dir, out RaycastHit hit, Mathf.Max(3f, plot.Radius), mask) &&
                    Mathf.Abs(hit.normal.y) < 0.3f && hit.distance > 1f && hit.distance < best &&
                    !Physics.CheckSphere(hit.point + hit.normal * 0.4f, 0.25f, mask))
                {
                    best = hit.distance;
                    spot = hit.point + hit.normal * 0.05f;
                    facing = Quaternion.LookRotation(hit.normal.Horizontal().normalized);
                    found = true;
                }
            }

            return found;
        }

        private static bool Mount(Villager villager, VillagerAI ai, float dt, State state)
        {
            ItemDrop.ItemData trophy = Carried(villager);
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (trophy == null || hearth == null || !hearth.IsValid)
            {
                state.Phase = Phase.None;
                return false;
            }

            Vector3 stand = state.Spot + state.Facing * Vector3.forward * 1.2f;
            if (state.WorkUntil <= 0f)
            {
                WalkResult step = Walker.For(villager).Go(villager, ai, dt, stand, 0.6f);
                if (step == WalkResult.Walking && Time.time < state.Deadline)
                {
                    return true;
                }

                if (Utils.DistanceXZ(villager.transform.position, state.Spot) > 3f)
                {
                    state.Phase = Phase.None;
                    return false;
                }

                state.WorkUntil = Time.time + Mathf.Max(1f, LogicConfig.SecondsPerPiece?.Value ?? 2.5f) + 1f;
            }

            ai.StopMoving();
            ai.LookAt(state.Spot);
            VillagerLooks.Hold(villager, VillagerLooks.Tool.Hammer);
            if (Time.time >= state.NextSwing)
            {
                state.NextSwing = Time.time + 1.2f;
                Chores.ToolAnimation(villager, VillagerLooks.Tool.Hammer);
            }

            if (Time.time < state.WorkUntil)
            {
                return true;
            }

            Hang(villager, hearth, trophy, state);
            state.Phase = Phase.None;
            return false;
        }

        /// <summary>The stand goes up (paid from the chests) and the trophy goes on it.</summary>
        private static void Hang(Villager villager, VillageHearth hearth, ItemDrop.ItemData trophy, State state)
        {
            GameObject prefab = ZNetScene.instance.GetPrefab(StandPrefab);
            Piece piece = prefab != null ? prefab.GetComponent<Piece>() : null;
            Container chest = VillageChest.Find(hearth);
            if (piece == null || chest == null || !Affordable(hearth, piece) || trophy.m_dropPrefab == null)
            {
                return;
            }

            VillageChest.Take(chest, Cost(piece));
            GameObject made = Object.Instantiate(prefab, state.Spot, state.Facing);
            piece.m_placeEffect?.Create(state.Spot, state.Facing, made.transform);
            ZNetView view = made.GetComponent<ZNetView>();
            ItemStand itemStand = made.GetComponentInChildren<ItemStand>();
            if (view == null || !view.IsValid() || itemStand == null)
            {
                return;
            }

            ZDO zdo = view.GetZDO();
            zdo.Set(Keys.BuiltBy, hearth.VillageId);
            zdo.Set(KeyStandOf, hearth.VillageId);
            Designs.StandItems.SetItem(zdo, trophy.m_dropPrefab.name, trophy.m_variant, trophy.m_quality);
            itemStand.UpdateVisual();
            villager.GetInventory().RemoveItem(trophy, 1);
            Chronicle.Add(hearth, $"{villager.VillagerName} hung a {Localization.instance.Localize(trophy.m_shared.m_name)} at home.");
            VillheimPlugin.Debug($"{villager.VillagerName} hung the {trophy.m_dropPrefab.name} at home.");
        }
    }
}
