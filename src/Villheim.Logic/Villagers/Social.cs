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
            public Character Target;
            public Vector3? Point;
            public string Tag;
            public float Until;
            public bool Spoken;
            public bool KeepAway;
            public string Gesture;
            public float SitFor;
            public bool GiveFood;
            public float Stop = 2.6f;
            public bool Quiet;
            public float Linger;
            public Vector3? Face;
        }

        private sealed class VillageWatch
        {
            public int LastTotal = -1;
            public float NextGreetCheck;
            public readonly Dictionary<long, float> SeenInside = new Dictionary<long, float>();
            public readonly Dictionary<string, float> News = new Dictionary<string, float>();
            public float NextRequest;
        }

        private static readonly Dictionary<Villager, Approach> Approaches = new Dictionary<Villager, Approach>();

        private static bool VillageBusy(int villageId, string tag) =>
            Approaches.Values.Any(a => a.Who != null && a.Who.VillageId == villageId && a.Tag == tag && Time.time < a.Until);

        private static void Send(Approach approach)
        {
            if (approach.Who != null && !Approaches.ContainsKey(approach.Who))
            {
                Approaches[approach.Who] = approach;
                Walker.For(approach.Who).Reset();
            }
        }
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
            Gatherings.VillageTick(hearth);
            Noticing.VillageTick(hearth);
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
                PlayerMemory.Visited(hearth, player);
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
            PlayerMemory.Gave(hearth, player, gift);
            PayForGift(hearth, chest, player, gift);
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

        /// <summary>
        /// Millenaire's villages buy the goods they need: with coins in the chest (from trading), the village pays a
        /// coin for every three materials a player brings, as far as its coins go.
        /// </summary>
        private static void PayForGift(VillageHearth hearth, Container chest, Player player, int gift)
        {
            GameObject coins = ObjectDB.instance.GetItemPrefab("Coins");
            if (coins == null)
            {
                return;
            }

            string name = coins.GetComponent<ItemDrop>().m_itemData.m_shared.m_name;
            int pay = Mathf.Min(chest.GetInventory().CountItems(name), gift / 3);
            if (pay <= 0)
            {
                return;
            }

            chest.GetInventory().RemoveItem(name, pay);
            player.GetInventory().AddItem(coins, pay);
            player.Message(MessageHud.MessageType.TopLeft, $"{hearth.VillageName} pays you {pay} coins for the materials.");
        }

        // ---------------------------------------------------------------- greeting newcomers

        private static void SendGreeter(VillageHearth hearth, Player player, string tag)
        {
            if (VillageBusy(hearth.VillageId, tag))
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

                // The Jarl counts as 10 m closer: the head of the village greets newcomers when he can.
                float distance = Vector3.Distance(villager.transform.position, player.transform.position) -
                                 (Roles.IsJarl(villager) ? 10f : 0f);
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
            Send(new Approach
            {
                Who = best, Target = player, Tag = tag, Until = Time.time + 20f, KeepAway = voice == "worrier" && tag == "event:stranger",
                Gesture = voice == "worrier" && tag == "event:stranger" ? "cower" : tag == "event:stranger" ? "wave" : "cheer",
            });

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

        /// <summary>
        /// A villager sent somewhere (to greet a player, ask for something, look at a new building, sit by a player at
        /// the fire, bring a hurt player food) walks there, turns, speaks and gestures. True while he does.
        /// </summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            if (Time.frameCount != _checkedFrame)
            {
                _checkedFrame = Time.frameCount;
                PlayerReactions.Check();
            }

            HoldLook(villager, ai);
            if (!Approaches.TryGetValue(villager, out Approach approach))
            {
                return false;
            }

            if ((approach.Target == null && !approach.Point.HasValue) || (approach.Target != null && approach.Target.IsDead()) ||
                Time.time > approach.Until)
            {
                Approaches.Remove(villager);
                return false;
            }

            Vector3 target = approach.Target != null ? approach.Target.transform.position : approach.Point.Value;
            float distance = Utils.DistanceXZ(villager.transform.position, target);
            float stop = approach.KeepAway ? 7f : approach.Stop;
            if (!approach.Spoken && distance > stop + 0.5f && !(Dialogue.VoiceOf(villager) == "gruff" && approach.Tag == "event:stranger"))
            {
                Walker.For(villager).Go(villager, ai, dt, target, stop);
                return true;
            }

            ai.StopMoving();
            Vector3 look = approach.Target != null ? approach.Target.GetEyePoint() : approach.Face ?? target + Vector3.up * 2f;
            ai.LookAt(look);
            if (!approach.Spoken)
            {
                approach.Spoken = true;
                approach.Until = Time.time + Mathf.Max(4f, Mathf.Max(approach.SitFor, approach.Linger));
                if (!approach.Quiet)
                {
                    string line = Dialogue.LineFor(villager, approach.Target is Player ? "talk" : "self", approach.Tag) ??
                                  (approach.Target is Player ? Dialogue.LineFor(villager, "talk") : null);
                    Dialogue.Say(villager, line, 6f);
                }

                if (approach.Gesture != null)
                {
                    Poses.Gesture(villager, approach.Gesture);
                }

                if (approach.GiveFood && approach.Target is Player player)
                {
                    GiveMeal(villager, player);
                }
            }

            if (approach.SitFor > 0f)
            {
                Poses.Hold(villager, Poses.Sit);
            }

            return true;
        }

        private static int _checkedFrame = -1;

        /// <summary>A cooked meal from the village chest into the player's hands.</summary>
        private static void GiveMeal(Villager villager, Player player)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            Container chest = hearth != null && hearth.IsValid ? VillageChest.Find(hearth) : null;
            ItemDrop.ItemData meal = chest?.GetInventory().GetAllItems()
                .FirstOrDefault(i => i.m_shared.m_food > 0f && i.m_shared.m_foodBurnTime > 0f && i.m_dropPrefab != null);
            if (meal == null)
            {
                return;
            }

            chest.GetInventory().RemoveItem(meal.m_shared.m_name, 1);
            player.GetInventory().AddItem(meal.m_dropPrefab, 1);
            player.Message(MessageHud.MessageType.Center, $"{villager.VillagerName} gives you {Localization.instance.Localize(meal.m_shared.m_name)}.");
        }

        // ---------------------------------------------------------------- sending villagers to things

        /// <summary>Up to <paramref name="count"/> idle villagers near a spot walk over to it and react (a new building, a newcomer).</summary>
        public static void Gather(int villageId, Character who, Vector3? point, int count, string tag, string gesture, float within = 30f)
        {
            Vector3 at = who != null ? who.transform.position : point ?? Vector3.zero;
            IEnumerable<Villager> nearest = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => !v.IsDead() && v != who && v.VillageId == villageId && !Sleep.IsAsleep(v) && !Approaches.ContainsKey(v) &&
                            Chores.Describe(v) == null && Utils.DistanceXZ(v.transform.position, at) < within)
                .OrderBy(v => Utils.DistanceXZ(v.transform.position, at)).Take(count);
            float delay = 0f;
            foreach (Villager villager in nearest)
            {
                Send(new Approach
                {
                    Who = villager, Target = who, Point = who == null ? point : null, Tag = tag, Gesture = gesture,
                    Until = Time.time + 25f + delay, Stop = who != null ? 2.4f : 4f + delay,
                });
                delay += 1.5f;
            }
        }

        /// <summary>Whether this villager is on his way to something (a greeting, a gathering...).</summary>
        public static bool IsSent(Villager villager) => villager != null && Approaches.ContainsKey(villager);

        /// <summary>
        /// One villager walks to a person or a spot, stops <paramref name="stop"/> metres short, turns to it, gestures
        /// and (unless <paramref name="quiet"/>) says a line tagged <paramref name="tag"/>, then stays
        /// <paramref name="linger"/> seconds. For gatherings: one speaker, the rest quiet.
        /// </summary>
        public static bool SendOne(Villager villager, Character target, Vector3? point, string tag, string gesture, float seconds,
            float stop, bool quiet, float linger, Vector3? face = null)
        {
            if (villager == null || villager.IsDead() || Approaches.ContainsKey(villager))
            {
                return false;
            }

            Send(new Approach
            {
                Who = villager, Target = target, Point = target == null ? point : null, Tag = tag, Gesture = gesture,
                Until = Time.time + seconds, Stop = stop, Quiet = quiet, Linger = linger, Face = face,
            });
            return true;
        }

        /// <summary>One villager goes to a player: to sit with him, to bring food, to answer an emote.</summary>
        public static bool SendTo(Player player, int villageId, string tag, string gesture, float sitFor = 0f, bool giveFood = false,
            System.Func<Villager, float> preference = null)
        {
            Villager best = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => !v.IsDead() && v.VillageId == villageId && !Sleep.IsAsleep(v) && !Approaches.ContainsKey(v) &&
                            !Healing.IsHealing(v) && Chores.Describe(v) == null &&
                            Vector3.Distance(v.transform.position, player.transform.position) < 25f)
                .OrderByDescending(v => preference != null ? preference(v) : 0f)
                .ThenBy(v => Vector3.Distance(v.transform.position, player.transform.position)).FirstOrDefault();
            if (best == null)
            {
                return false;
            }

            Send(new Approach
            {
                Who = best, Target = player, Tag = tag, Gesture = gesture, SitFor = sitFor, GiveFood = giveFood,
                Until = Time.time + 20f + sitFor, Stop = sitFor > 0f ? 1.8f : 2.4f,
            });
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
            bool replied = false;
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

                // Now and then one listener answers out loud, if the village isn't already busy talking.
                if (tone != null && !replied && Random.value < 0.35f && Dialogue.TakeTurn(speaker.VillageId, 20f, 40f))
                {
                    replied = true;
                    Dialogue.QueueLine(listener, "reply", "tone:" + tone, new[] { "tone:" + tone }, Random.Range(1.6f, 2.6f));
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
                Send(new Approach { Who = asker, Target = player, Tag = "event:request", Until = Time.time + 25f, Gesture = "comehere" });
                VillheimPlugin.Debug($"{hearth.VillageName} asks {player.GetPlayerName()} for {request.Amount} {request.Material}.");
            }
        }

        private static void FinishRequest(VillageHearth hearth, Container chest, Player player, Request request)
        {
            request.Done = true;
            WriteRequest(hearth, request);
            AddReputation(hearth, player, 3, "request");
            PlayerMemory.RequestDone(hearth, player);
            Chronicle.Add(hearth, $"{player.GetPlayerName()} brought the {Materials.Label(request.Material)} we needed.");

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
            PlayerMemory.Defended(hearth, player);
        }

        private static int I(string text) => int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out int v) ? v : 0;
    }
}
