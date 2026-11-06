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
    /// What villagers do when there is no work.
    ///
    /// By day each villager picks an activity every 30 to 90 seconds, by weight from what is at hand: sit by the
    /// hearth, sit on the ground near home, take a stroll, chat with another idle villager, or keep busy at one of the
    /// village's workbenches, forges or cooking stations. The village's mood shifts the weights and the gestures:
    /// cheerful villages chat and cheer, glum ones sit alone and shrug.
    ///
    /// In the evening everyone gathers in a ring around the hearth. Every other one sits, the rest toast and laugh,
    /// and in a cheerful village someone dances. At night they sit by the fire, and late at night lie down to rest.
    ///
    /// Spots keep at least 2 m from the fire and stay out of buildings and the building site. An activity that can't
    /// be reached in 30 seconds is set aside for five minutes.
    /// </summary>
    internal static class FreeTime
    {
        private enum Kind
        {
            None,
            FireSit,
            GroundSit,
            Stroll,
            Chat,
            Station,
            Evening,
            Night,
        }

        private enum Mode
        {
            Day,
            Evening,
            Night,
        }

        private sealed class State
        {
            public Kind Kind;
            public Mode Mode;
            public Vector3 Spot;
            public Vector3 Look;
            public bool HasLook;
            public float Until;
            public float GiveUpAt;
            public bool Arrived;
            public float ArrivedAt;
            public float NextGesture;
            public float StandUntil;
            public bool Sitting;
            public bool Dancing;
            public float DanceUntil;
            public GameObject Station;
            public Talk Chat;
            public float LastRun;
            public readonly Dictionary<Kind, float> SkipUntil = new Dictionary<Kind, float>();
            public readonly Dictionary<long, int> WavedOnDay = new Dictionary<long, int>();
        }

        private sealed class Talk
        {
            public Villager A;
            public Villager B;
            public Vector3 Meet;
            public float Until;
        }

        private const float FireMin = 2.2f;
        private const float FireMax = 2.7f;
        private const float StationReach = 1.4f;
        private const float ChatRange = 20f;
        private const float LookAtPlayerWithin = 6f;
        private const float EveningStart = 0.68f;
        private const float RestAfter = 0.85f;
        private const float RestBefore = 0.2f;

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();
        private static readonly Dictionary<GameObject, Villager> StationClaims = new Dictionary<GameObject, Villager>();
        private static readonly Dictionary<int, (float Time, List<GameObject> Stations)> StationCache =
            new Dictionary<int, (float, List<GameObject>)>();

        private static readonly string[] CheerfulGestures = { "cheer", "laugh", "toast", "thumbsup", "wave", "flex" };
        private static readonly string[] ContentGestures = { "wave", "point", "laugh", "thumbsup", "shrug", "comehere" };
        private static readonly string[] UneasyGestures = { "shrug", "point", "nonono" };
        private static readonly string[] GlumGestures = { "shrug", "nonono", "despair", "cry" };
        private static readonly string[] EveningGestures = { "toast", "laugh", "cheer" };

        private static readonly string[] ChatLines =
        {
            "Did you see the size of that boar?",
            "Good weather for felling trees.",
            "My back aches from all that chopping.",
            "I heard wolves last night.",
            "The fire needs more wood.",
            "We should build a smithy next.",
            "I saw a troll down by the river.",
            "Have you tried the new mead?",
            "Someone left the gate open again.",
            "The greylings were at the edge of the woods.",
        };

        private static readonly string[] CheerfulLines =
        {
            "This place is coming along.",
            "Another roof soon, I think.",
            "A good day for it.",
        };

        private static readonly string[] GlumLines =
        {
            "I'm tired of sleeping by the fire.",
            "We need more houses.",
            "Nobody fixed that roof yet.",
        };

        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            if (villager.IsDead())
            {
                return false;
            }

            State state = States.GetOrCreateValue(villager);
            Mode mode = CurrentMode();
            if (Time.time - state.LastRun > 1f || state.Mode != mode || Time.time > state.Until ||
                (state.Kind == Kind.Chat && !ChatAlive(state.Chat)))
            {
                // Back from work, night falling, or the activity ran its time: choose again.
                End(villager, state);
                state.Mode = mode;
                Choose(villager, state, mode);
            }

            state.LastRun = Time.time;
            float mood = VillageMood.Get(villager.VillageId);

            if (!state.Arrived)
            {
                WalkResult step = Walker.For(villager).Go(villager, ai, dt, state.Spot, 0.8f);
                if (step == WalkResult.Walking && Time.time < state.GiveUpAt)
                {
                    return true;
                }

                if (step != WalkResult.Arrived && Utils.DistanceXZ(villager.transform.position, state.Spot) > 3f)
                {
                    // Can't get there. Set this kind of activity aside for a while and pick another.
                    state.SkipUntil[state.Kind] = Time.time + 300f;
                    VillheimPlugin.Debug($"{villager.VillagerName} could not get to {Describe(state)}; trying something else.");
                    state.Until = 0f;
                    return true;
                }

                state.Arrived = true;
                state.ArrivedAt = Time.time;
                state.NextGesture = Time.time + Random.Range(3f, 8f);
            }

            ai.StopMoving();
            Act(villager, ai, state, mood);
            return true;
        }

        public static string Describe(Villager villager)
        {
            return States.TryGetValue(villager, out State state) && Time.time - state.LastRun < 1f ? Describe(state) : null;
        }

        private static string Describe(State state)
        {
            switch (state.Kind)
            {
                case Kind.FireSit: return "warming up by the fire";
                case Kind.GroundSit: return "taking a rest";
                case Kind.Stroll: return "taking a stroll";
                case Kind.Chat: return "chatting";
                case Kind.Station: return state.Station != null ? "busy at the " + StationName(state.Station) : "keeping busy";
                case Kind.Evening: return "gathered at the hearth";
                case Kind.Night: return IsLateNight() ? "resting by the fire" : "sitting by the fire";
                default: return "idle";
            }
        }

        private static Mode CurrentMode()
        {
            if (!VillheimConfig.VillagersGatherAtNight.Value || EnvMan.instance == null)
            {
                return Mode.Day;
            }

            if (EnvMan.IsNight())
            {
                return Mode.Night;
            }

            float day = EnvMan.instance.GetDayFraction();
            return day >= EveningStart ? Mode.Evening : Mode.Day;
        }

        private static bool IsLateNight()
        {
            if (EnvMan.instance == null)
            {
                return false;
            }

            float day = EnvMan.instance.GetDayFraction();
            return day >= RestAfter || day <= RestBefore;
        }

        // ---------------------------------------------------------------- choosing

        private static void Choose(Villager villager, State state, Mode mode)
        {
            Vector3 hearth = Hearth(villager);
            state.Arrived = false;
            state.Sitting = false;
            state.Dancing = false;
            state.HasLook = false;
            state.Station = null;
            state.Chat = null;
            state.StandUntil = 0f;
            state.GiveUpAt = Time.time + 30f;
            Walker.For(villager).Reset();

            if (mode != Mode.Day)
            {
                state.Kind = mode == Mode.Evening ? Kind.Evening : Kind.Night;
                state.Spot = RingSpot(villager, hearth);
                state.Look = hearth;
                state.HasLook = true;
                state.Until = Time.time + 60f;
                return;
            }

            float mood = VillageMood.Get(villager.VillageId);
            bool wet = EnvMan.IsWet();
            var options = new List<(Kind Kind, float Weight)>
            {
                (Kind.FireSit, wet ? 0f : 3f),
                (Kind.GroundSit, wet ? 0f : (mood < 35f ? 2f : 1f)),
                (Kind.Stroll, mood < 35f ? 0.5f : 1f),
                (Kind.Chat, FindChatPartner(villager) != null ? (mood >= 65f ? 4f : mood < 35f ? 0.6f : 2f) : 0f),
                (Kind.Station, FreeStation(villager) != null ? 3f : 0f),
            };

            options.RemoveAll(o => o.Weight <= 0f || (state.SkipUntil.TryGetValue(o.Kind, out float until) && until > Time.time));
            Kind kind = options.Count == 0 ? Kind.Stroll : Pick(options);
            state.Kind = kind;
            state.Until = Time.time + Random.Range(30f, 90f);

            switch (kind)
            {
                case Kind.FireSit:
                    state.Spot = FireSpot(villager, hearth);
                    state.Look = hearth;
                    state.HasLook = true;
                    break;

                case Kind.Chat:
                    StartChat(villager, FindChatPartner(villager), state);
                    break;

                case Kind.Station:
                    GameObject station = FreeStation(villager);
                    StationClaims[station] = villager;
                    state.Station = station;
                    state.Spot = StationSpot(villager, station);
                    state.Look = station.transform.position + Vector3.up;
                    state.HasLook = true;
                    break;

                default:
                    state.Spot = HomeSpot(villager, hearth);
                    break;
            }
        }

        private static Kind Pick(List<(Kind Kind, float Weight)> options)
        {
            float roll = Random.value * options.Sum(o => o.Weight);
            foreach ((Kind kind, float weight) in options)
            {
                roll -= weight;
                if (roll <= 0f)
                {
                    return kind;
                }
            }

            return options[options.Count - 1].Kind;
        }

        // ---------------------------------------------------------------- acting

        private static void Act(Villager villager, VillagerAI ai, State state, float mood)
        {
            Vector3 position = villager.transform.position;
            Player player = ClosestPlayer(position, out float toPlayer);
            bool facing = !state.HasLook || ai.IsLookingAt(state.Look, 20f) || Time.time - state.ArrivedAt > 3f;

            switch (state.Kind)
            {
                case Kind.FireSit:
                case Kind.GroundSit:
                    ai.LookAt(state.HasLook ? state.Look : position + villager.transform.forward);
                    if (facing)
                    {
                        Poses.Hold(villager, Poses.Sit);
                    }

                    break;

                case Kind.Night:
                    ai.LookAt(state.Look);
                    if (facing)
                    {
                        Poses.Hold(villager, IsLateNight() ? Poses.Rest : Poses.Sit);
                    }

                    break;

                case Kind.Evening:
                    ai.LookAt(state.Look);
                    ActEvening(villager, state, mood, facing);
                    break;

                case Kind.Station:
                    ActStation(villager, ai, state, facing);
                    break;

                case Kind.Chat:
                    ActChat(villager, ai, state, mood);
                    break;

                default:
                    // Strolling: stand a little, greet anyone close, then wander on to the next spot near home.
                    if (state.StandUntil <= 0f)
                    {
                        state.StandUntil = Time.time + Random.Range(5f, 12f);
                    }

                    if (player != null && toPlayer < LookAtPlayerWithin)
                    {
                        ai.LookAt(player.GetEyePoint());
                        Greet(villager, state, player);
                    }

                    GestureByMood(villager, state, mood, 15f, 30f);
                    if (Time.time > state.StandUntil)
                    {
                        state.Spot = HomeSpot(villager, Hearth(villager));
                        state.Arrived = false;
                        state.StandUntil = 0f;
                        state.GiveUpAt = Time.time + 30f;
                    }

                    break;
            }
        }

        private static void ActEvening(Villager villager, State state, float mood, bool facing)
        {
            if (!facing)
            {
                return;
            }

            // Every other villager around the ring sits; the rest stand, toast and laugh.
            bool sits = (RingIndex(villager, out _) & 1) == 1;
            if (sits)
            {
                Poses.Hold(villager, Poses.Sit);
                return;
            }

            if (state.Dancing)
            {
                if (Time.time < state.DanceUntil)
                {
                    Poses.Hold(villager, Poses.Dance);
                    return;
                }

                state.Dancing = false;
                state.NextGesture = Time.time + Random.Range(5f, 10f);
                return;
            }

            if (Time.time < state.NextGesture)
            {
                return;
            }

            state.NextGesture = Time.time + Random.Range(10f, 20f);
            if (mood >= 65f && Random.value < 0.33f)
            {
                state.Dancing = true;
                state.DanceUntil = Time.time + Random.Range(15f, 25f);
                return;
            }

            Poses.Gesture(villager, mood >= 35f ? EveningGestures[Random.Range(0, EveningGestures.Length)] : "shrug");
        }

        /// <summary>
        /// Keeping busy at a station: hammering at a workbench or forge, kneeling at a cooking station or fire,
        /// standing and pointing at anything else.
        /// </summary>
        private static void ActStation(Villager villager, VillagerAI ai, State state, bool facing)
        {
            GameObject station = state.Station;
            if (station == null)
            {
                state.Until = 0f;
                return;
            }

            ai.LookAt(state.Look);
            if (!facing)
            {
                return;
            }

            if (station.GetComponent<CookingStation>() != null || station.GetComponent<Fireplace>() != null)
            {
                Poses.Hold(villager, Poses.Kneel);
                return;
            }

            if (station.GetComponent<CraftingStation>() != null && !StationName(station).Contains("cauldron"))
            {
                VillagerLooks.Hold(villager, VillagerLooks.Tool.Hammer);
                if (Time.time >= state.NextGesture)
                {
                    state.NextGesture = Time.time + Random.Range(2.2f, 3.5f);
                    Swing(villager);
                }

                return;
            }

            if (Time.time >= state.NextGesture)
            {
                state.NextGesture = Time.time + Random.Range(6f, 12f);
                Poses.Gesture(villager, Random.value < 0.5f ? "point" : "thumbsup");
            }
        }

        private static void ActChat(Villager villager, VillagerAI ai, State state, float mood)
        {
            Talk chat = state.Chat;
            Villager other = chat.A == villager ? chat.B : chat.A;
            ai.LookAt(other.GetEyePoint());
            if (!States.TryGetValue(other, out State theirs) || !theirs.Arrived)
            {
                return;
            }

            // Turns of five seconds of world time: A talks in even turns, B in odd ones.
            long turn = (long)(ZNet.instance != null ? ZNet.instance.GetTimeSeconds() / 5.0 : Time.time / 5f);
            bool mine = (turn % 2 == 0) == (chat.A == villager);
            if (!mine || Time.time < state.NextGesture)
            {
                return;
            }

            state.NextGesture = Time.time + Random.Range(5f, 9f);
            Poses.Gesture(villager, Gestures(mood)[Random.Range(0, Gestures(mood).Length)]);
            if (VillheimConfig.VillagerChatter.Value && global::Chat.instance != null && Random.value < 0.6f)
            {
                string[] lines = mood >= 65f && Random.value < 0.4f ? CheerfulLines
                    : mood < 35f && Random.value < 0.5f ? GlumLines
                    : ChatLines;
                global::Chat.instance.SetNpcText(villager.gameObject, Vector3.up * 2.2f, 20f, 5f, "",
                    lines[Random.Range(0, lines.Length)], false);
            }
        }

        private static void GestureByMood(Villager villager, State state, float mood, float min, float max)
        {
            if (Time.time < state.NextGesture)
            {
                return;
            }

            state.NextGesture = Time.time + Random.Range(min, max);
            string[] set = Gestures(mood);
            Poses.Gesture(villager, set[Random.Range(0, set.Length)]);
        }

        private static string[] Gestures(float mood)
        {
            if (mood >= 70f) return CheerfulGestures;
            if (mood >= 50f) return ContentGestures;
            if (mood >= 30f) return UneasyGestures;
            return GlumGestures;
        }

        /// <summary>Waves at a player once a day.</summary>
        private static void Greet(Villager villager, State state, Player player)
        {
            int day = EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;
            long id = player.GetPlayerID();
            if (state.WavedOnDay.TryGetValue(id, out int waved) && waved == day)
            {
                return;
            }

            state.WavedOnDay[id] = day;
            Poses.Gesture(villager, "wave");
        }

        private static void Swing(Villager villager)
        {
            ItemDrop.ItemData tool = villager.GetCurrentWeapon();
            string animation = tool?.m_shared?.m_attack?.m_attackAnimation;
            if (!string.IsNullOrEmpty(animation) && villager.m_zanim != null)
            {
                villager.m_zanim.SetTrigger(tool.m_shared.m_attack.m_attackChainLevels > 1 ? animation + "0" : animation);
            }
        }

        private static void End(Villager villager, State state)
        {
            if (state.Station != null && StationClaims.TryGetValue(state.Station, out Villager holder) && holder == villager)
            {
                StationClaims.Remove(state.Station);
            }

            if (state.Chat != null)
            {
                state.Chat.Until = 0f;
            }

            state.Kind = Kind.None;
            state.Station = null;
            state.Chat = null;
        }

        // ---------------------------------------------------------------- chats

        private static Villager FindChatPartner(Villager villager)
        {
            Villager best = null;
            float bestDistance = ChatRange;
            foreach (Character character in Character.GetAllCharacters())
            {
                if (!(character is Villager other) || other == villager || other.IsDead() || other.VillageId != villager.VillageId)
                {
                    continue;
                }

                // Free, and not already talking.
                if (!States.TryGetValue(other, out State theirs) || Time.time - theirs.LastRun > 1f ||
                    theirs.Kind == Kind.Chat || theirs.Mode != Mode.Day)
                {
                    continue;
                }

                float distance = Utils.DistanceXZ(villager.transform.position, other.transform.position);
                if (distance < bestDistance)
                {
                    best = other;
                    bestDistance = distance;
                }
            }

            return best;
        }

        private static void StartChat(Villager villager, Villager partner, State state)
        {
            if (partner == null || !States.TryGetValue(partner, out State theirs))
            {
                state.Kind = Kind.Stroll;
                state.Spot = HomeSpot(villager, Hearth(villager));
                return;
            }

            Vector3 a = villager.transform.position;
            Vector3 b = partner.transform.position;
            Vector3 meet = (a + b) * 0.5f;
            Vector3 along = Flat(b - a);
            var chat = new Talk { A = villager, B = partner, Meet = meet, Until = Time.time + Random.Range(20f, 45f) };

            End(partner, theirs);
            foreach ((Villager who, State whose, float side) in new[] { (villager, state, -1f), (partner, theirs, 1f) })
            {
                whose.Kind = Kind.Chat;
                whose.Mode = Mode.Day;
                whose.Chat = chat;
                whose.Until = chat.Until;
                whose.Spot = Ground(meet + along * 0.8f * side);
                whose.Arrived = false;
                whose.GiveUpAt = Time.time + 30f;
                whose.HasLook = false;
                whose.NextGesture = Time.time + Random.Range(1f, 3f);
                Walker.For(who).Reset();
            }

            VillheimPlugin.Debug($"{villager.VillagerName} and {partner.VillagerName} stop for a chat.");
        }

        private static bool ChatAlive(Talk chat)
        {
            if (chat == null || Time.time > chat.Until || chat.A == null || chat.B == null || chat.A.IsDead() || chat.B.IsDead())
            {
                return false;
            }

            return States.TryGetValue(chat.A, out State a) && a.Chat == chat && Time.time - a.LastRun < 1f &&
                   States.TryGetValue(chat.B, out State b) && b.Chat == chat && Time.time - b.LastRun < 1f;
        }

        // ---------------------------------------------------------------- stations

        private static GameObject FreeStation(Villager villager)
        {
            GameObject best = null;
            float bestDistance = float.MaxValue;
            foreach (GameObject station in Stations(villager))
            {
                if (station == null || (StationClaims.TryGetValue(station, out Villager holder) && holder != null &&
                                        holder != villager && States.TryGetValue(holder, out State theirs) &&
                                        theirs.Station == station && Time.time - theirs.LastRun < 2f))
                {
                    continue;
                }

                float distance = Utils.DistanceXZ(villager.transform.position, station.transform.position);
                if (distance < bestDistance)
                {
                    best = station;
                    bestDistance = distance;
                }
            }

            return best;
        }

        /// <summary>Workbenches, forges, cooking stations, fires and the like that this village built.</summary>
        private static List<GameObject> Stations(Villager villager)
        {
            int id = villager.VillageId;
            if (StationCache.TryGetValue(id, out var cached) && Time.time - cached.Time < 15f)
            {
                return cached.Stations;
            }

            var found = new HashSet<GameObject>();
            Vector3 hearth = Hearth(villager);
            foreach (Collider collider in Physics.OverlapSphere(hearth, 60f))
            {
                ZNetView view = collider.GetComponentInParent<ZNetView>();
                if (view == null || !view.IsValid() || view.GetZDO().GetInt(Keys.BuiltBy) != id ||
                    view.GetComponent<VillageHearth>() != null)
                {
                    continue;
                }

                GameObject go = view.gameObject;
                if (go.GetComponent<CraftingStation>() != null || go.GetComponent<CookingStation>() != null ||
                    go.GetComponent<Fireplace>() != null || go.GetComponent<Smelter>() != null ||
                    go.GetComponent<Fermenter>() != null)
                {
                    found.Add(go);
                }
            }

            var list = found.ToList();
            StationCache[id] = (Time.time, list);
            return list;
        }

        private static string StationName(GameObject station)
        {
            Piece piece = station.GetComponent<Piece>();
            string name = piece != null && Localization.instance != null ? Localization.instance.Localize(piece.m_name) : null;
            return string.IsNullOrEmpty(name) ? Utils.GetPrefabName(station).Replace("piece_", "").Replace('_', ' ') : name.ToLowerInvariant();
        }

        /// <summary>A step in front of the station, on the side the villager comes from.</summary>
        private static Vector3 StationSpot(Villager villager, GameObject station)
        {
            Vector3 center = station.transform.position;
            Vector3 side = Flat(villager.transform.position - center);
            return Ground(center + side * StationReach, center.y);
        }

        // ---------------------------------------------------------------- spots

        private static Vector3 Hearth(Villager villager)
        {
            return villager.Zdo.GetVec3(Keys.VillagerHearth, villager.transform.position);
        }

        /// <summary>A seat on the ground 2.2 to 2.7 m from the hearth on the villager's side, a metre clear of others.</summary>
        private static Vector3 FireSpot(Villager villager, Vector3 hearth)
        {
            Vector3 side = Flat(villager.transform.position - hearth);
            float baseAngle = Mathf.Atan2(side.x, side.z) * Mathf.Rad2Deg;
            float[] turns = { 0f, 35f, -35f, 70f, -70f, 105f, -105f, 140f, -140f, 180f };
            Vector3 fallback = hearth + side * FireMin;
            foreach (float turn in turns)
            {
                float angle = (baseAngle + turn) * Mathf.Deg2Rad;
                Vector3 spot = hearth + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * Random.Range(FireMin, FireMax);
                if (!OthersNear(villager, spot, 1f))
                {
                    return Ground(spot, hearth.y);
                }
            }

            return Ground(fallback, hearth.y);
        }

        /// <summary>
        /// The villager's place in the evening ring around the hearth, fixed by his place among the village's
        /// villagers, so nobody fights over a spot.
        /// </summary>
        private static Vector3 RingSpot(Villager villager, Vector3 hearth)
        {
            int index = RingIndex(villager, out int count);
            int perRing = 8;
            int ring = index / perRing;
            int inRing = Mathf.Min(perRing, count - ring * perRing);
            float angle = (index % perRing) * Mathf.PI * 2f / Mathf.Max(1, inRing) + villager.VillageId % 360 * Mathf.Deg2Rad;
            float radius = 2.6f + ring * 1.2f;
            return Ground(hearth + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * radius, hearth.y);
        }

        private static int RingIndex(Villager villager, out int count)
        {
            var ids = Character.GetAllCharacters()
                .OfType<Villager>()
                .Where(v => !v.IsDead() && v.VillageId == villager.VillageId && v.Zdo != null)
                .Select(v => v.GetZDOID())
                .OrderBy(z => z.UserID).ThenBy(z => z.ID)
                .ToList();
            count = Math.Max(1, ids.Count);
            int index = ids.IndexOf(villager.GetZDOID());
            return Math.Max(0, index);
        }

        /// <summary>A spot near home, outside buildings, the site and the fire, and clear of players.</summary>
        private static Vector3 HomeSpot(Villager villager, Vector3 hearth)
        {
            Vector3 home = villager.Zdo.GetVec3(Keys.VillagerHome, hearth);
            VillageHearth village = VillageHearth.Find(villager.VillageId);
            VillageState state = village != null && village.IsValid ? new VillageState(village.Zdo) : null;

            Vector3 center = hearth;
            float inner = 4f;
            float outer = 9f;
            if (Utils.DistanceXZ(home, hearth) > 1.5f)
            {
                float radius = HomeRadius(state, home);
                center = home;
                inner = radius + 1.5f;
                outer = radius + 5f;
            }

            Vector3 best = villager.transform.position;
            for (int i = 0; i < 10; i++)
            {
                float angle = Random.Range(0f, Mathf.PI * 2f);
                Vector3 spot = center + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * Random.Range(inner, outer);
                if (!ZoneSystem.instance.GetGroundHeight(spot, out float y) || y < ZoneSystem.instance.m_waterLevel + 0.2f)
                {
                    continue;
                }

                spot.y = y;
                best = spot;
                if (Clear(villager, spot, hearth, state, village))
                {
                    return spot;
                }
            }

            return best;
        }

        private static bool Clear(Villager villager, Vector3 spot, Vector3 hearth, VillageState state, VillageHearth village)
        {
            if (Utils.DistanceXZ(spot, hearth) < 3.5f || OthersNear(villager, spot, 1.5f))
            {
                return false;
            }

            ClosestPlayer(spot, out float toPlayer);
            if (toPlayer < 2.5f)
            {
                return false;
            }

            if (village != null && ConstructionSite.IsActive(village.Zdo) && ConstructionSite.InsideFootprint(village, spot))
            {
                return false;
            }

            return state == null || state.Plots.All(plot => Utils.DistanceXZ(spot, plot.Position) >= plot.Radius * 0.6f + 0.5f);
        }

        private static float HomeRadius(VillageState state, Vector3 home)
        {
            Plot plot = state?.Plots.FirstOrDefault(p => Utils.DistanceXZ(p.Position, home) < 1f);
            return plot != null ? plot.Radius * 0.6f : 5f;
        }

        private static bool OthersNear(Villager villager, Vector3 spot, float distance)
        {
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character != villager && character is Villager && Utils.DistanceXZ(character.transform.position, spot) < distance)
                {
                    return true;
                }
            }

            foreach (State other in OtherSpots(villager))
            {
                if (Utils.DistanceXZ(other.Spot, spot) < distance)
                {
                    return true;
                }
            }

            return false;
        }

        private static IEnumerable<State> OtherSpots(Villager villager)
        {
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character != villager && character is Villager other && States.TryGetValue(other, out State state) &&
                    Time.time - state.LastRun < 1f)
                {
                    yield return state;
                }
            }
        }

        private static Player ClosestPlayer(Vector3 point, out float distance)
        {
            Player closest = null;
            distance = float.MaxValue;
            foreach (Player player in Player.GetAllPlayers())
            {
                float d = Utils.DistanceXZ(point, player.transform.position);
                if (d < distance)
                {
                    closest = player;
                    distance = d;
                }
            }

            return closest;
        }

        private static Vector3 Ground(Vector3 spot, float fallbackY = float.NaN)
        {
            if (ZoneSystem.instance != null && ZoneSystem.instance.GetGroundHeight(spot, out float y))
            {
                spot.y = y;
            }
            else if (!float.IsNaN(fallbackY))
            {
                spot.y = fallbackY;
            }

            return spot;
        }

        private static Vector3 Flat(Vector3 vector)
        {
            vector.y = 0f;
            return vector.sqrMagnitude > 0.0001f ? vector.normalized : Vector3.forward;
        }
    }
}
