using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Villagers;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Raids on the village, after Millenaire's and MineColonies' raids: an attack that comes at night, warned of at
    /// dusk, growing with the village. This is what the fence and the protectors are for.
    ///
    /// At dusk, with a player in the village and at least three villagers, there is a chance (RaidChance, 20% by
    /// default as in Millenaire, a little more for a bigger village; never two nights running) that scouts spot
    /// greydwarfs gathering. A while after dark they come from one side, from outside the fence, and head for the
    /// hearth: two plus one per village tier, with elites and a shaman once the village is bigger. When they are all
    /// dead, or at dawn, the raid is over and goes in the chronicle.
    /// </summary>
    internal static class Raids
    {
        private static readonly int KeyLastRaid = "villheim_last_raid".GetStableHashCode();

        private sealed class Raid
        {
            public int Day;
            public bool Warned;
            public bool Spawned;
            public float WarnedAt;
            public Vector3 From;
            public readonly List<Character> Raiders = new List<Character>();
        }

        private static readonly Dictionary<int, Raid> Active = new Dictionary<int, Raid>();
        private static readonly Dictionary<int, int> RolledOnDay = new Dictionary<int, int>();

        /// <summary>For testing: a raid comes to this village tonight (or at once if it is already night).</summary>
        public static void Force(VillageHearth hearth)
        {
            float angle = Random.Range(0f, Mathf.PI * 2f);
            var raid = new Raid { Day = EnvMan.instance != null ? EnvMan.instance.GetDay() : 0, From = new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) };
            Active[hearth.VillageId] = raid;
            Warn(hearth, raid);
            raid.WarnedAt = Time.time - 200f;
        }

        public static bool UnderRaid(int villageId) => Active.TryGetValue(villageId, out Raid raid) && raid.Spawned;

        /// <summary>Called with the hearth's tick (every few seconds).</summary>
        public static void Tick(VillageHearth hearth)
        {
            if (EnvMan.instance == null || LogicConfig.VillageRaids == null || !LogicConfig.VillageRaids.Value)
            {
                return;
            }

            int id = hearth.VillageId;
            float hour = EnvMan.instance.GetDayFraction() * 24f;
            int day = EnvMan.instance.GetDay();
            Player player = Player.m_localPlayer;
            bool playerHere = player != null && Utils.DistanceXZ(player.transform.position, hearth.transform.position) < VillheimConfig.VillageRadius.Value + 10f;

            if (!Active.TryGetValue(id, out Raid raid))
            {
                // Roll once a day at dusk.
                if (hour < 18f || hour > 19.5f || !playerHere || (RolledOnDay.TryGetValue(id, out int rolled) && rolled == day))
                {
                    return;
                }

                RolledOnDay[id] = day;
                var state = new VillageState(hearth.Zdo);
                int lastRaid = hearth.Zdo.GetInt(KeyLastRaid, -10);
                float chance = LogicConfig.RaidChance.Value + VillageBrain.TierIndex(state.Plots.Count) * 0.03f;
                if (VillageBrain.CountVillagers(id) < 3 || day - lastRaid < 2 || Random.value > chance || !Prosperity.RaidAllowed(hearth))
                {
                    return;
                }

                float angle = Random.Range(0f, Mathf.PI * 2f);
                raid = new Raid { Day = day, From = new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) };
                Active[id] = raid;
                hearth.Zdo.Set(KeyLastRaid, day);
                Warn(hearth, raid);
                return;
            }

            if (!raid.Spawned)
            {
                // They come a couple of game hours after the warning, once it's dark.
                if (EnvMan.IsNight() && Time.time - raid.WarnedAt > 120f && playerHere)
                {
                    Spawn(hearth, raid);
                }
                else if (!EnvMan.IsNight() && hour > 6f && hour < 12f)
                {
                    Active.Remove(id); // the night passed without them
                }

                return;
            }

            raid.Raiders.RemoveAll(r => r == null || r.IsDead());
            if (raid.Raiders.Count == 0 || (!EnvMan.IsNight() && hour > 6f && hour < 12f))
            {
                Active.Remove(id);
                bool won = raid.Raiders.Count == 0;
                Chronicle.Add(hearth, won ? "Raiders came in the night and were beaten back." : "Raiders prowled until dawn, then slunk away.");
                Moods.VillageThink(id, won ? "raidwon" : "fight");
                if (!won)
                {
                    Prosperity.Hurt(id, "a raid lost");
                }

                Dialogue.Event(id, "raidover", hearth.transform.position);
            }
        }

        private static void Warn(VillageHearth hearth, Raid raid)
        {
            raid.Warned = true;
            raid.WarnedAt = Time.time;
            string side = Side(raid.From);
            VillageBrain.Announce(hearth, $"Scouts from {hearth.VillageName} have seen greydwarfs gathering to the {side}.");
            Dialogue.Event(hearth.VillageId, "raidwarning", hearth.transform.position);
            Chronicle.Add(hearth, $"Scouts saw raiders gathering to the {side}.");
            VillheimPlugin.Log.LogInfo($"{hearth.VillageName}: a raid is coming from the {side} tonight.");
        }

        private static void Spawn(VillageHearth hearth, Raid raid)
        {
            raid.Spawned = true;
            var state = new VillageState(hearth.Zdo);
            int tier = VillageBrain.TierIndex(state.Plots.Count);
            float ring = Palisade.WantedRadius(hearth, state) + 18f;
            Vector3 origin = hearth.transform.position + raid.From * ring;
            var list = new List<string>();
            for (int i = 0; i < 2 + tier + Prosperity.RaidExtra(hearth); i++)
            {
                list.Add("Greydwarf");
            }

            if (tier >= 2) list.Add("Greydwarf_Elite");
            if (tier >= 3 || state.Biome == Heightmap.Biome.BlackForest) list.Add("Greydwarf_Shaman");

            foreach (string name in list)
            {
                GameObject prefab = ZNetScene.instance.GetPrefab(name);
                if (prefab == null)
                {
                    continue;
                }

                Vector3 spot = origin + new Vector3(Random.Range(-5f, 5f), 0f, Random.Range(-5f, 5f));
                if (ZoneSystem.instance.GetGroundHeight(spot, out float y))
                {
                    spot.y = y + 0.5f;
                }

                GameObject made = Object.Instantiate(prefab, spot, Quaternion.LookRotation(-raid.From));
                Character raider = made.GetComponent<Character>();
                if (raider == null)
                {
                    continue;
                }

                raid.Raiders.Add(raider);
                if (made.TryGetComponent(out MonsterAI ai))
                {
                    ai.SetPatrolPoint(hearth.transform.position);
                    ai.SetHuntPlayer(true);
                }
            }

            VillageBrain.Announce(hearth, $"Raiders are attacking {hearth.VillageName}!");
            Dialogue.Event(hearth.VillageId, "attack", hearth.transform.position);
            VillheimPlugin.Log.LogInfo($"{hearth.VillageName}: {raid.Raiders.Count} raiders spawned at {origin}.");
        }

        private static string Side(Vector3 direction)
        {
            float angle = Mathf.Atan2(direction.x, direction.z) * Mathf.Rad2Deg;
            string[] names = { "north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west" };
            return names[Mathf.RoundToInt(((angle % 360f) + 360f) % 360f / 45f) % 8];
        }
    }
}
