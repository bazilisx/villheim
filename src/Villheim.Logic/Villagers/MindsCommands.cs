using System.Linq;
using System.Text;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Console commands for what villagers think, remember and want: 'vh minds', 'vh feast', 'vh speech',
    /// 'vh goal', 'vh notice'. All work on the nearest villager or village.
    /// </summary>
    internal static class MindsCommands
    {
        private static Villager NearestVillager(Player player) =>
            Character.GetAllCharacters().OfType<Villager>().Where(v => !v.IsDead() && !Wanderers.IsWanderer(v))
                .OrderBy(v => Vector3.Distance(v.transform.position, player.transform.position)).FirstOrDefault();

        private static VillageHearth NearestHearth(Player player) =>
            VillageHearth.All.Where(h => h != null && h.IsValid)
                .OrderBy(h => Vector3.Distance(h.transform.position, player.transform.position)).FirstOrDefault();

        /// <summary>'vh minds': the nearest villager's skills, want, what he knows of you and where he stands; the village's record of you.</summary>
        public static string Minds()
        {
            Player player = Player.m_localPlayer;
            Villager villager = player != null ? NearestVillager(player) : null;
            if (villager == null)
            {
                return "Villheim: no villager nearby.";
            }

            var sb = new StringBuilder();
            sb.Append($"Villheim: {villager.VillagerName}, voice {Dialogue.VoiceOf(villager)}, mood {Moods.Get(villager):0}\n");
            sb.Append($"   skills: {VillagerSkills.Describe(villager)}\n");
            sb.Append($"   {Goals.Describe(villager)}\n");
            string knows = PlayerMemory.DescribeKnows(villager);
            sb.Append($"   knows: {(knows.Length > 0 ? knows : "nothing about any player")}\n");
            sb.Append($"   sees: {string.Join(" ", Context.Tags(villager))}\n");
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth != null && hearth.IsValid)
            {
                sb.Append($"   {hearth.VillageName} remembers you: {PlayerMemory.Describe(hearth, player)}\n");
                sb.Append($"   {Gatherings.Describe(hearth.VillageId)}\n");
            }

            string tired = Dialogue.DescribeFatigue();
            sb.Append($"   topics you have heard a lot: {(tired.Length > 0 ? tired : "none")}");
            return sb.ToString();
        }

        /// <summary>'vh feast': tonight is a feast at the nearest village.</summary>
        public static string Feast()
        {
            Player player = Player.m_localPlayer;
            VillageHearth hearth = player != null ? NearestHearth(player) : null;
            if (hearth == null)
            {
                return "Villheim: no village nearby.";
            }

            Gatherings.Noted(hearth.VillageId, "hunt");
            return $"Villheim: {hearth.VillageName} will feast this evening.";
        }

        /// <summary>'vh speech': the evening words at the nearest village now, whatever the hour.</summary>
        public static string Speech()
        {
            Player player = Player.m_localPlayer;
            VillageHearth hearth = player != null ? NearestHearth(player) : null;
            if (hearth == null)
            {
                return "Villheim: no village nearby.";
            }

            return Gatherings.SpeakNow(hearth) ? $"Villheim: someone at {hearth.VillageName} has a few words to say." :
                "Villheim: fewer than two villagers awake within 20 m of the hearth.";
        }

        /// <summary>'vh goal [kind]': show or set the nearest villager's want.</summary>
        public static string Goal(string[] args)
        {
            Player player = Player.m_localPlayer;
            Villager villager = player != null ? NearestVillager(player) : null;
            if (villager == null)
            {
                return "Villheim: no villager nearby.";
            }

            if (args.Length == 0)
            {
                return $"Villheim: {villager.VillagerName} {Goals.Describe(villager)}. Kinds: {string.Join(", ", Goals.Kinds)}.";
            }

            return Goals.Force(villager, args[0].ToLowerInvariant())
                ? $"Villheim: {villager.VillagerName} now wants {args[0]}."
                : $"Villheim: unknown want '{args[0]}'. Kinds: {string.Join(", ", Goals.Kinds)}.";
        }

        /// <summary>'vh notice &lt;event&gt;': the nearest village reacts to an event, to hear its lines.</summary>
        public static string Notice(string[] args)
        {
            Player player = Player.m_localPlayer;
            VillageHearth hearth = player != null ? NearestHearth(player) : null;
            if (hearth == null || args.Length == 0)
            {
                return "Villheim: vh notice <rainstart|stormstart|snowstart|miststart|rainstop|dawn|dusk|bossdown|trophy|playergear|playerbuilt|playerkill|...>";
            }

            Dialogue.Event(hearth.VillageId, args[0].ToLowerInvariant(), player.transform.position);
            return $"Villheim: {hearth.VillageName} reacts to {args[0]} (once a minute per event).";
        }
    }
}
