using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Villagers;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// A small director for each village: once a day something may happen that a player would hear about. After
    /// ValheimCityBuilder's events (harvest festivals, a travelling merchant), Living Factions' daily rolls and
    /// RimWorld's storyteller (good and bad events from separate lists, fewer bad ones while a village is young or
    /// has just lost someone, more as it grows). The rules, not the code. Everything goes through what is already
    /// there: mood thoughts, the chronicle, news for visitors to carry, relations, the stock and the arrivals.
    ///
    /// - The roll is made once a day after 07:00, on the hearth owner, with EventChancePerDay. A camp (one building)
    ///   has no events.
    /// - Good: a feast after a good harvest (berries and mushrooms into the stock, everyone eats well), a visiting
    ///   skald (a lift for half an hour of game time), a market day at a friendly neighbour (relations up), a lost
    ///   traveller taken in (the next arrival comes at once, if a bed is free).
    /// - Bad: a fever (one villager loses a third of their health and rests it off), beasts at night (everyone sleeps
    ///   badly; with raids on and a player in the village, a real raid), a quarrel between two rivals, a falling-out
    ///   with a neighbour (relations down).
    /// - Bad events: none in a village's first five days, none within three days of a death (half as likely up to
    ///   six), never two within two days, a little more likely for each size tier.
    ///
    /// Runs with WorldLife and VillageEvents on. 'vh event [kind]' makes one happen now, either way.
    /// </summary>
    internal static class VillageEvents
    {
        private static readonly int KeyRolled = "villheim_ev_rolled".GetStableHashCode();
        private static readonly int KeyFirstDay = "villheim_ev_first".GetStableHashCode();
        private static readonly int KeyLastBad = "villheim_ev_lastbad".GetStableHashCode();
        public static readonly int KeyLastLoss = "villheim_ev_lastloss".GetStableHashCode();
        private static readonly int KeyLog = "villheim_ev_log".GetStableHashCode();

        public static readonly string[] Good = { "feast", "skald", "fair", "takenin" };
        public static readonly string[] Bad = { "sickness", "beasts", "quarrel", "dispute" };

        private static readonly string[] Quarrels =
        {
            "a borrowed axe", "who felled the big oak", "the last of the mead", "a fence line", "whose turn it was to fetch water",
            "a song", "a dog", "the right way to stack wood",
        };

        private static readonly string[] Songs =
        {
            "the sea serpent", "a king who lost his boots", "the first winter", "the wolf and the raven", "a ship of nails",
            "the giant who slept under a hill",
        };

        private static bool On => LogicConfig.WorldLife != null && LogicConfig.WorldLife.Value &&
                                  (LogicConfig.VillageEvents == null || LogicConfig.VillageEvents.Value);

        private static int Today => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;

        private static float Hour => EnvMan.instance != null ? EnvMan.instance.GetDayFraction() * 24f : 12f;

        /// <summary>Hearth tick: the day's roll.</summary>
        public static void Daily(VillageHearth hearth, VillageState state)
        {
            ZDO zdo = hearth.Zdo;
            if (zdo.GetInt(KeyFirstDay, -1) < 0)
            {
                zdo.Set(KeyFirstDay, Today);
            }

            if (!On || Hour < 7f || zdo.GetInt(KeyRolled, -1) == Today || state.Plots.Count < 2)
            {
                return;
            }

            zdo.Set(KeyRolled, Today);
            float chance = LogicConfig.EventChancePerDay != null ? LogicConfig.EventChancePerDay.Value : 0.35f;
            if (Random.value > chance)
            {
                return;
            }

            float badShare = BadFactor(hearth, state) * 0.45f;
            string[] first = Random.value < badShare ? Bad : Good;
            foreach (string kind in first.OrderBy(_ => Random.value).Concat(Good.OrderBy(_ => Random.value)))
            {
                if (Happen(hearth, state, kind))
                {
                    return;
                }
            }
        }

        /// <summary>0 to about 1.5: how ready the storyteller is to send something bad.</summary>
        private static float BadFactor(VillageHearth hearth, VillageState state)
        {
            ZDO zdo = hearth.Zdo;
            int age = Today - zdo.GetInt(KeyFirstDay, Today);
            int sinceLoss = Today - zdo.GetInt(KeyLastLoss, -100);
            int sinceBad = Today - zdo.GetInt(KeyLastBad, -100);
            if (age < 5 || sinceLoss < 3 || sinceBad < 2)
            {
                return 0f;
            }

            // RimWorld's starting factor (0.7 to 1 over its first forty days), shortened to a Valheim village's pace.
            float start = Mathf.Lerp(0.7f, 1f, Mathf.InverseLerp(5f, 20f, age));
            float loss = sinceLoss < 6 ? 0.5f : 1f;
            float size = 1f + 0.15f * VillageBrain.TierIndex(state.Plots.Count);
            return start * loss * size;
        }

        /// <summary>Makes <paramref name="kind"/> happen if it can. False when it cannot here and now.</summary>
        public static bool Happen(VillageHearth hearth, VillageState state, string kind)
        {
            string text;
            switch (kind)
            {
                case "feast": text = Feast(hearth, state); break;
                case "skald": text = Skald(hearth, state); break;
                case "fair": text = Fair(hearth); break;
                case "takenin": text = TakenIn(hearth, state); break;
                case "sickness": text = Sickness(hearth); break;
                case "beasts": text = Beasts(hearth, state); break;
                case "quarrel": text = Quarrel(hearth); break;
                case "dispute": text = Dispute(hearth); break;
                default: return false;
            }

            if (text == null)
            {
                return false;
            }

            if (Bad.Contains(kind))
            {
                hearth.Zdo.Set(KeyLastBad, Today);
            }

            Chronicle.Add(hearth, text);
            Dialogue.Note(state.Id, kind);
            List<string> log = hearth.Zdo.GetString(KeyLog, "").Split(',').Where(s => s.Length > 0).ToList();
            log.Add(Today + ":" + kind);
            hearth.Zdo.Set(KeyLog, string.Join(",", log.Skip(System.Math.Max(0, log.Count - 8))));
            VillheimPlugin.Log.LogInfo($"{state.Name}: {kind}. {text}");
            return true;
        }

        // ---------------------------------------------------------------- good

        private static string Feast(VillageHearth hearth, VillageState state)
        {
            bool farm = state.Plots.Any(p => Growth.RoleOf(p) == Designs.Role.Farm);
            string[] food = state.Biome == Heightmap.Biome.BlackForest
                ? new[] { "Blueberries", "MushroomYellow", "Mushroom" }
                : new[] { "Raspberry", "Mushroom", "Honey" };
            int amount = farm ? Random.Range(10, 16) : Random.Range(5, 9);
            foreach (string item in food.Take(2))
            {
                if (Materials.Prefab(item) != null)
                {
                    state.Add(item, amount);
                }
            }

            Moods.VillageThink(state.Id, "atewell");
            return farm
                ? "A good harvest. We filled the store with berries and mushrooms and ate together round the fire."
                : "The bushes were heavy this year. We picked all day and ate well that night.";
        }

        private static string Skald(VillageHearth hearth, VillageState state)
        {
            int seed = Random.Range(1, int.MaxValue);
            string name = Names.Villager(seed);
            string from = Personality.FarPlace(seed);
            Moods.VillageThink(state.Id, "blessing");
            return $"{name}, a skald from {from}, sang by our fire about {Songs[Random.Range(0, Songs.Length)]}. Nobody went to bed early.";
        }

        private static string Fair(VillageHearth hearth)
        {
            (string Name, int View)? neighbour = Relations.Nearest(hearth);
            if (neighbour == null || neighbour.Value.View < 30)
            {
                return null;
            }

            Relations.Adjust(hearth, neighbour.Value.Name, 5);
            Moods.VillageThink(hearth.VillageId, "trade");
            return $"Some of us walked to {neighbour.Value.Name} for a market day. We came back with stories and sore feet.";
        }

        private static string TakenIn(VillageHearth hearth, VillageState state)
        {
            if (Beds.Spare(hearth) == 0 || VillageBrain.CountVillagers(state.Id) >= VillageBrain.Capacity(state))
            {
                return null;
            }

            Villager finder = Loaded(hearth.VillageId).Where(v => !Childhood.IsChild(v)).OrderBy(_ => Random.value).FirstOrDefault();
            // The next arrival is due at once; TryPopulate brings them in this tick or the next.
            state.LastArrival = 0.0;
            return finder != null
                ? $"{finder.VillagerName} found a traveler lost in the woods and brought them home. They are staying with us."
                : "A traveler lost in the woods found our fire. They are staying with us.";
        }

        // ---------------------------------------------------------------- bad

        private static string Sickness(VillageHearth hearth)
        {
            if (!LogicConfig.IsOn(LogicConfig.EventFever)) return null;

            Villager sick = Loaded(hearth.VillageId)
                .Where(v => v.m_nview != null && v.m_nview.IsOwner() && v.GetHealthPercentage() > 0.8f)
                .OrderBy(_ => Random.value).FirstOrDefault();
            if (sick == null)
            {
                return null;
            }

            sick.SetHealth(sick.GetHealth() * 0.65f);
            Moods.Think(sick, "hurt");
            return $"{sick.VillagerName} came down with a fever. They are resting it off by the fire.";
        }

        private static string Beasts(VillageHearth hearth, VillageState state)
        {
            Player player = Player.m_localPlayer;
            bool here = player != null && Utils.DistanceXZ(player.transform.position, hearth.transform.position) < VillheimConfig.VillageRadius.Value + 10f;
            if (LogicConfig.VillageRaids != null && LogicConfig.VillageRaids.Value && here)
            {
                Raids.Force(hearth);
                return "Something has been watching us from the trees. The watch says they will come tonight.";
            }

            Moods.VillageThink(state.Id, "sleptrough");
            string what = state.Biome == Heightmap.Biome.BlackForest ? "Greydwarfs" : "Wolves";
            return $"{what} came close in the night. The watch kept the fire high and nobody slept much.";
        }

        private static string Quarrel(VillageHearth hearth)
        {
            foreach (Villager a in Loaded(hearth.VillageId).Where(v => !Childhood.IsChild(v)).OrderBy(_ => Random.value))
            {
                Villager b = Personality.Rival(a);
                if (b == null || b.IsDead() || b.VillageId != a.VillageId)
                {
                    continue;
                }

                Moods.Think(a, "fight");
                Moods.Think(b, "fight");
                return $"{a.VillagerName} and {b.VillagerName} had words over {Quarrels[Random.Range(0, Quarrels.Length)]}. Nobody is taking sides out loud.";
            }

            return null;
        }

        private static string Dispute(VillageHearth hearth)
        {
            (string Name, int View)? neighbour = Relations.Nearest(hearth);
            if (neighbour == null || neighbour.Value.View > 60)
            {
                return null;
            }

            Relations.Adjust(hearth, neighbour.Value.Name, -8);
            return $"We fell out with {neighbour.Value.Name} over {Quarrels[Random.Range(0, Quarrels.Length)]}. It will blow over, or it won't.";
        }

        private static IEnumerable<Villager> Loaded(int villageId) =>
            Character.GetAllCharacters().OfType<Villager>().Where(v => !v.IsDead() && v.VillageId == villageId && !Wanderers.IsWanderer(v));

        // ---------------------------------------------------------------- commands

        /// <summary>'vh event [kind]': something happens in the nearest village now. 'vh events' lists the recent ones.</summary>
        public static string Command(string[] args)
        {
            Player player = Player.m_localPlayer;
            VillageHearth hearth = player != null ? VillageHearth.Closest(player.transform.position, 200f) : null;
            if (hearth == null)
            {
                return "No village within 200 m.";
            }

            if (!hearth.NView.IsOwner())
            {
                hearth.NView.ClaimOwnership();
            }

            var state = new VillageState(hearth.Zdo);
            string kind = args != null && args.Length > 0 ? args[0].ToLowerInvariant() : null;
            if (kind == null)
            {
                foreach (string any in Good.Concat(Bad).OrderBy(_ => Random.value))
                {
                    if (Happen(hearth, state, any))
                    {
                        return $"{state.Name}: {any}. Kinds: {string.Join(", ", Good.Concat(Bad))}.";
                    }
                }

                return "Nothing could happen there now.";
            }

            if (!Good.Contains(kind) && !Bad.Contains(kind))
            {
                return $"Kinds: {string.Join(", ", Good.Concat(Bad))}.";
            }

            return Happen(hearth, state, kind) ? $"{state.Name}: {kind}." : $"A {kind} cannot happen at {state.Name} now (needs a neighbor, a free bed, a rival or a healthy villager nearby).";
        }

        public static string Describe(VillageHearth hearth)
        {
            string log = hearth.Zdo.GetString(KeyLog, "");
            var state = new VillageState(hearth.Zdo);
            return $"events {(On ? "on" : "off")}, bad-event factor {BadFactor(hearth, state):0.00}, recent: {(log.Length > 0 ? log.Replace(",", ", ") : "none")}";
        }
    }
}
