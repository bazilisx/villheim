using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using HarmonyLib;
using UnityEngine;
using Villheim.Logic.Village;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// People who belong to no village: pedlars, pilgrims and hermits. They use the villager prefab and look, with a
    /// village id of 0, so no village counts them, gives them beds or sends them to work.
    ///
    /// - A pedlar walks in from the edge of a village, trades with its chest (what the village is short of, paid for
    ///   from what it can spare), brings news from other villages, stays about a third of a day by the hearth and
    ///   walks off again. Players can trade with him (Shift + Use).
    /// - A pilgrim comes at dusk, sits by the hearth through the night, blesses the place at dawn (a lift to everyone's
    ///   mood) and moves on. Pilgrims talk about far places.
    /// - A hermit lives at a small camp of his own by a ruin or an abandoned house, far from any village. He keeps his
    ///   fire going, potters about by day and sits by it at night. Talk to him and he may tell you of a place worth
    ///   finding (it goes on your map). He also has a few odd things to trade.
    ///
    /// Everything they need survives a reload in their ZDO. A wanderer who is done (or has been about for days with
    /// nobody near) is removed when no player is close enough to see it go.
    /// </summary>
    internal static class Wanderers
    {
        public const string Pedlar = "pedlar";
        public const string Pilgrim = "pilgrim";
        public const string Hermit = "hermit";
        public const string Camper = "camper";
        /// <summary>Someone walking a caravan's road between two places (Village/Caravans.cs runs them).</summary>
        public const string Carrier = "carrier";
        public static readonly int KeyCampKind = "villheim_wcampkind".GetStableHashCode();

        public static readonly int KeyKind = "villheim_wanderer".GetStableHashCode();
        public static readonly int KeyPhase = "villheim_wphase".GetStableHashCode();
        public static readonly int KeyTarget = "villheim_wtarget".GetStableHashCode();
        public static readonly int KeyFrom = "villheim_wfrom".GetStableHashCode();
        public static readonly int KeyUntil = "villheim_wuntil".GetStableHashCode();
        public static readonly int KeyBorn = "villheim_wborn".GetStableHashCode();
        public static readonly int KeyVisit = "villheim_wvisit".GetStableHashCode();
        public static readonly int KeyAway = "villheim_waway".GetStableHashCode();
        public static readonly int KeyTold = "villheim_wtold".GetStableHashCode();

        private const string Arrive = "arrive";
        private const string Stay = "stay";
        private const string Leave = "leave";
        private const string WaresObject = "VillheimWares";
        private const float SeenFrom = 70f;

        private sealed class State
        {
            public Vector3 Spot;
            public float NextSpot;
            public float NextSelf;
            public float WalkingSince = -1f;
            public float NextFuel;
            public bool Greeted;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        public static string KindOf(Villager villager)
        {
            ZDO zdo = villager != null ? villager.Zdo : null;
            string kind = zdo != null ? zdo.GetString(KeyKind, "") : "";
            return kind.Length > 0 ? kind : null;
        }

        public static bool IsWanderer(Villager villager) => KindOf(villager) != null;

        private static double Now => ZNet.instance != null ? ZNet.instance.GetTimeSeconds() : Time.time;

        private static float Hour => EnvMan.instance != null ? EnvMan.instance.GetDayFraction() * 24f : 12f;

        // ---------------------------------------------------------------- spawning

        /// <summary>Makes a wanderer at <paramref name="spawn"/> who heads for <paramref name="target"/>.</summary>
        public static Villager Spawn(string kind, Vector3 spawn, Vector3 target, string from, int visitVillage)
        {
            if (Villheim.Prefabs.VillagerPrefab.Prefab == null)
            {
                return null;
            }

            if (ZoneSystem.instance.GetGroundHeight(spawn, out float y))
            {
                spawn.y = y + 0.2f;
            }

            Vector3 facing = (target - spawn).Horizontal();
            GameObject go = Object.Instantiate(Villheim.Prefabs.VillagerPrefab.Prefab, spawn,
                facing.sqrMagnitude > 0.01f ? Quaternion.LookRotation(facing) : Quaternion.identity);
            Villager villager = go.GetComponent<Villager>();
            int seed = Random.Range(1, int.MaxValue);
            // A wanderer is of one of the peoples of the land he walks in (Cultures).
            Heightmap.Biome land = WorldGenerator.instance != null ? WorldGenerator.instance.GetBiome(target) : Heightmap.Biome.Meadows;
            string culture = Village.Cultures.On ? Village.Cultures.Roll(land, seed) : Village.Cultures.Fallback;
            string name = Names.Villager(seed, culture);
            ZDO zdo = villager.Zdo;
            zdo.Set(Village.Cultures.KeyVillager, culture);
            zdo.Set(Keys.VillagerVillage, 0);
            zdo.Set(Keys.VillagerVillageName, "");
            zdo.Set(Keys.VillagerHearth, target);
            zdo.Set(Keys.VillagerHome, target);
            zdo.Set(Keys.VillagerSeed, seed);
            zdo.Set(Keys.VillagerName, name);
            zdo.Set(KeyKind, kind);
            zdo.Set(KeyPhase, kind == Hermit || kind == Camper ? Stay : Arrive);
            zdo.Set(KeyTarget, target);
            zdo.Set(KeyFrom, from ?? "");
            zdo.Set(KeyBorn, (long)(Now * 10.0));
            zdo.Set(KeyVisit, visitVillage);
            villager.m_name = name;
            villager.LooksApplied = false;
            VillheimPlugin.Log.LogInfo($"A {kind}, {name}{(string.IsNullOrEmpty(from) ? "" : " from " + from)}, appeared at {spawn}.");
            return villager;
        }

        // ---------------------------------------------------------------- the brain

        /// <summary>One AI tick for a wanderer. Returns false during a fight, so the game's AI takes over.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            if (Brain.ThreatNear(villager, ai, out _))
            {
                villager.SetWalk(false);
                Poses.Release(villager);
                return false;
            }

            ZDO zdo = villager.Zdo;
            string kind = KindOf(villager);
            State state = States.GetOrCreateValue(villager);
            if (RemoveWhenDone(villager, zdo, kind))
            {
                return true;
            }

            Poses.BeginTick(villager);
            switch (kind)
            {
                case Hermit:
                case Camper:
                    HermitTick(villager, ai, dt, zdo, state);
                    break;
                case Carrier:
                    Village.Caravans.WalkTick(villager, ai, dt);
                    break;
                default:
                    VisitorTick(villager, ai, dt, zdo, state, kind);
                    break;
            }

            Poses.EndTick(villager);
            TalkNow(villager, state);
            return true;
        }

        /// <summary>
        /// A visitor who has left (or has been about for three days, or a hermit whose camp is gone) disappears once
        /// no player is near enough to see it.
        /// </summary>
        private static bool RemoveWhenDone(Villager villager, ZDO zdo, string kind)
        {
            float nearest = NearestPlayer(villager.transform.position);
            double age = Now - zdo.GetLong(KeyBorn) / 10.0;
            bool done;
            if (kind == Hermit || kind == Camper)
            {
                // Only once the camp's ground is loaded, or a hermit at the edge of the loaded area would lose a camp
                // that is still there.
                Vector3 camp = zdo.GetVec3(KeyTarget, villager.transform.position);
                done = ZNetScene.instance.IsAreaReady(camp) && WorldLife.CampOf(camp) == null;
            }
            else
            {
                done = zdo.GetString(KeyPhase, Arrive) == Leave || age > 3.0 * Village.VillageBrain.DayLength();
            }

            if (!done || nearest < SeenFrom)
            {
                return false;
            }

            VillheimPlugin.Log.LogInfo($"The {kind} {villager.VillagerName} has gone on their way.");
            villager.m_nview.ClaimOwnership();
            ZNetScene.instance.Destroy(villager.gameObject);
            return true;
        }

        private static float NearestPlayer(Vector3 point)
        {
            float best = float.MaxValue;
            foreach (Player player in Player.GetAllPlayers())
            {
                best = Mathf.Min(best, Utils.DistanceXZ(player.transform.position, point));
            }

            return best;
        }

        // ---------------------------------------------------------------- pedlars and pilgrims

        private static void VisitorTick(Villager villager, VillagerAI ai, float dt, ZDO zdo, State state, string kind)
        {
            string phase = zdo.GetString(KeyPhase, Arrive);
            Vector3 target = zdo.GetVec3(KeyTarget, villager.transform.position);
            VillageHearth hearth = VillageHearth.Find(zdo.GetInt(KeyVisit));
            Walker walker = Walker.For(villager);
            if (phase == Arrive)
            {
                if (state.WalkingSince < 0f)
                {
                    state.WalkingSince = Time.time;
                }

                WalkResult result = walker.Go(villager, ai, dt, target, 3f);
                // Ten minutes on the way (lost behind a cliff or a lake): he has arrived wherever he is.
                if (result == WalkResult.Arrived || Time.time - state.WalkingSince > 600f)
                {
                    walker.Reset();
                    zdo.Set(KeyPhase, Stay);
                    double stay = kind == Pilgrim ? UntilMorning() : 0.33 * Village.VillageBrain.DayLength();
                    zdo.Set(KeyUntil, (long)((Now + stay) * 10.0));
                    zdo.Set(KeyTarget, villager.transform.position);
                    if (hearth != null)
                    {
                        WorldLife.Arrived(villager, kind, hearth);
                    }
                }
                else if (!state.Greeted && hearth != null && Utils.DistanceXZ(villager.transform.position, target) < 25f)
                {
                    state.Greeted = true;
                    Poses.Gesture(villager, "wave");
                }

                return;
            }

            if (phase == Stay)
            {
                if (Now >= zdo.GetLong(KeyUntil) / 10.0 && (kind != Pedlar || !EnvMan.IsNight()))
                {
                    if (kind == Pilgrim && hearth != null)
                    {
                        WorldLife.Blessing(villager, hearth);
                    }

                    zdo.Set(KeyPhase, Leave);
                    Vector3 home = hearth != null ? hearth.transform.position : villager.transform.position;
                    Vector3 away = zdo.GetVec3(KeyAway, Vector3.zero);
                    if (away.sqrMagnitude < 0.01f)
                    {
                        away = Random.insideUnitSphere.Horizontal().normalized;
                    }

                    zdo.Set(KeyTarget, home + away.normalized * 140f);
                    walker.Reset();
                    // How the stay went, for his home village and for his goodbye (VisitorJudging).
                    string[] judged = hearth != null ? Village.VisitorJudging.Leaving(villager, hearth) : null;
                    Dialogue.Say(villager, Dialogue.LineFor(villager, "bye", "wanderer", judged) ?? "Safe roads.");
                    return;
                }

                if (hearth != null)
                {
                    Village.VisitorJudging.Sample(villager, hearth);
                }

                Linger(villager, ai, dt, state, hearth, target);
                return;
            }

            // Leaving: walking out of the village; removed once nobody can see him (RemoveWhenDone).
            if (walker.Go(villager, ai, dt, target, 3f) != WalkResult.Walking)
            {
                // Out at the end of his road with someone still watching: keep going a little farther.
                Vector3 on = (target - (hearth != null ? hearth.transform.position : villager.transform.position)).Horizontal();
                zdo.Set(KeyTarget, target + on.normalized * 40f);
                walker.Reset();
            }
        }

        /// <summary>Near the hearth: a few steps now and then by day, sitting by the fire after dark.</summary>
        private static void Linger(Villager villager, VillagerAI ai, float dt, State state, VillageHearth hearth, Vector3 around)
        {
            Vector3 fire = hearth != null ? hearth.transform.position : around;
            bool night = Hour >= 20f || Hour < 6f;
            if (Time.time >= state.NextSpot || state.Spot == Vector3.zero)
            {
                state.NextSpot = Time.time + Random.Range(25f, 50f);
                float radius = night ? 3.2f : Random.Range(4f, 8f);
                Vector2 ring = Random.insideUnitCircle.normalized * radius;
                state.Spot = fire + new Vector3(ring.x, 0f, ring.y);
            }

            if (Walker.For(villager).Go(villager, ai, dt, state.Spot, 0.8f) == WalkResult.Walking)
            {
                return;
            }

            ai.StopMoving();
            Face(villager, fire);
            if (night)
            {
                Poses.Hold(villager, Hour >= 23f || Hour < 4f ? Poses.Rest : Poses.Sit);
            }
        }

        private static void Face(Villager villager, Vector3 point)
        {
            Vector3 to = (point - villager.transform.position).Horizontal();
            if (to.sqrMagnitude > 0.01f)
            {
                villager.SetLookDir(to.normalized);
            }
        }

        /// <summary>Seconds from now to the next 06:00.</summary>
        private static double UntilMorning()
        {
            float hour = Hour;
            float hours = hour < 6f ? 6f - hour : 30f - hour;
            return hours / 24.0 * Village.VillageBrain.DayLength();
        }

        // ---------------------------------------------------------------- hermits

        private static void HermitTick(Villager villager, VillagerAI ai, float dt, ZDO zdo, State state)
        {
            Vector3 camp = zdo.GetVec3(KeyTarget, villager.transform.position);
            Fireplace fire = WorldLife.CampOf(camp);
            if (fire != null && Time.time >= state.NextFuel)
            {
                state.NextFuel = Time.time + 60f;
                WorldLife.Feed(fire);
            }

            bool evening = Hour >= 18f || Hour < 7f;
            if (Time.time >= state.NextSpot || state.Spot == Vector3.zero)
            {
                state.NextSpot = Time.time + (evening ? Random.Range(60f, 120f) : Random.Range(20f, 45f));
                float radius = evening ? 2.6f : Random.Range(4f, 14f);
                Vector2 ring = Random.insideUnitCircle.normalized * radius;
                state.Spot = camp + new Vector3(ring.x, 0f, ring.y);
            }

            if (Walker.For(villager).Go(villager, ai, dt, state.Spot, 0.8f) == WalkResult.Walking)
            {
                return;
            }

            ai.StopMoving();
            if (evening)
            {
                Face(villager, camp);
                Poses.Hold(villager, Hour >= 23f || Hour < 5f ? Poses.Rest : Poses.Sit);
            }
            else if (Random.value < 0.004f)
            {
                // Pottering: a look at something on the ground.
                Poses.Trigger(villager, "interact");
            }
        }

        // ---------------------------------------------------------------- talking

        private static void TalkNow(Villager villager, State state)
        {
            Player player = Player.m_localPlayer;
            if (player == null || !VillheimConfig.VillagerChatter.Value || Time.time < state.NextSelf)
            {
                return;
            }

            state.NextSelf = Time.time + Random.Range(90f, 180f);
            if (Vector3.Distance(player.transform.position, villager.transform.position) > 14f || Random.value > 0.6f)
            {
                return;
            }

            Dialogue.Say(villager, Dialogue.LineFor(villager, "self", "wanderer"));
        }

        public static string Describe(Villager villager)
        {
            ZDO zdo = villager.Zdo;
            switch (KindOf(villager))
            {
                case Hermit:
                    return Hour >= 18f || Hour < 7f ? "sitting by the camp fire" : "pottering about the camp";
                case Camper:
                    return Hour >= 18f || Hour < 7f ? "sitting by the camp fire" : "working round the " + zdo.GetString(KeyCampKind, "camp");
                case Pilgrim:
                    switch (zdo.GetString(KeyPhase, Arrive))
                    {
                        case Arrive: return "walking toward the hearth";
                        case Stay: return "resting by the hearth for the night";
                        default: return "on the road again";
                    }
                default:
                    switch (zdo.GetString(KeyPhase, Arrive))
                    {
                        case Arrive: return "on the way in with a pack";
                        case Stay: return "trading by the hearth";
                        default: return "moving on to the next place";
                    }
            }
        }

        public static string HoverText(Villager villager)
        {
            string kind = KindOf(villager);
            string from = villager.Zdo.GetString(KeyFrom, "");
            string title = kind == Hermit ? "A hermit" : kind == Pilgrim ? "A pilgrim" : kind == Camper
                ? $"At {from}'s {villager.Zdo.GetString(KeyCampKind, "camp")}" : "A travelling pedlar";
            string text = villager.VillagerName + $"\n<color=#b0b0b0>{title}{(from.Length > 0 && kind != Hermit && kind != Camper ? " from " + from : "")}</color>" +
                          $"\n<color=#b0b0b0>{Describe(villager)}</color>" +
                          "\n[<color=yellow><b>$KEY_Use</b></color>] Talk";
            if (kind != Pilgrim && kind != Camper)
            {
                text += "\n[<color=yellow><b>Shift</b></color> + <color=yellow><b>$KEY_Use</b></color>] Trade";
            }

            return Localization.instance.Localize(text);
        }

        public static bool Interact(Villager villager, Player player)
        {
            string kind = KindOf(villager);
            bool shift = ZInput.GetButton("Run") || ZInput.GetKey(KeyCode.LeftShift, false) || ZInput.GetKey(KeyCode.RightShift, false);
            Social.LookAt(villager, player, 6f);
            if (shift && kind != Pilgrim && kind != Camper && OpenStore(villager))
            {
                return true;
            }

            if (kind == Hermit && WorldLife.TellOfPlace(villager, player, out string told))
            {
                Dialogue.Say(villager, told, 8f);
                return true;
            }

            Dialogue.Say(villager, Dialogue.LineFor(villager, "talk", "wanderer") ?? "Hm.", 6f);
            return true;
        }

        // ---------------------------------------------------------------- trading with the player

        private static bool OpenStore(Villager villager)
        {
            if (StoreGui.instance == null || ObjectDB.instance == null)
            {
                return false;
            }

            List<Trader.TradeItem> items = WorldLife.WaresFor(villager);
            if (items.Count == 0)
            {
                return false;
            }

            Trader trader = WaresOf(villager);
            trader.m_name = villager.VillagerName;
            trader.m_items = items;
            StoreGui.instance.Show(trader);
            return true;
        }

        private static Trader WaresOf(Villager villager)
        {
            Transform existing = villager.transform.Find(WaresObject);
            if (existing != null && existing.TryGetComponent(out Trader found))
            {
                return found;
            }

            var go = new GameObject(WaresObject);
            go.SetActive(false);
            go.transform.SetParent(villager.transform, false);
            Trader trader = go.AddComponent<Trader>();
            trader.m_randomTalk = new List<string>();
            trader.m_randomGreets = new List<string>();
            trader.m_randomGoodbye = new List<string>();
            trader.m_randomStartTrade = new List<string>();
            trader.m_randomBuy = new List<string>();
            trader.m_randomSell = new List<string>();
            return trader;
        }

        private static bool IsWares(Trader trader) => trader != null && trader.gameObject.name == WaresObject;

        /// <summary>The store window already moved the goods and coins; the wanderer just says something.</summary>
        [HarmonyPatch(typeof(Trader), nameof(Trader.OnBought))]
        internal static class BoughtPatch
        {
            private static bool Prefix(Trader __instance)
            {
                if (!IsWares(__instance))
                {
                    return true;
                }

                Villager villager = __instance.GetComponentInParent<Villager>();
                if (villager != null)
                {
                    Dialogue.Say(villager, Dialogue.LineFor(villager, "talk", "sold") ?? "Good choice.");
                }

                return false;
            }
        }

        [HarmonyPatch(typeof(Trader), nameof(Trader.OnSold))]
        internal static class SoldPatch
        {
            private static bool Prefix(Trader __instance) => !IsWares(__instance);
        }
    }
}
