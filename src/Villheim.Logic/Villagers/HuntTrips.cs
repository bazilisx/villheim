using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// D-078 (2026-11-09): hunters hunt real nearby game; with none near and stores low they leave for a while
    /// (overnight) and come back, and a roll decides success, kind of game and its drops, amount, and their health on
    /// return. In this code the kind of game comes from his biome and the ones beside it.
    ///
    /// He walks out past the edge of the village toward open land, is away (out of sight, held still) until about 07:00,
    /// then walks home and puts what he got in the chest. The trip is kept on his ZDO, so a reload or a logout does not
    /// lose him. Setting HuntTrips turns it off.
    /// </summary>
    internal static class HuntTrips
    {
        private static readonly int KeyPhase = "villheim_trip_phase".GetStableHashCode();
        private static readonly int KeyUntil = "villheim_trip_until".GetStableHashCode();
        private static readonly int KeySpot = "villheim_trip_spot".GetStableHashCode();
        private static readonly int KeyLast = "villheim_trip_last".GetStableHashCode();
        private static readonly int KeyBag = "villheim_trip_bag".GetStableHashCode();

        private const int None = 0, Out = 1, Away = 2, Back = 3;
        private const float ReturnHour = 7f;

        public static bool On => LogicConfig.HuntTrips == null || LogicConfig.HuntTrips.Value;

        public static bool IsAway(Villager villager) => villager?.Zdo != null && villager.Zdo.GetInt(KeyPhase) == Away;

        public static bool OnTrip(Villager villager) => villager?.Zdo != null && villager.Zdo.GetInt(KeyPhase) != None;

        /// <summary>For the hover and the status line.</summary>
        public static string Activity(Villager villager)
        {
            switch (villager?.Zdo?.GetInt(KeyPhase) ?? None)
            {
                case Out: return "setting out to hunt away from the village";
                case Away: return "away hunting, back in the morning";
                case Back: return "back from a hunting trip";
                default: return null;
            }
        }

        /// <summary>
        /// From Hunting.Begin when no game is near: sets out if he hunts for a living, the stores are low, it is
        /// afternoon, and his last trip was more than a day ago.
        /// </summary>
        public static bool TryStart(Villager villager, VillageHearth hearth, int meat, int target)
        {
            if (!On || villager.Zdo == null || Roles.TradeOf(villager) != Roles.Trade.Hunter || meat * 2 >= target ||
                Living.Hour < 13f || Living.Hour > 17f || EnvMan.IsNight())
            {
                return false;
            }

            double now = ZNet.instance.GetTimeSeconds();
            if (now - villager.Zdo.GetFloat(KeyLast, -1e9f) < VillageBrain.DayLength())
            {
                return false;
            }

            // Out past the edge, away from the hearth on his side of the village, onto dry ground.
            Vector3 center = hearth.transform.position;
            Vector3 away = (villager.transform.position - center).Horizontal();
            away = away.sqrMagnitude > 1f ? away.normalized : Quaternion.Euler(0f, Random.Range(0f, 360f), 0f) * Vector3.forward;
            float distance = VillheimConfig.VillageRadius.Value + 25f;
            Vector3 spot = center + away * distance;
            for (int turn = 0; turn < 8; turn++)
            {
                Vector3 test = center + Quaternion.Euler(0f, turn * 45f, 0f) * away * distance;
                if (ZoneSystem.instance.GetGroundHeight(test, out float y) && y > ZoneSystem.instance.m_waterLevel + 0.5f)
                {
                    spot = new Vector3(test.x, y, test.z);
                    break;
                }
            }

            villager.Zdo.Set(KeyPhase, Out);
            villager.Zdo.Set(KeySpot, spot);
            villager.Zdo.Set(KeyLast, (float)now);
            VillheimPlugin.Log.LogInfo($"{villager.VillagerName} leaves {hearth.VillageName} to hunt overnight (no game near, {meat} meat in the chests).");
            Chronicle.Add(hearth, $"{villager.VillagerName} went out to hunt for a night and a day.");
            return true;
        }

        private static readonly Dictionary<Villager, float> Deadline = new Dictionary<Villager, float>();

        /// <summary>From the brain, before anything else but a fight: runs the trip while there is one.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            if (villager.Zdo == null)
            {
                return false;
            }

            int phase = villager.Zdo.GetInt(KeyPhase);
            if (phase == None)
            {
                return false;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid)
            {
                Finish(villager);
                return false;
            }

            switch (phase)
            {
                case Out:
                    return WalkOut(villager, ai, dt);
                case Away:
                    return StayAway(villager, ai, hearth);
                case Back:
                    return WalkBack(villager, ai, dt, hearth);
            }

            return false;
        }

        private static bool WalkOut(Villager villager, VillagerAI ai, float dt)
        {
            Vector3 spot = villager.Zdo.GetVec3(KeySpot, villager.transform.position);
            if (!Deadline.TryGetValue(villager, out float until))
            {
                Deadline[villager] = until = Time.time + 120f;
            }

            WalkResult step = Walker.For(villager).Go(villager, ai, dt, spot, 2f, false);
            if (step == WalkResult.Walking && Time.time < until)
            {
                return true;
            }

            // Out of sight now: away until the morning (or as far as he got, if the way was blocked).
            Deadline.Remove(villager);
            ai.StopMoving();
            villager.Zdo.Set(KeyPhase, Away);
            villager.Zdo.Set(KeyUntil, (float)NextMorning());
            Hide(villager, true);
            return true;
        }

        private static bool StayAway(Villager villager, VillagerAI ai, VillageHearth hearth)
        {
            Hide(villager, true);
            ai.StopMoving();
            if (ZNet.instance.GetTimeSeconds() < villager.Zdo.GetFloat(KeyUntil) || EnvMan.IsNight())
            {
                return true;
            }

            Roll(villager, hearth);
            Hide(villager, false);
            villager.Zdo.Set(KeyPhase, Back);
            return true;
        }

        private static bool WalkBack(Villager villager, VillagerAI ai, float dt, VillageHearth hearth)
        {
            Container chest = VillageChest.Find(hearth);
            Vector3 to = chest != null ? chest.transform.position : hearth.transform.position;
            if (!Deadline.TryGetValue(villager, out float until))
            {
                Deadline[villager] = until = Time.time + 150f;
            }

            if (Walker.For(villager).Go(villager, ai, dt, to, 1.6f, false) == WalkResult.Walking && Time.time < until)
            {
                return true;
            }

            Deadline.Remove(villager);
            ai.StopMoving();
            Dictionary<string, int> bag = ReadBag(villager);
            if (chest != null)
            {
                foreach (KeyValuePair<string, int> item in bag)
                {
                    GameObject prefab = ObjectDB.instance != null ? ObjectDB.instance.GetItemPrefab(item.Key) : null;
                    if (prefab != null)
                    {
                        chest.GetInventory().AddItem(prefab, item.Value);
                    }
                }

                Poses.Trigger(villager, "interact");
            }

            string got = bag.Count > 0 ? string.Join(", ", bag.Select(b => $"{b.Value} {b.Key}")) : "nothing";
            VillheimPlugin.Log.LogInfo($"{villager.VillagerName} is back from the hunt with {got} (health {villager.GetHealthPercentage() * 100f:0}%).");
            Chronicle.Add(hearth, bag.Count > 0
                ? $"{villager.VillagerName} came back from the hunt with {got}."
                : $"{villager.VillagerName} came back from the hunt empty-handed.");
            if (bag.Count > 0)
            {
                Dialogue.Note(villager.VillageId, "hunt");
            }

            Finish(villager);
            return false;
        }

        private static void Finish(Villager villager)
        {
            Hide(villager, false);
            villager.Zdo.Set(KeyPhase, None);
            villager.Zdo.Set(KeyBag, "");
            Deadline.Remove(villager);
        }

        /// <summary>The next 07:00 in game time, in seconds.</summary>
        private static double NextMorning()
        {
            double day = VillageBrain.DayLength();
            double now = ZNet.instance.GetTimeSeconds();
            double start = System.Math.Floor(now / day) * day;
            double morning = start + day * ReturnHour / 24.0;
            return morning > now + day * 0.25 ? morning : morning + day;
        }

        // ---------------------------------------------------------------- the roll

        private sealed class Game
        {
            public string Name;
            public (string Item, int Min, int Max)[] Drops;
            public float Danger;
        }

        private static readonly Dictionary<Heightmap.Biome, Game[]> Pool = new Dictionary<Heightmap.Biome, Game[]>
        {
            [Heightmap.Biome.Meadows] = new[]
            {
                new Game { Name = "deer", Drops = new[] { ("DeerMeat", 1, 3), ("DeerHide", 1, 2) }, Danger = 0.05f },
                new Game { Name = "boar", Drops = new[] { ("RawMeat", 1, 3), ("LeatherScraps", 1, 2) }, Danger = 0.15f },
                new Game { Name = "neck", Drops = new[] { ("NeckTail", 1, 2) }, Danger = 0.1f },
            },
            [Heightmap.Biome.BlackForest] = new[]
            {
                new Game { Name = "deer", Drops = new[] { ("DeerMeat", 1, 3), ("DeerHide", 1, 2) }, Danger = 0.1f },
                new Game { Name = "boar", Drops = new[] { ("RawMeat", 1, 3), ("LeatherScraps", 1, 2) }, Danger = 0.2f },
            },
            [Heightmap.Biome.Swamp] = new[]
            {
                new Game { Name = "boar", Drops = new[] { ("RawMeat", 1, 3), ("LeatherScraps", 1, 2) }, Danger = 0.25f },
                new Game { Name = "deer", Drops = new[] { ("DeerMeat", 1, 2), ("DeerHide", 1, 1) }, Danger = 0.2f },
            },
            [Heightmap.Biome.Mountain] = new[]
            {
                new Game { Name = "wolf", Drops = new[] { ("WolfMeat", 1, 2), ("WolfPelt", 1, 1) }, Danger = 0.4f },
                new Game { Name = "deer", Drops = new[] { ("DeerMeat", 1, 2), ("DeerHide", 1, 1) }, Danger = 0.15f },
            },
            [Heightmap.Biome.Plains] = new[]
            {
                new Game { Name = "lox", Drops = new[] { ("LoxMeat", 2, 4), ("LoxPelt", 1, 2) }, Danger = 0.45f },
                new Game { Name = "deer", Drops = new[] { ("DeerMeat", 1, 2), ("DeerHide", 1, 1) }, Danger = 0.15f },
            },
            [Heightmap.Biome.Mistlands] = new[]
            {
                new Game { Name = "hare", Drops = new[] { ("HareMeat", 1, 2), ("ScaleHide", 0, 1) }, Danger = 0.2f },
                new Game { Name = "deer", Drops = new[] { ("DeerMeat", 1, 2), ("DeerHide", 1, 1) }, Danger = 0.15f },
            },
        };

        private static void Roll(Villager villager, VillageHearth hearth)
        {
            var state = new VillageState(hearth.Zdo);
            var rng = new System.Random(villager.Zdo.GetInt(Keys.VillagerSeed) ^ (int)(ZNet.instance.GetTimeSeconds() / 60.0));
            Game[] pool = Pool.TryGetValue(state.Biome, out Game[] own) ? own : Pool[Heightmap.Biome.Meadows];
            float skill = VillagerSkills.WorkFactor(villager, "hunting");
            var bag = new Dictionary<string, int>();
            Game game = pool[rng.Next(pool.Length)];
            bool success = rng.NextDouble() < Mathf.Clamp(0.55f * skill, 0.3f, 0.9f);
            if (success)
            {
                int kills = rng.NextDouble() < 0.25 ? 2 : 1;
                for (int k = 0; k < kills; k++)
                {
                    foreach ((string item, int min, int max) in game.Drops)
                    {
                        int n = rng.Next(min, max + 1);
                        if (n > 0)
                        {
                            bag[item] = (bag.TryGetValue(item, out int had) ? had : 0) + n;
                        }
                    }
                }
            }

            // The risk: a hard night, a fall, a fight with what he hunted. Never worse than a fifth of his health left.
            float hurt = (float)rng.NextDouble() * (0.15f + game.Danger);
            if (rng.NextDouble() < 0.05)
            {
                hurt += 0.3f;
            }

            float health = Mathf.Max(villager.GetMaxHealth() * 0.2f, villager.GetHealth() - villager.GetMaxHealth() * hurt);
            villager.SetHealth(health);
            villager.Zdo.Set(KeyBag, string.Join(",", bag.Select(b => $"{b.Key}:{b.Value.ToString(CultureInfo.InvariantCulture)}")));
            VillheimPlugin.Debug($"{villager.VillagerName}'s hunt: {(success ? $"{game.Name}, " + string.Join(", ", bag.Select(b => $"{b.Value} {b.Key}")) : "nothing caught")}, " +
                                 $"hurt {hurt * 100f:0}%.");
        }

        private static Dictionary<string, int> ReadBag(Villager villager)
        {
            var bag = new Dictionary<string, int>();
            foreach (string part in villager.Zdo.GetString(KeyBag, "").Split(','))
            {
                string[] f = part.Split(':');
                if (f.Length == 2 && int.TryParse(f[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out int n) && n > 0)
                {
                    bag[f[0]] = n;
                }
            }

            return bag;
        }

        // ---------------------------------------------------------------- out of sight

        private static void Hide(Villager villager, bool hidden)
        {
            foreach (Renderer renderer in villager.GetComponentsInChildren<Renderer>(true))
            {
                if (renderer != null && !(renderer is ParticleSystemRenderer))
                {
                    renderer.forceRenderingOff = hidden;
                }
            }

            Rigidbody body = villager.GetComponent<Rigidbody>();
            if (body != null)
            {
                body.isKinematic = hidden;
            }

            foreach (Collider collider in villager.GetComponentsInChildren<Collider>(true))
            {
                if (collider != null && !collider.isTrigger)
                {
                    collider.enabled = !hidden;
                }
            }
        }
    }
}
