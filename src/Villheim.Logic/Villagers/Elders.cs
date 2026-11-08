using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Elders and a life story (proposal 18, after Banished's life stages, MCA's trait inheritance and Medieval
    /// Dynasty).
    ///
    /// - A villager's days in the village count from when he came (or was born). From ElderDays (40, a year of the
    ///   calendar) he is an elder: the chronicle says so, he leaves felling, mining and hauling to others unless he is
    ///   the village's builder, and he tells old stories from the chronicle (tags lifestage:elder, elder:story;
    ///   fill-ins {chronicle}, {chronicleday}, {yearshere}).
    /// - Elders do not die of age by default (D-003). With WorldLife and EldersDieOfAge on, from ElderDeathDays (60) an elder has ElderDeathChance (2%) each morning of
    ///   dying in his sleep: a chronicle line, mourning for everyone, news for the neighbours. No prosperity is lost.
    /// - A child born in the village takes one parent's homeland and the other's pastime (both from the household
    ///   at the birthplace).
    /// </summary>
    internal static class Elders
    {
        private static readonly int KeyJoined = "villheim_joinday".GetStableHashCode();
        private static readonly int KeyNoted = "villheim_eldernoted".GetStableHashCode();

        public static bool On => Living.On(LogicConfig.Elders);

        private static int ElderDays => LogicConfig.ElderDays != null ? LogicConfig.ElderDays.Value : 40;

        /// <summary>Days since the villager came to (or was born in) the village. The first look starts the count.</summary>
        public static int DaysHere(Villager villager)
        {
            ZDO zdo = villager?.Zdo;
            if (zdo == null)
            {
                return 0;
            }

            int joined = zdo.GetInt(KeyJoined, int.MinValue);
            if (joined == int.MinValue)
            {
                int born = zdo.GetInt(Childhood.KeyBorn, -1);
                joined = born >= 0 ? born : Living.Today;
                if (zdo.IsOwner())
                {
                    zdo.Set(KeyJoined, joined);
                }
            }

            return Mathf.Max(0, Living.Today - joined);
        }

        /// <summary>For 'vh elder': pretends the villager came <paramref name="days"/> days ago.</summary>
        public static void SetDaysHere(Villager villager, int days) => villager.Zdo.Set(KeyJoined, Living.Today - days);

        public static bool IsElder(Villager villager) =>
            On && villager != null && !Childhood.IsChild(villager) && !Wanderers.IsWanderer(villager) && DaysHere(villager) >= ElderDays;

        /// <summary>Elders leave the heavy work (felling, mining, carrying) to others, unless they are the builder.</summary>
        public static bool SkipsHeavyWork(Villager villager) => IsElder(villager) && !Chores.IsVillageBuilder(villager);

        /// <summary>Once a day, in the morning. True when the elder died.</summary>
        public static bool Daily(Villager villager, VillageHearth hearth)
        {
            if (!IsElder(villager))
            {
                return false;
            }

            if (!villager.Zdo.GetBool(KeyNoted))
            {
                villager.Zdo.Set(KeyNoted, true);
                Chronicle.Add(hearth, $"{villager.VillagerName} is one of the elders of {hearth.VillageName} now.");
                Dialogue.Note(villager.VillageId, "newelder");
            }

            int deathDays = LogicConfig.ElderDeathDays != null ? LogicConfig.ElderDeathDays.Value : 60;
            float chance = LogicConfig.ElderDeathChance != null ? LogicConfig.ElderDeathChance.Value : 0.02f;
            if (Living.World && Living.On(LogicConfig.ElderDeaths) && DaysHere(villager) >= deathDays &&
                VillageBrain.CountVillagers(villager.VillageId) > 1 && Random.value < chance)
            {
                Die(villager, hearth);
                return true;
            }

            return false;
        }

        /// <summary>A peaceful death of old age.</summary>
        public static void Die(Villager villager, VillageHearth hearth)
        {
            int days = DaysHere(villager);
            Chronicle.Add(hearth, $"{villager.VillagerName} died in the night, old and well loved, after {PlayerMemory.Number(days)} days in {hearth.VillageName}.");
            Moods.VillageThink(villager.VillageId, "mourning");
            Dialogue.Note(villager.VillageId, "elderdeath");
            VillheimPlugin.Log.LogInfo($"{hearth.VillageName}: {villager.VillagerName} died of old age.");
            ZNetScene.instance.Destroy(villager.gameObject);
        }

        /// <summary>A child born at <paramref name="birthplace"/> takes a parent's homeland and the other's pastime.</summary>
        public static void Inherit(Villager child, Plot birthplace)
        {
            if (child?.Zdo == null || birthplace == null)
            {
                return;
            }

            List<Villager> parents = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => v != child && !v.IsDead() && v.VillageId == child.VillageId && !Childhood.IsChild(v) && v.Zdo != null &&
                            Utils.DistanceXZ(v.Zdo.GetVec3(Keys.VillagerHome, Vector3.zero), birthplace.Position) < 3f)
                .Take(2).ToList();
            if (parents.Count == 0)
            {
                return;
            }

            child.Zdo.Set(Personality.KeyHomeland, Personality.Homeland(parents[0]));
            child.Zdo.Set(Cultures.KeyVillager, Cultures.OfVillager(parents[0]));
            child.Zdo.Set(Personality.KeyHobby, Personality.Hobby(parents[parents.Count - 1]));
        }

        public static IEnumerable<string> Tags(Villager villager, VillageHearth hearth)
        {
            if (!IsElder(villager))
            {
                yield break;
            }

            yield return "lifestage:elder";
            if (Chronicle.Entries(hearth).Count >= 4)
            {
                yield return "elder:story";
            }
        }

        public static string Fill(string line, Villager villager)
        {
            if (line.Contains("{yearshere}"))
            {
                int years = DaysHere(villager) / (Calendar.DaysPerSeason * 4);
                line = line.Replace("{yearshere}", years <= 1 ? "a year" : PlayerMemory.Number(years) + " years");
            }

            if (!line.Contains("{chronicle"))
            {
                return line;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            List<string> entries = hearth != null && hearth.IsValid ? Chronicle.Entries(hearth) : new List<string>();
            // An old story: one of the earlier half of what is written.
            string entry = entries.Count > 0 ? entries[Random.Range(0, Mathf.Max(1, entries.Count / 2))] : "Day 1: The hearth was lit.";
            int colon = entry.IndexOf(": ", System.StringComparison.Ordinal);
            string day = colon > 4 ? entry.Substring(4, colon - 4) : "one";
            string text = colon > 0 ? entry.Substring(colon + 2) : entry;
            return line.Replace("{chronicleday}", day).Replace("{chronicle}", text);
        }
    }
}
