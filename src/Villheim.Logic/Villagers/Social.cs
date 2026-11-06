using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// The village notices people. Like a game master who knows the rules behind the screen, it keeps simple records
    /// and lets villagers act on them, so the place feels aware of you:
    ///
    /// - Players are remembered on the hearth: when first met, when last seen, and a reputation that rises with gifts
    ///   of wanted materials to the chest, fighting alongside the village, trading and finishing requests. A player is
    ///   a stranger, known, a friend (reputation 5) or a hero (15); "returning" after two days away.
    /// - A stranger who walks into the village is noticed: the nearest willing villager stops what he is doing, turns,
    ///   walks up and speaks (worriers keep their distance, gruff ones only look). Others glance over. A friend coming
    ///   back after a while gets a welcome.
    /// - Villagers listen: when one speaks, those close by turn to him and some react with a gesture fitting the line
    ///   (a laugh at a joke, a nod, a shrug, a worried look).
    /// - News spreads: what a player did (a gift, a fight, a finished request) is village news for a day, and villagers
    ///   who weren't there bring it up.
    /// - Requests (after MineColonies' citizen interactions and Millenaire's reputation): once a day a villager comes to
    ///   a known player and asks for what the village is short of. Bring it to the chest within the day and the village
    ///   thanks you, pays from what it has (coins first, then a meal) and thinks better of you.
    /// </summary>
    internal static class Social
    {
        private static readonly int KeyPlayers = "villheim_players".GetStableHashCode();
        private static readonly int KeyRequest = "villheim_request".GetStableHashCode();

        public const int FriendAt = 5;
        public const int HeroAt = 15;

        internal sealed class Known
        {
            public long Id;
            public string Name;
            public int Reputation;
            public int FirstDay;
            public int LastDay;
        }

        private sealed class Approach
        {
            public Villager Who;
            public Player Target;
            public string Tag;
            public float Until;
            public bool Spoken;
            public bool KeepAway;
        }

        private sealed class VillageWatch
        {
            public int LastTotal = -1;
            public float NextGreetCheck;
            public readonly Dictionary<long, float> SeenInside = new Dictionary<long, float>();
            public readonly Dictionary<string, float> News = new Dictionary<string, float>();
            public float NextRequest;
        }

        private static readonly Dictionary<int, Approach> Approaches = new Dictionary<int, Approach>();
        private static readonly Dictionary<int, VillageWatch> Watches = new Dictionary<int, VillageWatch>();
        private static readonly ConditionalWeakTable<Villager, LookState> Looks = new ConditionalWeakTable<Villager, LookState>();

        private sealed class LookState
        {
            public Character At;
            public float Until;
        }

        private static VillageWatch Watch(int id)
        {
            if (!Watches.TryGetValue(id, out VillageWatch watch))
            {
                watch = new VillageWatch();
                Watches[id] = watch;
            }

            return watch;
        }

        private static int Today => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;

        // ---------------------------------------------------------------- the players the village knows

        public static List<Known> KnownPlayers(VillageHearth hearth)
        {
            var list = new List<Known>();
            foreach (string entry in hearth.Zdo.GetString(KeyPlayers, "").Split(';'))
            {
                string[] f = entry.Split('|');
                if (f.Length < 5 || !long.TryParse(f[0], out long id))
                {
                    continue;
                }

                list.Add(new Known
                {
                    Id = id, Name = f[1], Reputation = I(f[2]), FirstDay = I(f[3]), LastDay = I(f[4]),
                });
            }

            return list;
        }

        private static void Save(VillageHearth hearth, List<Known> list)
        {
            var sb = new StringBuilder();
            foreach (Known k in list)
            {
                if (sb.Length > 0)
                {
                    sb.Append(';');
                }

                sb.Append(k.Id).Append('|').Append(k.Name.Replace("|", "").Replace(";", "")).Append('|').Append(k.Reputation)
                    .Append('|').Append(k.FirstDay).Append('|').Append(k.LastDay);
            }

            hearth.Zdo.Set(KeyPlayers, sb.ToString());
        }

        public static Known Find(VillageHearth hearth, Player player)
        {
            return player == null ? null : KnownPlayers(hearth).FirstOrDefault(k => k.Id == player.GetPlayerID());
        }

        /// <summary>Changes a player's standing with the village (adding the player to its records if new).</summary>
        public static void AddReputation(VillageHearth hearth, Player player, int amount, string news)
        {
            if (hearth == null || player == null)
            {
                return;
            }

            List<Known> list = KnownPlayers(hearth);
            Known known = list.FirstOrDefault(k => k.Id == player.GetPlayerID());
            if (known == null)
            {
                known = new Known { Id = player.GetPlayerID(), Name = player.GetPlayerName(), FirstDay = Today, LastDay = Today };
                list.Add(known);
            }

            known.Reputation = Mathf.Clamp(known.Reputation + amount, -20, 50);
            Save(hearth, list);
            if (news != null)
            {
                Watch(hearth.VillageId).News[news] = Time.time;
            }

            VillheimPlugin.Debug($"{hearth.VillageName}: {player.GetPlayerName()} reputation {known.Reputation} ({news}).");
        }

        private static void MarkSeen(VillageHearth hearth, Player player, out bool wasStranger, out bool returning)
        {
            List<Known> list = KnownPlayers(hearth);
            Known known = list.FirstOrDefault(k => k.Id == player.GetPlayerID());
            wasStranger = known == null;
            returning = known != null && Today - known.LastDay >= 2;
            if (known == null)
            {
                known = new Known { Id = player.GetPlayerID(), Name = player.GetPlayerName(), FirstDay = Today };
                list.Add(known);
            }

            known.LastDay = Today;
            Save(hearth, list);
        }

        /// <summary>Dialogue tags about the local player and the village's news.</summary>
        public static IEnumerable<string> Tags(VillageHearth hearth)
        {
            Player player = Player.m_localPlayer;
            Known known = Find(hearth, player);
            if (known == null)
            {
                yield return "player:stranger";
            }
            else
            {
                yield return known.Reputation >= HeroAt ? "player:hero" : known.Reputation >= FriendAt ? "player:friend" : "player:known";
                if (known.Reputation < 0) yield return "player:disliked";
                if (Today - known.FirstDay < 1) yield return "player:new";
            }

            VillageWatch watch = Watch(hearth.VillageId);
            foreach (KeyValuePair<string, float> news in watch.News)
            {
                if (Time.time - news.Value < 1800f)
                {
                    yield return "news:" + news.Key;
                }
            }

            Request request = ReadRequest(hearth);
            if (request != null && request.Day == Today)
            {
                yield return request.Done ? "request:done" : "request:open";
            }
        }

        // ---------------------------------------------------------------- village watch (from the hearth's tick)

        /// <summary>Notices players coming in, gifts in the chest, and offers requests. Runs with the hearth.</summary>
        public static void VillageTick(VillageHearth hearth)
        {
            VillageWatch watch = Watch(hearth.VillageId);
            Container chest = VillageChest.Find(hearth);
            Player player = Player.m_localPlayer;
            if (chest != null)
            {
                NoticeGifts(hearth, chest, watch, player);
            }

            if (player == null || player.IsDead() || Time.time < watch.NextGreetCheck)
            {
                return;
            }

            watch.NextGreetCheck = Time.time + 3f;
            float distance = Utils.DistanceXZ(player.transform.position, hearth.transform.position);
            bool inside = distance < Mathf.Min(VillheimConfig.VillageRadius.Value, 45f);
            long id = player.GetPlayerID();
            if (!inside)
            {
                watch.SeenInside.Remove(id);
                return;
            }

            if (!watch.SeenInside.ContainsKey(id))
            {
                // Just walked in.
                watch.SeenInside[id] = Time.time;
                MarkSeen(hearth, player, out bool stranger, out bool returning);
                if ((stranger || returning) && !EnvMan.IsNight())
                {
                    SendGreeter(hearth, player, stranger ? "event:stranger" : "event:returning");
                }

                return;
            }

            OfferRequest(hearth, player, watch);
        }

        /// <summary>Building materials that turned up in the chest without a villager putting them there, with a player beside it.</summary>
        private static void NoticeGifts(VillageHearth hearth, Container chest, VillageWatch watch, Player player)
        {
            int total = VillageChest.TotalMaterials(chest);
            VillageChest.AddedByVillage.TryGetValue(chest.GetInstanceID(), out int byVillage);
            VillageChest.AddedByVillage[chest.GetInstanceID()] = 0;
            int previous = watch.LastTotal;
            watch.LastTotal = total;
            if (previous < 0 || player == null || Vector3.Distance(player.transform.position, chest.transform.position) > 6f)
            {
                return;
            }

            int gift = total - previous - byVillage;
            if (gift < 5)
            {
                return;
            }

            AddReputation(hearth, player, Mathf.Clamp(gift / 10, 1, 5), "gift");
            Request request = ReadRequest(hearth);
            if (request != null && !request.Done && request.Day == Today)
            {
                Container c = chest;
                if (VillageChest.Count(c, request.Material) >= request.Amount + request.Had)
                {
                    FinishRequest(hearth, chest, player, request);
                    return;
                }
            }

            Dialogue.Event(hearth.VillageId, "gift", player.transform.position);
        }

        // ---------------------------------------------------------------- greeting newcomers

        private static void SendGreeter(VillageHearth hearth, Player player, string tag)
        {
            if (Approaches.TryGetValue(hearth.VillageId, out Approach busy) && busy.Who != null && Time.time < busy.Until)
            {
                return;
            }

            // The nearest awake villager who isn't fighting, building or hurt. Gruff ones only look; worriers keep away.
            Villager best = null;
            float bestDistance = 35f;
            foreach (Villager villager in Character.GetAllCharacters().OfType<Villager>())
            {
                if (villager.IsDead() || villager.VillageId != hearth.VillageId || Sleep.IsAsleep(villager) || Healing.IsHealing(villager))
                {
                    continue;
                }

                float distance = Vector3.Distance(villager.transform.position, player.transform.position);
                if (distance < bestDistance)
                {
                    best = villager;
                    bestDistance = distance;
                }
            }

            if (best == null)
            {
                return;
            }

            string voice = Dialogue.VoiceOf(best);
            Approaches[hearth.VillageId] = new Approach
            {
                Who = best, Target = player, Tag = tag, Until = Time.time + 20f, KeepAway = voice == "worrier" && tag == "event:stranger",
            };

            // Everyone close by looks up.
            foreach (Villager other in Character.GetAllCharacters().OfType<Villager>())
            {
                if (other != best && other.VillageId == hearth.VillageId &&
                    Vector3.Distance(other.transform.position, player.transform.position) < 20f)
                {
                    LookAt(other, player, Random.Range(2f, 4f));
                }
            }
        }

        /// <summary>A villager asked to greet or ask something walks up to the player. True while he does.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            HoldLook(villager, ai);
            if (!Approaches.TryGetValue(villager.VillageId, out Approach approach) || approach.Who != villager)
            {
                return false;
            }

            if (approach.Target == null || approach.Target.IsDead() || Time.time > approach.Until)
            {
                Approaches.Remove(villager.VillageId);
                return false;
            }

            Vector3 target = approach.Target.transform.position;
            float distance = Vector3.Distance(villager.transform.position, target);
            float stop = approach.KeepAway ? 7f : 2.6f;
            if (!approach.Spoken && distance > stop + 0.5f && Dialogue.VoiceOf(villager) != "gruff")
            {
                Walker.For(villager).Go(villager, ai, dt, target, stop);
                return true;
            }

            ai.StopMoving();
            ai.LookAt(approach.Target.GetEyePoint());
            if (!approach.Spoken)
            {
                approach.Spoken = true;
                approach.Until = Time.time + 4f;
                string line = Dialogue.LineFor(villager, "talk", approach.Tag) ?? Dialogue.LineFor(villager, "talk");
                Dialogue.Say(villager, line, 6f);
                Poses.Gesture(villager, approach.KeepAway ? "cower" : approach.Tag == "event:stranger" ? "wave" : "cheer");
            }

            return true;
        }

        // ---------------------------------------------------------------- looking and listening

        public static void LookAt(Villager villager, Character at, float seconds)
        {
            LookState look = Looks.GetOrCreateValue(villager);
            look.At = at;
            look.Until = Time.time + seconds;
        }

        private static void HoldLook(Villager villager, VillagerAI ai)
        {
            if (Looks.TryGetValue(villager, out LookState look) && look.At != null && Time.time < look.Until)
            {
                ai.LookAt(look.At.GetEyePoint());
            }
        }

        /// <summary>
        /// A villager said something: those within 8 m turn to him, and some react with a gesture that fits the line's
        /// tone (from the library's ~tone, or from the speaker's voice), as long as they aren't busy with work.
        /// </summary>
        public static void Heard(Villager speaker, string tone)
        {
            foreach (Villager listener in Character.GetAllCharacters().OfType<Villager>())
            {
                if (listener == speaker || listener.IsDead() || listener.VillageId != speaker.VillageId || Sleep.IsAsleep(listener) ||
                    Vector3.Distance(listener.transform.position, speaker.transform.position) > 8f)
                {
                    continue;
                }

                LookAt(listener, speaker, Random.Range(1.5f, 3.5f));
                if (Chores.Describe(listener) != null || Random.value > 0.45f)
                {
                    continue;
                }

                string gesture = Reaction(listener, tone);
                if (gesture != null)
                {
                    Poses.Gesture(listener, gesture);
                }
            }
        }

        private static string Reaction(Villager listener, string tone)
        {
            string voice = Dialogue.VoiceOf(listener);
            float mood = Moods.Get(listener);
            switch (tone)
            {
                case "joke": return voice == "gruff" || mood < 30f ? "nonono" : "laugh";
                case "happy": return mood >= 40f ? (Random.value < 0.5f ? "cheer" : "thumbsup") : null;
                case "sad": return voice == "cheerful" || voice == "carer" ? "comehere" : "despair";
                case "worry": return voice == "worrier" ? "cower" : voice == "gruff" || voice == "wry" ? "shrug" : "nonono";
                case "angry": return voice == "worrier" ? "cower" : "shrug";
                case "proud": return "thumbsup";
                case "point": return "point";
                case "pious": return voice == "devout" ? "bow" : null;
                default: return Random.value < 0.4f ? "thumbsup" : null;
            }
        }

        // ---------------------------------------------------------------- requests

        private sealed class Request
        {
            public int Day;
            public string Material;
            public int Amount;
            public int Had;
            public bool Done;
        }

        private static Request ReadRequest(VillageHearth hearth)
        {
            string[] f = hearth.Zdo.GetString(KeyRequest, "").Split('|');
            if (f.Length < 5)
            {
                return null;
            }

            return new Request { Day = I(f[0]), Material = f[1], Amount = I(f[2]), Had = I(f[3]), Done = f[4] == "1" };
        }

        private static void WriteRequest(VillageHearth hearth, Request r)
        {
            hearth.Zdo.Set(KeyRequest, string.Join("|", r.Day.ToString(CultureInfo.InvariantCulture), r.Material,
                r.Amount.ToString(CultureInfo.InvariantCulture), r.Had.ToString(CultureInfo.InvariantCulture), r.Done ? "1" : "0"));
        }

        /// <summary>The material and amount the village has asked for today, if any (for dialogue fill-ins).</summary>
        public static string RequestText(VillageHearth hearth)
        {
            Request r = ReadRequest(hearth);
            return r != null && r.Day == Today && !r.Done ? $"{r.Amount} {Materials.Label(r.Material)}" : null;
        }

        /// <summary>Once a day, with a known player about, a villager comes and asks for what the village is short of.</summary>
        private static void OfferRequest(VillageHearth hearth, Player player, VillageWatch watch)
        {
            if (Time.time < watch.NextRequest || EnvMan.IsNight())
            {
                return;
            }

            watch.NextRequest = Time.time + 120f;
            Request old = ReadRequest(hearth);
            if (old != null && old.Day == Today || Find(hearth, player) == null)
            {
                return;
            }

            VillageNeeds needs = VillageNeeds.For(hearth.VillageId);
            Container chest = VillageChest.Find(hearth);
            if (needs == null || needs.Missing.Count == 0 || chest == null || Random.value > 0.5f)
            {
                return;
            }

            KeyValuePair<string, int> want = needs.Missing.OrderByDescending(n => n.Value).First();
            var request = new Request
            {
                Day = Today, Material = want.Key, Amount = Mathf.Clamp(want.Value, 5, 30), Had = VillageChest.Count(chest, want.Key),
            };
            WriteRequest(hearth, request);
            Villager asker = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => !v.IsDead() && v.VillageId == hearth.VillageId && !Sleep.IsAsleep(v))
                .OrderByDescending(v => Roles.TradeOf(v) == Roles.Trade.Carpenter)
                .ThenBy(v => Vector3.Distance(v.transform.position, player.transform.position)).FirstOrDefault();
            if (asker != null)
            {
                Approaches[hearth.VillageId] = new Approach { Who = asker, Target = player, Tag = "event:request", Until = Time.time + 25f };
                VillheimPlugin.Debug($"{hearth.VillageName} asks {player.GetPlayerName()} for {request.Amount} {request.Material}.");
            }
        }

        private static void FinishRequest(VillageHearth hearth, Container chest, Player player, Request request)
        {
            request.Done = true;
            WriteRequest(hearth, request);
            AddReputation(hearth, player, 3, "request");

            // Paid from what the village has: coins first, then a cooked meal.
            Inventory inventory = chest.GetInventory();
            string reward = null;
            GameObject coins = ObjectDB.instance.GetItemPrefab("Coins");
            int haveCoins = coins != null ? inventory.CountItems(coins.GetComponent<ItemDrop>().m_itemData.m_shared.m_name) : 0;
            if (haveCoins > 0)
            {
                int pay = Mathf.Min(haveCoins, Mathf.Max(5, request.Amount / 2));
                inventory.RemoveItem(coins.GetComponent<ItemDrop>().m_itemData.m_shared.m_name, pay);
                player.GetInventory().AddItem(coins, pay);
                reward = $"{pay} coins";
            }
            else
            {
                ItemDrop.ItemData meal = inventory.GetAllItems().FirstOrDefault(i => i.m_shared.m_food > 0f && i.m_shared.m_foodBurnTime > 0f);
                if (meal?.m_dropPrefab != null)
                {
                    inventory.RemoveItem(meal.m_shared.m_name, 1);
                    player.GetInventory().AddItem(meal.m_dropPrefab, 1);
                    reward = "a meal";
                }
            }

            player.Message(MessageHud.MessageType.Center,
                $"{hearth.VillageName} thanks you{(reward != null ? $" and gives you {reward}" : "")}.");
            Dialogue.Event(hearth.VillageId, "requestdone", player.transform.position);
        }

        /// <summary>A player stood with the village in a fight (called when one ends with the player close by).</summary>
        public static void FoughtAlongside(VillageHearth hearth, Player player)
        {
            AddReputation(hearth, player, 2, "defended");
        }

        private static int I(string text) => int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out int v) ? v : 0;
    }
}
