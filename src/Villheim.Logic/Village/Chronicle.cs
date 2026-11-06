using System.Collections.Generic;
using System.Linq;
using HarmonyLib;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The village's chronicle, after Millenaire 9's village chronicle: a short history kept on the hearth (founding,
    /// each building finished or rebuilt, newcomers, attacks, deaths, a player's help). Read it at the hearth. The last
    /// forty entries are kept.
    ///
    /// Deaths are also mourned, as in MineColonies: everyone in the village takes a heavy thought for a day.
    /// </summary>
    internal static class Chronicle
    {
        private static readonly int KeyChronicle = "villheim_chronicle".GetStableHashCode();
        private const int Keep = 40;

        public static void Add(VillageHearth hearth, string text)
        {
            if (hearth == null || !hearth.IsValid)
            {
                return;
            }

            int day = EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;
            List<string> entries = Entries(hearth);
            if (entries.Count > 0 && entries[entries.Count - 1] == $"Day {day}: {text}")
            {
                return;
            }

            entries.Add($"Day {day}: {text}");
            if (entries.Count > Keep)
            {
                entries.RemoveRange(0, entries.Count - Keep);
            }

            hearth.Zdo.Set(KeyChronicle, string.Join("\n", entries));
        }

        public static void Add(int villageId, string text) => Add(VillageHearth.Find(villageId), text);

        public static List<string> Entries(VillageHearth hearth)
        {
            return hearth.Zdo.GetString(KeyChronicle, "").Split('\n').Where(e => e.Length > 0).ToList();
        }

        /// <summary>Shows the summary and the most recent entries in the game's text window.</summary>
        public static void Show(VillageHearth hearth)
        {
            if (TextViewer.instance == null)
            {
                return;
            }

            var state = new VillageState(hearth.Zdo);
            List<string> entries = Entries(hearth);
            string text = VillageBrain.Summary(hearth) + "\n\n" +
                          (entries.Count == 0 ? "Nothing has been written yet." : string.Join("\n", entries.Skip(Mathf.Max(0, entries.Count - 14))));
            TextViewer.instance.ShowText(TextViewer.Style.Rune, $"The chronicle of {state.Name}", text, false);
        }

        /// <summary>A villager died: written down, and mourned by everyone for about a day.</summary>
        [HarmonyPatch(typeof(Character), nameof(Character.OnDeath))]
        internal static class DeathPatch
        {
            private static void Prefix(Character __instance)
            {
                if (!(__instance is Villager villager) || villager.Zdo == null || !villager.IsOwner())
                {
                    return;
                }

                Add(villager.VillageId, $"{villager.VillagerName} died.");
                Villagers.Moods.VillageThink(villager.VillageId, "mourning");
                Villagers.Dialogue.Note(villager.VillageId, "death");
            }
        }
    }
}
