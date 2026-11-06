using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Village;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Villagers watch what the player does in their village and answer it, the way a game master answers a player's
    /// move from rules the player never sees:
    ///
    /// - a gesture: villagers close by turn and answer in kind (a wave for a wave, a laugh for a laugh, a bow for a bow,
    ///   comfort for a cry), and one of them may say something about it;
    /// - sitting down by the village fire: a villager comes over, sits with you for half a minute and talks;
    /// - coming into the village badly hurt by day: a carer walks over with a cooked meal from the chest;
    /// - arriving late at night: whoever is still up remarks on it.
    ///
    /// Each has its own cool-down, so it happens now and then, not every time.
    /// </summary>
    internal static class PlayerReactions
    {
        private static DateTime _lastEmote;
        private static float _nextSit;
        private static float _nextHurt;
        private static float _nextNight;

        private static readonly Dictionary<string, string> Answer = new Dictionary<string, string>
        {
            ["wave"] = "wave", ["cheer"] = "cheer", ["laugh"] = "laugh", ["bow"] = "bow", ["thumbsup"] = "thumbsup",
            ["point"] = "point", ["nonono"] = "shrug", ["shrug"] = "shrug", ["flex"] = "laugh", ["challenge"] = "challenge",
            ["dance"] = "cheer", ["cry"] = "comehere", ["despair"] = "comehere", ["comehere"] = "wave", ["kneel"] = "bow",
            ["headbang"] = "cheer", ["blowkiss"] = "laugh", ["roar"] = "cower", ["cower"] = "comehere", ["toast"] = "toast",
        };

        public static void Check()
        {
            Player player = Player.m_localPlayer;
            if (player == null || player.IsDead())
            {
                return;
            }

            Villager nearest = Nearest(player, 30f);
            if (nearest == null)
            {
                return;
            }

            int village = nearest.VillageId;
            CheckEmote(player, village);
            CheckSitting(player, village);
            CheckHurt(player, village);
            CheckNight(player, village, nearest);
        }

        private static void CheckEmote(Player player, int village)
        {
            if (Player.LastEmoteTime <= _lastEmote)
            {
                return;
            }

            _lastEmote = Player.LastEmoteTime;
            string emote = (Player.LastEmote ?? "").ToLowerInvariant();
            if ((DateTime.Now - Player.LastEmoteTime).TotalSeconds > 4 || !Answer.TryGetValue(emote, out string answer))
            {
                return;
            }

            List<Villager> close = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => !v.IsDead() && v.VillageId == village && !Sleep.IsAsleep(v) &&
                            Vector3.Distance(v.transform.position, player.transform.position) < 15f)
                .OrderBy(v => Vector3.Distance(v.transform.position, player.transform.position)).Take(Random.value < 0.4f ? 3 : 2).ToList();
            for (int i = 0; i < close.Count; i++)
            {
                Villager villager = close[i];
                Social.LookAt(villager, player, 3f);
                string own = answer;
                string voice = Dialogue.VoiceOf(villager);
                if (emote == "flex" && voice == "young") own = "flex";
                if (emote == "challenge" && Roles.BackgroundOf(villager) != Roles.Background.Protector) own = "cower";
                if (voice == "gruff" && (answer == "cheer" || answer == "laugh")) own = "shrug";
                Poses.Gesture(villager, own);
                if (i == 0 && Random.value < 0.6f)
                {
                    Dialogue.QueueLine(villager, "reply", "emote:" + emote, new[] { "emote:" + emote }, Random.Range(1f, 2f));
                }
            }
        }

        private static void CheckSitting(Player player, int village)
        {
            if (Time.time < _nextSit || !player.InEmote() || (Player.LastEmote ?? "").ToLowerInvariant() != "sit")
            {
                return;
            }

            VillageHearth hearth = VillageHearth.Find(village);
            if (hearth == null || Vector3.Distance(player.transform.position, hearth.transform.position) > 9f)
            {
                return;
            }

            _nextSit = Time.time + 240f;
            Social.SendTo(player, village, "event:sitwithplayer", null, 30f, false,
                v => (Roles.BackgroundOf(v) == Roles.Background.Carer ? 1f : 0f) + (Dialogue.VoiceOf(v) == "cheerful" ? 1f : 0f) +
                     (Dialogue.VoiceOf(v) == "elder" ? 0.5f : 0f));
        }

        private static void CheckHurt(Player player, int village)
        {
            if (Time.time < _nextHurt || EnvMan.IsNight() || player.GetHealthPercentage() > 0.35f)
            {
                return;
            }

            VillageHearth hearth = VillageHearth.Find(village);
            if (hearth == null || Healing.ChestFood(hearth) != true)
            {
                return;
            }

            _nextHurt = Time.time + 600f;
            Social.SendTo(player, village, "event:playerhurt", "comehere", 0f, true,
                v => Roles.BackgroundOf(v) == Roles.Background.Carer ? 2f : Roles.TradeOf(v) == Roles.Trade.Cook ? 1f : 0f);
        }

        private static void CheckNight(Player player, int village, Villager nearest)
        {
            if (Time.time < _nextNight || !EnvMan.IsNight() || Sleep.IsAsleep(nearest) ||
                Vector3.Distance(player.transform.position, nearest.transform.position) > 10f)
            {
                return;
            }

            _nextNight = Time.time + 600f;
            Social.LookAt(nearest, player, 3f);
            Dialogue.QueueLine(nearest, "talk", "event:latevisit", new[] { "event:latevisit" }, 1f);
        }

        private static Villager Nearest(Player player, float within)
        {
            Villager best = null;
            float bestDistance = within;
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character is Villager villager && !villager.IsDead())
                {
                    float distance = Vector3.Distance(villager.transform.position, player.transform.position);
                    if (distance < bestDistance)
                    {
                        best = villager;
                        bestDistance = distance;
                    }
                }
            }

            return best;
        }
    }
}
