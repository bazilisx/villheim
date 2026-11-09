using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Eating and healing, the way a player does it.
    ///
    /// Villagers eat the game's own foods and heal by the food's own numbers: like a player, every food in effect
    /// heals its regen value every 10 seconds until its time runs out, and a villager has up to three foods in effect.
    ///
    /// A hurt villager (under half health, before any work; any missing health, when he has nothing else to do) goes
    /// down this list and takes the first that is there (Tyler, 2026-11-09):
    /// 1. a healing potion from the village chest or a storage chest,
    /// 2. cooked food from those chests,
    /// 3. raw meat or fish from them, cooked on the hearth's cooking station: the most hurt goes first, and he cooks
    ///    enough for everyone hurt (what he does not eat goes into the chest for the others),
    /// 4. berries, mushrooms and the like that grow near the village, picked and eaten there,
    /// 5. the village wants meat, so its healthiest grown villager goes hunting (Hunting.WantMeat),
    /// 6. last of all, he sits by the fire and roasts scraps, which heal a little.
    ///
    /// In free time, one villager per village cooks the raw food in the chest and puts the cooked food back, so the
    /// village keeps a few meals ready.
    /// </summary>
    internal static class Healing
    {
        private const float StartBelow = 0.5f;
        private const float StopAbove = 0.95f;
        private const float RegenTick = 10f;
        private const int MaxFoods = 3;
        private const int ReadyMeals = 6;
        private const float ScrapsSeconds = 8f;
        private const float RestBetween = 60f;

        private enum Phase
        {
            None,
            ToChest,
            ToStation,
            Cooking,
            Roasting,
            Forage,
        }

        private enum Goal
        {
            Eat,
            Cook,
            Store,
            Potion,
        }

        private sealed class Food
        {
            public string Name;
            public float Regen;
            public float Until;
        }

        private sealed class State
        {
            public Phase Phase;
            public Goal Goal;
            public bool Urgent;
            public float NextAllowed;
            public float NextRegen;
            public float Deadline;
            public float ReadyAt;
            public int Cooking;
            public Container Source;
            public Pickable Bush;
            public float PickedAt;
            public readonly List<string> Raw = new List<string>();
            public readonly List<Food> Foods = new List<Food>();
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();
        private static readonly Dictionary<int, Villager> Cooks = new Dictionary<int, Villager>();

        /// <summary>How many foods are in effect for this villager.</summary>
        public static int FoodCount(Villager villager) =>
            States.TryGetValue(villager, out State state) ? state.Foods.Count(f => f.Until > Time.time) : 0;

        /// <summary>The village chest holds cooked food (true), raw food only (false), or nothing to eat (null).</summary>
        public static bool? ChestFood(VillageHearth hearth)
        {
            Container chest = VillageChest.Find(hearth);
            if (chest == null)
            {
                return null;
            }

            CookingStation station = Station(hearth);
            if (CookedIn(chest, station).Count > 0)
            {
                return true;
            }

            return RawIn(chest, station).Count > 0 ? false : (bool?)null;
        }

        public static bool IsHealing(Villager villager) => States.TryGetValue(villager, out State state) && state.Phase != Phase.None;

        /// <summary>"cooking", "eating" and so on for the hover text, or null.</summary>
        public static string Describe(Villager villager)
        {
            if (!States.TryGetValue(villager, out State state))
            {
                return null;
            }

            switch (state.Phase)
            {
                case Phase.ToChest: return state.Goal == Goal.Potion ? "fetching a healing potion"
                    : state.Goal == Goal.Eat ? "fetching something to eat" : "fetching food to cook";
                case Phase.Forage: return "picking berries to eat";
                case Phase.ToStation: return "taking food to the fire";
                case Phase.Cooking: return state.Goal == Goal.Store ? "cooking for the village" : "cooking a meal";
                case Phase.Roasting: return "roasting scraps by the fire";
                default: return null;
            }
        }

        /// <summary>
        /// Called twice per tick: first before work (<paramref name="idle"/> false: only under half health), then again
        /// when there is no work (<paramref name="idle"/> true: any missing health, or cooking for the village).
        /// Work interrupts an idle meal.
        /// </summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt, bool idle)
        {
            State state = States.GetOrCreateValue(villager);
            if (!idle)
            {
                Regenerate(villager, state);
            }

            // Food already on the fire keeps its cook by it until it comes off, work or not (T-39: meat left on the fire
            // burnt to coal).
            if (state.Phase != Phase.None && !idle && !state.Urgent && state.Phase != Phase.Cooking)
            {
                return false;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid)
            {
                Reset(villager, state);
                return false;
            }

            float health = villager.GetHealth() / Mathf.Max(1f, villager.GetMaxHealth());
            if (state.Phase == Phase.None && !Begin(villager, state, hearth, health, idle))
            {
                return false;
            }

            switch (state.Phase)
            {
                case Phase.ToChest: return UpdateChest(villager, ai, dt, state, hearth);
                case Phase.ToStation: return UpdateStation(villager, ai, dt, state, hearth);
                case Phase.Cooking: return UpdateCooking(villager, ai, dt, state, hearth);
                case Phase.Roasting: return UpdateRoasting(villager, ai, dt, state, hearth);
                case Phase.Forage: return UpdateForage(villager, ai, dt, state, hearth);
            }

            return false;
        }

        private static bool Begin(Villager villager, State state, VillageHearth hearth, float health, bool idle)
        {
            if (Time.time < state.NextAllowed)
            {
                return false;
            }

            state.Foods.RemoveAll(f => f.Until < Time.time);
            bool hurt = health < (idle ? StopAbove : StartBelow);
            bool canEat = state.Foods.Count < MaxFoods && !state.Foods.Any(f => f.Until - Time.time > 600f && !idle && health > 0.3f);
            Container chest = VillageChest.Find(hearth);
            CookingStation station = Station(hearth);

            if (hurt && (state.Foods.Count == 0 || health < StartBelow))
            {
                state.Urgent = !idle;

                // 1. A healing potion, whatever food he has in him.
                Container potions = Chests(hearth).FirstOrDefault(c => Potions(c).Count > 0);
                if (potions != null)
                {
                    state.Source = potions;
                    Start(villager, state, Phase.ToChest, Goal.Potion);
                    Log(villager, health, "a healing potion from a chest");
                    return true;
                }

                if (canEat)
                {
                    // 2. Cooked food from any of the village's chests (the sorting puts it in a storage chest).
                    Container cooked = Chests(hearth).FirstOrDefault(c => CookedIn(c, station).Count > 0);
                    if (cooked != null)
                    {
                        state.Source = cooked;
                        Start(villager, state, Phase.ToChest, Goal.Eat);
                        Log(villager, health, "cooked food from a chest");
                        return true;
                    }

                    // 3. Raw food cooked at the fire, the most hurt first; he cooks for everyone hurt.
                    Container raw = station != null && station.IsFireLit() && station.GetFreeSlot() >= 0
                        ? Chests(hearth).FirstOrDefault(c => RawIn(c, station).Count > 0)
                        : null;
                    if (raw != null && CookFree(villager) && MostHurt(villager))
                    {
                        state.Source = raw;
                        Cooks[villager.VillageId] = villager;
                        Start(villager, state, Phase.ToChest, Goal.Cook);
                        Log(villager, health, "raw food to cook (the most hurt)");
                        return true;
                    }

                    // 4. Something growing nearby that can be eaten as it is.
                    Pickable bush = Foraging.NearestFood(villager.VillageId, hearth.transform.position, villager.transform.position);
                    if (bush != null && !Picking.Contains(bush))
                    {
                        state.Bush = bush;
                        Picking.Add(bush);
                        Start(villager, state, Phase.Forage, Goal.Eat);
                        Log(villager, health, $"berries to pick {Utils.DistanceXZ(bush.transform.position, villager.transform.position):0} m away");
                        return true;
                    }

                    // 5. The village wants meat: the healthiest goes hunting (Hunting picks him).
                    if (raw == null)
                    {
                        Hunting.WantMeat(villager.VillageId, 240f);
                    }

                    // 6. Last of all: rest by the fire with roasted scraps.
                    if (state.Foods.Count == 0)
                    {
                        Start(villager, state, Phase.Roasting, Goal.Eat);
                        Log(villager, health, raw != null ? "rest by the fire while someone else cooks" : "rest by the fire: nothing to eat, a hunter goes out");
                        return true;
                    }
                }
            }

            // Free time: keep a few meals ready in the chest, one cook per village.
            if (idle && !hurt && chest != null && station != null && station.IsFireLit() && station.GetFreeSlot() >= 0 &&
                RawIn(chest, station).Count > 0 && CookedIn(chest, station).Values.Sum() < ReadyMeals && CookFree(villager) &&
                (Roles.TradeOf(villager) == Roles.Trade.Cook || !Roles.HasTrade(villager.VillageId, Roles.Trade.Cook)) &&
                (Roles.BackgroundOf(villager) == Roles.Background.Carer || Random.value < 0.3f))
            {
                Cooks[villager.VillageId] = villager;
                state.Urgent = false;
                Start(villager, state, Phase.ToChest, Goal.Store);
                return true;
            }

            // Nothing cooked at all and raw food waiting: a carer leaves his work and cooks, so the village is never
            // without a meal because everyone is out harvesting (T-109). At most once every two minutes per village.
            if (!idle && !hurt && chest != null && station != null && station.IsFireLit() && station.GetFreeSlot() >= 0 &&
                RawIn(chest, station).Count > 0 && CookedIn(chest, station).Count == 0 && CookFree(villager) &&
                Roles.BackgroundOf(villager) == Roles.Background.Carer && !Childhood.IsChild(villager) &&
                (!NextHungryCook.TryGetValue(villager.VillageId, out float next) || Time.time >= next))
            {
                NextHungryCook[villager.VillageId] = Time.time + 120f;
                Cooks[villager.VillageId] = villager;
                state.Urgent = true;
                Start(villager, state, Phase.ToChest, Goal.Store);
                return true;
            }

            return false;
        }

        private static readonly Dictionary<int, float> NextHungryCook = new Dictionary<int, float>();
        private static readonly HashSet<Pickable> Picking = new HashSet<Pickable>();

        private static void Log(Villager villager, float health, string choice)
        {
            if (LogicConfig.IsOn(LogicConfig.DebugLog))
            {
                VillheimPlugin.Log.LogInfo($"[healing] {villager.VillagerName} at {health * 100f:0}% health: {choice}.");
            }
        }

        /// <summary>The village chest first, then its storage chests (D-016): food and potions may be in any of them.</summary>
        public static List<Container> Chests(VillageHearth hearth)
        {
            var list = new List<Container>();
            Container main = VillageChest.Find(hearth);
            if (main != null)
            {
                list.Add(main);
            }

            if (StorageChests.On)
            {
                list.AddRange(StorageChests.Of(hearth.VillageId).Where(c => c && c != main));
            }

            return list;
        }

        /// <summary>Whether he is the most hurt of the village's hurt who still have room for a food.</summary>
        private static bool MostHurt(Villager villager)
        {
            float mine = villager.GetHealth() / Mathf.Max(1f, villager.GetMaxHealth());
            foreach (Character character in Character.GetAllCharacters())
            {
                if (!(character is Villager other) || other == villager || other.IsDead() || other.VillageId != villager.VillageId ||
                    FoodCount(other) >= MaxFoods)
                {
                    continue;
                }

                float theirs = other.GetHealth() / Mathf.Max(1f, other.GetMaxHealth());
                if (theirs < StopAbove && theirs < mine - 0.02f)
                {
                    return false;
                }
            }

            return true;
        }

        private static int HurtWaiting(Villager villager)
        {
            int count = 0;
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character is Villager other && !other.IsDead() && other.VillageId == villager.VillageId &&
                    other.GetHealth() < other.GetMaxHealth() * StopAbove && FoodCount(other) < MaxFoods)
                {
                    count++;
                }
            }

            return Mathf.Max(1, count);
        }

        /// <summary>How much a potion heals: its status effect's health at once plus over time.</summary>
        private static float PotionHealing(ItemDrop.ItemData.SharedData shared)
        {
            if (shared?.m_consumeStatusEffect is SE_Stats stats)
            {
                return stats.m_healthUpFront + stats.m_healthOverTime;
            }

            return 0f;
        }

        /// <summary>Healing potions in a chest (by prefab name, with counts).</summary>
        private static Dictionary<string, int> Potions(Container chest)
        {
            var result = new Dictionary<string, int>();
            if (!VillageChest.Usable(chest))
            {
                return result;
            }

            foreach (ItemDrop.ItemData item in chest.GetInventory().GetAllItems())
            {
                string name = item.m_dropPrefab != null ? item.m_dropPrefab.name : null;
                if (name != null && item.m_shared.m_itemType == ItemDrop.ItemData.ItemType.Consumable && item.m_shared.m_food <= 0f &&
                    PotionHealing(item.m_shared) > 0f)
                {
                    result.TryGetValue(name, out int count);
                    result[name] = count + item.m_stack;
                }
            }

            return result;
        }

        /// <summary>
        /// 'vh act near cookmeat': the villager runs the real cooking now: raw food from the chest, onto the station,
        /// off when it is done, into the chest. Says what stops it when it can't.
        /// </summary>
        public static string ForceCook(Villager villager)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            Container chest = hearth != null && hearth.IsValid ? VillageChest.Find(hearth) : null;
            CookingStation station = hearth != null && hearth.IsValid ? Station(hearth) : null;
            string why = chest == null ? "the village has no chest"
                : station == null ? "the village has no cooking station"
                : !station.IsFireLit() ? "the cooking station has no fire under it"
                : station.GetFreeSlot() < 0 ? "the cooking station is full"
                : RawIn(chest, station).Count == 0 ? "there is no raw food in the chest that the station can cook"
                : null;
            if (why != null)
            {
                return $"Villheim: {villager.VillagerName} can't cook: {why}.";
            }

            State state = States.GetOrCreateValue(villager);
            Reset(villager, state);
            Cooks[villager.VillageId] = villager;
            state.Urgent = true;
            state.NextAllowed = 0f;
            Start(villager, state, Phase.ToChest, Goal.Store);
            return $"Villheim: {villager.VillagerName} goes to cook what is raw in the chest.";
        }

        private static void Start(Villager villager, State state, Phase phase, Goal goal)
        {
            state.Phase = phase;
            state.Goal = goal;
            state.Deadline = Time.time + 60f;
            state.ReadyAt = 0f;
            state.Raw.Clear();
            state.Cooking = 0;
            state.PickedAt = 0f;
            Walker.For(villager).Reset();
            VillheimPlugin.Debug($"{villager.VillagerName}: {Describe(villager)}.");
        }

        private static bool CookFree(Villager villager)
        {
            return !Cooks.TryGetValue(villager.VillageId, out Villager cook) || cook == null || cook == villager || cook.IsDead() ||
                   !States.TryGetValue(cook, out State theirs) || theirs.Phase == Phase.None;
        }

        private static void Reset(Villager villager, State state)
        {
            state.Phase = Phase.None;
            state.Raw.Clear();
            if (state.Bush != null)
            {
                Picking.Remove(state.Bush);
                state.Bush = null;
            }

            Picking.RemoveWhere(p => p == null);
            if (Cooks.TryGetValue(villager.VillageId, out Villager cook) && cook == villager)
            {
                Cooks.Remove(villager.VillageId);
            }
        }

        private static void Done(Villager villager, State state, float rest)
        {
            Reset(villager, state);
            state.NextAllowed = Time.time + rest;
        }

        // ---------------------------------------------------------------- phases

        private static bool UpdateChest(Villager villager, VillagerAI ai, float dt, State state, VillageHearth hearth)
        {
            Container chest = state.Source ? state.Source : VillageChest.Find(hearth);
            if (chest == null || Time.time > state.Deadline)
            {
                Done(villager, state, 20f);
                return false;
            }

            // Close enough to reach in counts as there: with the others crowding the chest, the path never "arrived"
            // and he stood beside it until the minute ran out, over and over (Tyler: stuck by the fire).
            Vector3 at = chest.transform.position;
            if (Utils.DistanceXZ(villager.transform.position, at) > 2.5f &&
                Walker.For(villager).Go(villager, ai, dt, at, 1.4f) == WalkResult.Walking)
            {
                return true;
            }

            ai.StopMoving();
            FaceTo(villager, ai, at);
            Poses.Trigger(villager, "interact");
            Inventory inventory = chest.GetInventory();
            CookingStation station = Station(hearth);

            if (state.Goal == Goal.Potion)
            {
                string potion = Potions(chest).Keys.OrderByDescending(n => PotionHealing(Shared(n))).FirstOrDefault();
                if (potion == null)
                {
                    Done(villager, state, 2f);
                    return false;
                }

                inventory.RemoveItem(Shared(potion).m_name, 1);
                float amount = PotionHealing(Shared(potion));
                villager.Heal(amount, true);
                Poses.Trigger(villager, "eat");
                VillheimPlugin.Debug($"{villager.VillagerName} drank {potion} ({amount:0} health).");
                Done(villager, state, 20f);
                return false;
            }

            if (state.Goal == Goal.Eat)
            {
                Dictionary<string, int> cooked = CookedIn(chest, station);
                string best = cooked.Keys.OrderByDescending(Regen).FirstOrDefault();
                if (best == null)
                {
                    Done(villager, state, 5f);
                    return false;
                }

                inventory.RemoveItem(Shared(best).m_name, 1);
                Eat(villager, state, best);
                Done(villager, state, RestBetween);
                return false;
            }

            // Take raw food for the free slots on the station: one to eat, as many as fit to store.
            int slots = station != null ? FreeSlots(station) : 0;
            int take = state.Goal == Goal.Cook ? Mathf.Clamp(HurtWaiting(villager), 1, Mathf.Max(1, slots)) : Mathf.Min(slots, ReadyMeals);
            foreach (KeyValuePair<string, int> raw in RawIn(chest, station))
            {
                int count = Mathf.Min(raw.Value, take - state.Raw.Count);
                for (int i = 0; i < count; i++)
                {
                    state.Raw.Add(raw.Key);
                }

                inventory.RemoveItem(Shared(raw.Key).m_name, count);
                if (state.Raw.Count >= take)
                {
                    break;
                }
            }

            if (state.Raw.Count == 0)
            {
                Done(villager, state, 10f);
                return false;
            }

            state.Phase = Phase.ToStation;
            state.Deadline = Time.time + 45f;
            Walker.For(villager).Reset();
            return true;
        }

        private static bool UpdateStation(Villager villager, VillagerAI ai, float dt, State state, VillageHearth hearth)
        {
            CookingStation station = Station(hearth);
            if (station == null || Time.time > state.Deadline)
            {
                ReturnRaw(hearth, state);
                Done(villager, state, 20f);
                return false;
            }

            Vector3 spot = StandSpot(villager, station, hearth);
            if (Walker.For(villager).Go(villager, ai, dt, spot, 0.6f) == WalkResult.Walking)
            {
                return true;
            }

            ai.StopMoving();
            FaceTo(villager, ai, station.transform.position);
            Poses.Trigger(villager, "interact");

            float longest = 0f;
            foreach (string raw in state.Raw.ToList())
            {
                GameObject prefab = ObjectDB.instance.GetItemPrefab(raw);
                ItemDrop.ItemData item = prefab != null ? villager.PickupPrefab(prefab, 1, false) : null;
                if (item == null || !station.CookItem(villager, item))
                {
                    if (item != null)
                    {
                        villager.GetInventory().RemoveItem(item);
                    }

                    continue;
                }

                state.Raw.Remove(raw);
                state.Cooking++;
                CookingStation.ItemConversion conversion = station.GetItemConversion(raw);
                longest = Mathf.Max(longest, conversion != null ? conversion.m_cookTime : 25f);
            }

            ReturnRaw(hearth, state);
            if (state.Cooking == 0)
            {
                VillheimPlugin.Debug($"{villager.VillagerName} could not put food on the cooking station (fire out or full).");
                Start(villager, state, Phase.Roasting, Goal.Eat);
                return true;
            }

            state.Phase = Phase.Cooking;
            state.ReadyAt = Time.time + longest + 0.5f;
            state.Deadline = state.ReadyAt + 30f;
            VillheimPlugin.Debug($"{villager.VillagerName} put {state.Cooking} on the fire; ready in {longest:0} s.");
            return true;
        }

        /// <summary>
        /// The village's cooking station, when nobody is cooking at it: what is done goes into the chest, what burnt is
        /// taken off (its coal into the chest), so nothing is left to char on the fire. From the hearth's tick.
        /// </summary>
        public static void ClearStation(VillageHearth hearth)
        {
            if (Cooks.TryGetValue(hearth.VillageId, out Villager cook) && cook != null && !cook.IsDead() &&
                States.TryGetValue(cook, out State cooking) && (cooking.Phase == Phase.Cooking || cooking.Phase == Phase.ToStation))
            {
                return;
            }

            CookingStation station = Station(hearth);
            Container chest = VillageChest.Find(hearth);
            if (station == null || chest == null || !VillageChest.Usable(chest))
            {
                return;
            }

            for (int slot = 0; slot < station.m_slots.Length; slot++)
            {
                station.GetSlot(slot, out string name, out float _, out CookingStation.Status status, out bool _);
                if (status == CookingStation.Status.NotDone || string.IsNullOrEmpty(name))
                {
                    continue;
                }

                GameObject prefab = ObjectDB.instance ? ObjectDB.instance.GetItemPrefab(name) : null;
                if (!station.m_nview.IsOwner())
                {
                    station.m_nview.ClaimOwnership();
                }

                station.SetSlot(slot, "", 0f, CookingStation.Status.NotDone, false);
                if (prefab != null)
                {
                    VillageChest.Claim(chest);
                    chest.GetInventory().AddItem(prefab, 1);
                }

                VillheimPlugin.Debug($"{hearth.VillageName}: {name} taken off the fire into the chest.");
            }
        }

        /// <summary>Waits the food's own cooking time by the fire, then takes it off before it burns.</summary>
        private static bool UpdateCooking(Villager villager, VillagerAI ai, float dt, State state, VillageHearth hearth)
        {
            CookingStation station = Station(hearth);
            if (station == null || Time.time > state.Deadline + 60f)
            {
                Done(villager, state, 20f);
                return false;
            }

            ai.StopMoving();
            FaceTo(villager, ai, station.transform.position);
            if (Time.time < state.ReadyAt)
            {
                Poses.Hold(villager, Poses.Sit);
                return true;
            }

            var taken = new List<string>();
            for (int slot = 0; slot < station.m_slots.Length && taken.Count < state.Cooking; slot++)
            {
                station.GetSlot(slot, out string name, out float _, out CookingStation.Status status, out bool _);
                if (status != CookingStation.Status.Done || string.IsNullOrEmpty(name))
                {
                    continue;
                }

                if (!station.m_nview.IsOwner())
                {
                    station.m_nview.ClaimOwnership();
                }

                station.SetSlot(slot, "", 0f, CookingStation.Status.NotDone, false);
                taken.Add(name);
            }

            if (taken.Count == 0)
            {
                // Not quite done yet (the fire went low, or the station runs on another client): wait a bit more.
                Poses.Hold(villager, Poses.Sit);
                return true;
            }

            Poses.Trigger(villager, "interact");
            Container chest = VillageChest.Find(hearth);
            float health = villager.GetHealth() / Mathf.Max(1f, villager.GetMaxHealth());
            foreach (string cooked in taken)
            {
                bool hungry = state.Goal != Goal.Store || (health < StopAbove && state.Foods.Count == 0);
                if (hungry && state.Foods.Count < MaxFoods && !state.Foods.Any(f => f.Name == cooked))
                {
                    Eat(villager, state, cooked);
                    health = 1f;
                    continue;
                }

                // Not needed now: into the village chest for later.
                if (chest == null || !chest.GetInventory().AddItem(ObjectDB.instance.GetItemPrefab(cooked), 1))
                {
                    Eat(villager, state, cooked);
                }
            }

            state.Cooking -= taken.Count;
            if (state.Cooking > 0)
            {
                return true;
            }

            VillheimPlugin.Debug($"{villager.VillagerName} took {string.Join(", ", taken)} off the fire.");
            Done(villager, state, state.Goal == Goal.Store ? 30f : RestBetween);
            return false;
        }

        /// <summary>Picks a bush or patch near the village and eats what it gives (what he cannot eat is left for the chest).</summary>
        private static bool UpdateForage(Villager villager, VillagerAI ai, float dt, State state, VillageHearth hearth)
        {
            Pickable bush = state.Bush;
            if (bush == null || Time.time > state.Deadline || (state.PickedAt <= 0f && bush.GetPicked()))
            {
                Done(villager, state, 3f);
                return false;
            }

            Vector3 at = bush.transform.position;
            if (state.PickedAt <= 0f)
            {
                if (Walker.For(villager).Go(villager, ai, dt, at, 1.3f) == WalkResult.Walking)
                {
                    return true;
                }

                ai.StopMoving();
                FaceTo(villager, ai, at);
                Poses.Trigger(villager, "interact");
                bush.Interact(villager, false, false);
                state.PickedAt = Time.time;
                return true;
            }

            if (Time.time - state.PickedAt < 0.6f)
            {
                return true;
            }

            int eaten = 0;
            foreach (Collider collider in Physics.OverlapSphere(at, 2.5f))
            {
                ItemDrop item = collider.GetComponentInParent<ItemDrop>();
                if (item == null || item.m_nview == null || !item.m_nview.IsValid() || item.m_itemData?.m_shared == null ||
                    item.m_itemData.m_shared.m_food <= 0f || state.Foods.Count >= MaxFoods)
                {
                    continue;
                }

                string name = Utils.GetPrefabName(item.gameObject);
                if (state.Foods.Any(f => f.Name == name && f.Until > Time.time))
                {
                    continue;
                }

                Eat(villager, state, name);
                eaten++;
                item.m_nview.ClaimOwnership();
                if (item.m_itemData.m_stack > 1)
                {
                    item.m_itemData.m_stack--;
                    item.Save();
                }
                else
                {
                    ZNetScene.instance.Destroy(item.gameObject);
                }
            }

            VillheimPlugin.Debug($"{villager.VillagerName} ate {eaten} picked from {Utils.GetPrefabName(bush.gameObject)}.");
            Done(villager, state, eaten > 0 ? RestBetween : 5f);
            return false;
        }

        /// <summary>No food anywhere: sits by the fire for a few seconds and roasts scraps, which heal a little.</summary>
        private static bool UpdateRoasting(Villager villager, VillagerAI ai, float dt, State state, VillageHearth hearth)
        {
            Vector3 fire = hearth.transform.position;
            if (state.ReadyAt <= 0f)
            {
                Vector3 side = villager.transform.position - fire;
                side.y = 0f;
                Vector3 spot = fire + (side.sqrMagnitude > 0.01f ? side.normalized : Vector3.forward) * 2.2f;
                if (Walker.For(villager).Go(villager, ai, dt, spot, 0.8f) == WalkResult.Walking && Time.time < state.Deadline)
                {
                    return true;
                }

                state.ReadyAt = Time.time + ScrapsSeconds;
            }

            ai.StopMoving();
            FaceTo(villager, ai, fire + Vector3.up * 0.5f);
            Poses.Hold(villager, Poses.Sit);
            if (Time.time < state.ReadyAt)
            {
                return true;
            }

            // Scraps: a weak food that heals 2% of his health every 10 seconds for five minutes.
            state.Foods.Add(new Food { Name = "scraps", Regen = villager.GetMaxHealth() * 0.02f, Until = Time.time + 300f });
            Poses.Trigger(villager, "eat");
            Moods.Think(villager, "atescraps");
            VillheimPlugin.Debug($"{villager.VillagerName} ate roasted scraps.");
            Done(villager, state, RestBetween);
            return false;
        }

        // ---------------------------------------------------------------- food

        /// <summary>Starts a food's effect: heals its regen every 10 seconds for its whole duration.</summary>
        private static void Eat(Villager villager, State state, string prefabName)
        {
            ItemDrop.ItemData.SharedData shared = Shared(prefabName);
            if (shared == null)
            {
                return;
            }

            float scale = LogicConfig.FoodHealing != null ? LogicConfig.FoodHealing.Value : 1f;
            state.Foods.RemoveAll(f => f.Name == prefabName || f.Until < Time.time);
            if (state.Foods.Count >= MaxFoods)
            {
                state.Foods.RemoveAt(0);
            }

            state.Foods.Add(new Food
            {
                Name = prefabName,
                Regen = Mathf.Max(1f, shared.m_foodRegen) * scale,
                Until = Time.time + Mathf.Max(60f, shared.m_foodBurnTime),
            });

            Poses.Trigger(villager, "eat");
            Moods.Think(villager, "atewell");
            Expectations.Ate(villager, prefabName);
            VillheimPlugin.Debug($"{villager.VillagerName} ate {prefabName}: {shared.m_foodRegen * scale:0.#} health every 10 s " +
                                 $"for {shared.m_foodBurnTime / 60f:0} min.");
        }

        /// <summary>Every 10 seconds, each food in effect heals its regen value, like the player's food.</summary>
        private static void Regenerate(Villager villager, State state)
        {
            if (Time.time < state.NextRegen)
            {
                return;
            }

            state.NextRegen = Time.time + RegenTick;
            state.Foods.RemoveAll(f => f.Until < Time.time);
            float heal = state.Foods.Sum(f => f.Regen);
            if (heal > 0f && villager.GetHealth() < villager.GetMaxHealth())
            {
                villager.Heal(heal, true);
            }
        }

        private static ItemDrop.ItemData.SharedData Shared(string prefabName)
        {
            return ObjectDB.instance?.GetItemPrefab(prefabName)?.GetComponent<ItemDrop>()?.m_itemData?.m_shared;
        }

        private static float Regen(string prefabName) => Shared(prefabName)?.m_foodRegen ?? 0f;

        /// <summary>Food in the chest that can be eaten as it is (by prefab name, with counts).</summary>
        private static Dictionary<string, int> CookedIn(Container chest, CookingStation station)
        {
            var result = new Dictionary<string, int>();
            if (!VillageChest.Usable(chest))
            {
                return result;
            }

            foreach (ItemDrop.ItemData item in chest.GetInventory().GetAllItems())
            {
                string name = item.m_dropPrefab != null ? item.m_dropPrefab.name : null;
                if (name == null || item.m_shared.m_food <= 0f || item.m_shared.m_foodBurnTime <= 0f ||
                    (station != null && station.IsItemAllowed(name)))
                {
                    continue;
                }

                result.TryGetValue(name, out int count);
                result[name] = count + item.m_stack;
            }

            return result;
        }

        /// <summary>Raw food in the chest that the cooking station can cook.</summary>
        private static Dictionary<string, int> RawIn(Container chest, CookingStation station)
        {
            var result = new Dictionary<string, int>();
            if (station == null || !VillageChest.Usable(chest))
            {
                return result;
            }

            foreach (ItemDrop.ItemData item in chest.GetInventory().GetAllItems())
            {
                string name = item.m_dropPrefab != null ? item.m_dropPrefab.name : null;
                if (name != null && station.IsItemAllowed(name))
                {
                    result.TryGetValue(name, out int count);
                    result[name] = count + item.m_stack;
                }
            }

            return result;
        }

        private static void ReturnRaw(VillageHearth hearth, State state)
        {
            Container chest = VillageChest.Find(hearth);
            foreach (string raw in state.Raw)
            {
                GameObject prefab = ObjectDB.instance.GetItemPrefab(raw);
                if (chest != null && prefab != null)
                {
                    chest.GetInventory().AddItem(prefab, 1);
                }
            }

            state.Raw.Clear();
        }

        private static int FreeSlots(CookingStation station)
        {
            int free = 0;
            for (int slot = 0; slot < station.m_slots.Length; slot++)
            {
                station.GetSlot(slot, out string name, out float _, out CookingStation.Status _, out bool _);
                if (string.IsNullOrEmpty(name))
                {
                    free++;
                }
            }

            return free;
        }

        /// <summary>The village's cooking station over the hearth (or the nearest one made by the village).</summary>
        public static CookingStation Station(VillageHearth hearth)
        {
            CookingStation best = null;
            float bestDistance = float.MaxValue;
            foreach (Collider collider in Physics.OverlapSphere(hearth.transform.position, 8f, LayerMask.GetMask("piece", "piece_nonsolid")))
            {
                CookingStation station = collider.GetComponentInParent<CookingStation>();
                if (station == null || station.m_nview == null || !station.m_nview.IsValid())
                {
                    continue;
                }

                float distance = Vector3.Distance(station.transform.position, hearth.transform.position);
                if (distance < bestDistance)
                {
                    best = station;
                    bestDistance = distance;
                }
            }

            return best;
        }

        /// <summary>Beside the cooking station, on the villager's side of the fire and out of the flames.</summary>
        private static Vector3 StandSpot(Villager villager, CookingStation station, VillageHearth hearth)
        {
            Vector3 side = villager.transform.position - hearth.transform.position;
            side.y = 0f;
            Vector3 spot = hearth.transform.position + (side.sqrMagnitude > 0.01f ? side.normalized : Vector3.forward) * 1.8f;
            if (ZoneSystem.instance.GetGroundHeight(spot, out float y))
            {
                spot.y = y;
            }

            return spot;
        }

        private static void FaceTo(Villager villager, VillagerAI ai, Vector3 point)
        {
            ai.LookAt(point);
            Vector3 direction = point - villager.transform.position;
            direction.y = 0f;
            if (direction.sqrMagnitude > 0.01f)
            {
                // The game turns the body toward the look direction itself; turning it here as well fought that.
                villager.SetLookDir(direction.normalized);
            }
        }
    }
}
