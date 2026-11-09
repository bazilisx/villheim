using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// A player's standing with a village that can fall as well as rise (proposal 5, after Minecraft's reputation,
    /// MCA's bounties and CustomNPC+ factions). The standing is the reputation Social already keeps (gifts, help,
    /// requests up; hitting a villager -2, killing one -15), now allowed down to -100 and coming back ForgivePerDay
    /// points a day.
    ///
    /// - Bands: hero (15 up), friend (5 up), known, disliked (below -10), outcast (below FineBelow, -30), hated (below
    ///   GuardBelow, -60).
    /// - Prices at the village store: x0.85 hero, x0.93 friend, x1 known, x1.2 disliked, x1.35 below FineBelow.
    /// - Below FineBelow the village wants a fine before it trades: 10 coins plus 2 per point under FineBelow. Talk to
    ///   a villager to hear it; crouch and talk to pay. Paying sets the standing to -5 and goes in the chronicle.
    /// - Walking in disliked: the nearest villager comes up and turns you away; hated: up to two protectors arm
    ///   themselves and stand watching you.
    /// - Tags standing:hero/friend/known/disliked/outcast/hated and standing:fined; fill-in {fine}.
    /// </summary>
    internal static class Standing
    {
        private static readonly int KeyForgiven = "villheim_forgiven_day".GetStableHashCode();

        public static bool On => Living.On(LogicConfig.PlayerStanding);

        /// <summary>Fines, cold greetings and guards. Off by default: villages are a place of rest (Tyler, 2026-11-08).</summary>
        private static bool Hostile => On && LogicConfig.Hostility != null && LogicConfig.Hostility.Value;

        /// <summary>The lowest reputation Social keeps.</summary>
        public static int Floor => On ? -100 : -20;

        private static int FineBelow => LogicConfig.FineBelow != null ? LogicConfig.FineBelow.Value : -30;

        private static int GuardBelow => LogicConfig.GuardBelow != null ? LogicConfig.GuardBelow.Value : -60;

        public static int Of(VillageHearth hearth, Player player) =>
            hearth != null && hearth.IsValid && player != null ? Social.Find(hearth, player)?.Reputation ?? 0 : 0;

        public static string Band(int reputation) =>
            reputation >= Social.HeroAt ? "hero" : reputation >= Social.FriendAt ? "friend" : reputation >= -10 ? "known" :
            reputation >= FineBelow ? "disliked" : reputation >= GuardBelow ? "outcast" : "hated";

        public static float PriceFactor(VillageHearth hearth, Player player)
        {
            if (!On || player == null)
            {
                return 1f;
            }

            int rep = Of(hearth, player);
            return rep >= Social.HeroAt ? 0.85f : rep >= Social.FriendAt ? 0.93f : rep >= -10 ? 1f : rep >= FineBelow ? 1.2f : 1.35f;
        }

        /// <summary>The fine the village asks of this player before it trades again, 0 when none.</summary>
        public static int Fine(VillageHearth hearth, Player player)
        {
            if (!Hostile || player == null)
            {
                return 0;
            }

            int rep = Of(hearth, player);
            return rep < FineBelow ? 10 + 2 * (FineBelow - rep) : 0;
        }

        /// <summary>Once a day: bad standings come back a little.</summary>
        public static void Daily(VillageHearth hearth)
        {
            if (!On || hearth.Zdo.GetInt(KeyForgiven, -1) == Living.Today)
            {
                return;
            }

            hearth.Zdo.Set(KeyForgiven, Living.Today);
            int amount = LogicConfig.ForgivePerDay != null ? LogicConfig.ForgivePerDay.Value : 1;
            if (amount > 0)
            {
                Social.Forgive(hearth, amount);
            }
        }

        /// <summary>
        /// Talking to a villager while a fine is owed: he names it, or (crouching) the player pays it. True when the
        /// talk was about the fine.
        /// </summary>
        public static bool Talk(Villager villager, Player player, VillageHearth hearth)
        {
            int fine = Fine(hearth, player);
            if (fine <= 0)
            {
                return false;
            }

            if (!player.IsCrouching())
            {
                Dialogue.Say(villager, Dialogue.LineFor(villager, "talk", "fine", new[] { "fine" }) ??
                                       $"You owe {hearth.VillageName} {fine} coins. Crouch and speak to me when you mean to pay.", 7f);
                Poses.Gesture(villager, "nonono");
                return true;
            }

            string coins = Materials.SharedName("Coins");
            Inventory inventory = player.GetInventory();
            if (coins == null || inventory == null || inventory.CountItems(coins) < fine)
            {
                Dialogue.Say(villager, $"That's not {fine} coins. Come back when it is.", 6f);
                return true;
            }

            inventory.RemoveItem(coins, fine);
            Container chest = VillageChest.Find(hearth);
            if (chest != null)
            {
                VillageChest.Add(chest, "Coins", fine);
            }

            Social.AddReputation(hearth, player, -5 - Of(hearth, player), "finepaid");
            Chronicle.Add(hearth, $"{player.GetPlayerName()} paid a fine of {fine} coins and made peace with {hearth.VillageName}.");
            Dialogue.Note(hearth.VillageId, "finepaid");
            Dialogue.Say(villager, Dialogue.LineFor(villager, "talk", "finepaid", new[] { "finepaid" }) ?? "Paid. We'll say no more about it.", 6f);
            Poses.Gesture(villager, "thumbsup");
            return true;
        }

        /// <summary>The store is shut to a player who owes a fine.</summary>
        public static bool RefusesTrade(VillageHearth hearth, Villager villager, Player player)
        {
            int fine = Fine(hearth, player);
            if (fine <= 0)
            {
                return false;
            }

            Dialogue.Say(villager, Dialogue.LineFor(villager, "talk", "fine", new[] { "fine" }) ??
                                   $"Pay the {fine} coins you owe first. Then we'll talk trade.", 6f);
            return true;
        }

        /// <summary>A player walked in. A disliked one is met coldly, a hated one by armed protectors. True when handled.</summary>
        public static bool Greet(VillageHearth hearth, Player player)
        {
            if (!Hostile || EnvMan.IsNight())
            {
                return false;
            }

            int rep = Of(hearth, player);
            if (rep >= -10)
            {
                return false;
            }

            List<Villager> people = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => !v.IsDead() && v.VillageId == hearth.VillageId && !Sleep.IsAsleep(v) && !Childhood.IsChild(v) &&
                            Vector3.Distance(v.transform.position, player.transform.position) < 45f)
                .OrderBy(v => Vector3.Distance(v.transform.position, player.transform.position)).ToList();
            if (people.Count == 0)
            {
                return true;
            }

            bool hated = rep < GuardBelow;
            Social.SendOne(people[0], player, null, hated ? "event:guard" : "event:unwelcome", "nonono", 20f, 4f, false, 2f);
            if (hated)
            {
                foreach (Villager guard in people.Where(v => v != people[0] && Roles.IsFighter(v)).Take(2))
                {
                    Roles.ArmForHunt(guard);
                    Social.SendOne(guard, player, null, "event:guard", null, 40f, 5f, true, 20f);
                }
            }

            Dialogue.Note(hearth.VillageId, hated ? "guard" : "unwelcome");
            return true;
        }

        public static IEnumerable<string> Tags(VillageHearth hearth)
        {
            Player player = Player.m_localPlayer;
            if (!On || player == null)
            {
                yield break;
            }

            yield return "standing:" + Band(Of(hearth, player));
            if (Fine(hearth, player) > 0)
            {
                yield return "standing:fined";
            }
        }

        public static string Fill(string line, Villager villager)
        {
            if (!line.Contains("{fine}"))
            {
                return line;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            int fine = Fine(hearth, Player.m_localPlayer);
            return line.Replace("{fine}", fine.ToString(CultureInfo.InvariantCulture));
        }

        public static string Describe(VillageHearth hearth, Player player)
        {
            int rep = Of(hearth, player);
            int fine = Fine(hearth, player);
            return $"standing {rep} ({Band(rep)}), prices x{PriceFactor(hearth, player):0.00}" + (fine > 0 ? $", owes a fine of {fine} coins" : "");
        }
    }
}
