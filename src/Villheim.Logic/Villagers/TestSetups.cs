using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// 'vh test hunt|defend|hurt': set up a situation at the nearest village, to watch how villagers deal with it.
    ///
    /// - hunt: three deer and two boar 25 to 40 m from the hearth, and the village wants meat for ten minutes.
    /// - defend [creature] [n]: n creatures (Greydwarf and 2 by default) 30 m out, toward you, coming for the nearest
    ///   villager, so the protectors start at bow range.
    /// - hurt: every loaded villager of the village loses half his health, to watch the healing order.
    /// </summary>
    internal static class TestSetups
    {
        public const string Help =
            "test hunt | test defend [creature] [n] | test hurt: deer and boar 25 to 40 m out and the village wants meat; " +
            "creatures 30 m out (Greydwarf, 2 by default) so protectors start at range; every villager loses half his health";

        public static string Command(string[] args)
        {
            Player player = Player.m_localPlayer;
            VillageHearth hearth = player != null ? VillageHearth.Closest(player.transform.position, 300f) : null;
            if (hearth == null || !hearth.IsValid)
            {
                return "Villheim: no village within 300 m.";
            }

            string verb = args.Length > 0 ? args[0].ToLowerInvariant() : "";
            switch (verb)
            {
                case "hunt": return Hunt(hearth);
                case "defend": return Defend(hearth, player, args.Skip(1).ToArray());
                case "hurt": return Hurt(hearth);
                default: return "Villheim: " + Help + ".";
            }
        }

        private static string Hunt(VillageHearth hearth)
        {
            var made = new List<string>();
            foreach (string name in new[] { "Deer", "Deer", "Deer", "Boar", "Boar" })
            {
                float angle = Random.Range(0f, 360f);
                float distance = Random.Range(25f, 40f);
                Vector3 at = hearth.transform.position + Quaternion.Euler(0f, angle, 0f) * Vector3.forward * distance;
                if (Spawn(name, at) != null)
                {
                    made.Add($"{name} {distance:0} m");
                }
            }

            Hunting.WantMeat(hearth.VillageId, 600f);
            Villager hunter = People(hearth.VillageId).FirstOrDefault(Hunting.IsVillageHunter);
            return $"Villheim: {made.Count} animals round {hearth.VillageName} ({string.Join(", ", made)}). The village wants meat for " +
                   $"ten minutes; its hunter is {(hunter != null ? hunter.VillagerName : "nobody (no grown villager loaded)")}. " +
                   "Turn DebugLog on (9 - Test villages) to see the hunt in the log.";
        }

        private static string Defend(VillageHearth hearth, Player player, string[] args)
        {
            string creature = "Greydwarf";
            int count = 2;
            foreach (string arg in args)
            {
                if (int.TryParse(arg, NumberStyles.Integer, CultureInfo.InvariantCulture, out int n))
                {
                    count = Mathf.Clamp(n, 1, 10);
                }
                else
                {
                    creature = arg;
                }
            }

            GameObject prefab = ZNetScene.instance != null
                ? ZNetScene.instance.m_prefabs.FirstOrDefault(p => p != null && p.name.Equals(creature, System.StringComparison.OrdinalIgnoreCase) &&
                                                                    p.GetComponent<Character>() != null)
                : null;
            if (prefab == null)
            {
                return $"Villheim: no creature called {creature}.";
            }

            Vector3 toward = (player.transform.position - hearth.transform.position).Horizontal();
            toward = toward.sqrMagnitude > 1f ? toward.normalized : Vector3.forward;
            List<Villager> people = People(hearth.VillageId).ToList();
            int made = 0;
            for (int i = 0; i < count; i++)
            {
                Vector3 at = hearth.transform.position + Quaternion.Euler(0f, (i - (count - 1) / 2f) * 8f, 0f) * toward * 30f;
                GameObject spawned = Spawn(prefab.name, at);
                if (spawned == null)
                {
                    continue;
                }

                made++;
                Villager nearest = people.OrderBy(v => Vector3.Distance(v.transform.position, at)).FirstOrDefault();
                if (nearest != null && spawned.TryGetComponent(out MonsterAI ai))
                {
                    ai.SetAlerted(true);
                    ai.m_targetCreature = nearest;
                }
            }

            return $"Villheim: {made} {prefab.name} 30 m from the hearth of {hearth.VillageName}, toward you. Protectors should shoot " +
                   $"first and only close in with the weapon inside FightHoldRange ({LogicConfig.FightHoldRange?.Value ?? 4f:0} m); " +
                   "the others should get out of the way.";
        }

        private static string Hurt(VillageHearth hearth)
        {
            int hurt = 0, skipped = 0;
            foreach (Villager villager in People(hearth.VillageId))
            {
                if (villager.NView == null || !villager.NView.IsOwner())
                {
                    skipped++;
                    continue;
                }

                // Half his health off, and always under half, so the healing before work starts at once.
                villager.SetHealth(Mathf.Max(1f, Mathf.Min(villager.GetHealth() * 0.5f, villager.GetMaxHealth() * 0.49f)));
                hurt++;
            }

            return $"Villheim: {hurt} villagers of {hearth.VillageName} lost half their health" +
                   $"{(skipped > 0 ? $" ({skipped} run by another player's game were left alone)" : "")}. They should take, in order: " +
                   "potions, cooked food, raw food cooked by the most hurt, berries nearby, a hunt by the healthiest, and last a rest by the fire. " +
                   "DebugLog shows each choice.";
        }

        private static IEnumerable<Villager> People(int villageId) =>
            Character.GetAllCharacters().OfType<Villager>().Where(v => !v.IsDead() && v.VillageId == villageId && !Wanderers.IsWanderer(v));

        private static GameObject Spawn(string name, Vector3 at)
        {
            GameObject prefab = ZNetScene.instance != null ? ZNetScene.instance.GetPrefab(name) : null;
            if (prefab == null)
            {
                return null;
            }

            if (ZoneSystem.instance != null && ZoneSystem.instance.GetGroundHeight(at, out float y))
            {
                at.y = y + 0.3f;
            }

            return Object.Instantiate(prefab, at, Quaternion.Euler(0f, Random.Range(0f, 360f), 0f));
        }
    }
}
