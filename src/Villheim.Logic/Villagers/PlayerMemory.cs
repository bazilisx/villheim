using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using HarmonyLib;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// What a village remembers about each player, and who among its people knows it.
    ///
    /// The hearth keeps a record per player: how many days he has come, when he was last here, what he gave to the
    /// chest, how many pieces he built nearby, what he killed near the village, whether he died here, fought beside
    /// the village, finished a request, hurt one of its people, and the gear he wore last time.
    ///
    /// Each deed is also known by people: the villagers within 25 m saw it; the others hear of it when one who knows
    /// talks to them in a chat (after Minecraft's gossip, where memories pass from villager to villager and weaken as
    /// they go). A seen deed is remembered four days, a heard one two. Dialogue reads both: "knows:gift" for any
    /// villager who knows, "saw:gift" for a witness, "heard:gift" for one who was told, with {teller} the one who
    /// told him. The hearth record gives "pmem:..." tags (first visit, a regular, away a long time, generous, a
    /// builder, a hunter, died here...) and fill-ins {visits} {daysaway} {given} {lastkill} {builtcount} {kills}.
    /// </summary>
    internal static class PlayerMemory
    {
        private static readonly int KeyMemory = "villheim_pmem".GetStableHashCode();
        private static readonly int KeyKnows = "villheim_knows".GetStableHashCode();

        private static int Today => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;

        // ---------------------------------------------------------------- the hearth's record

        private static Dictionary<long, Dictionary<string, string>> Read(VillageHearth hearth)
        {
            var all = new Dictionary<long, Dictionary<string, string>>();
            foreach (string entry in hearth.Zdo.GetString(KeyMemory, "").Split(';'))
            {
                int colon = entry.IndexOf(':');
                if (colon <= 0 || !long.TryParse(entry.Substring(0, colon), out long id))
                {
                    continue;
                }

                var fields = new Dictionary<string, string>();
                foreach (string part in entry.Substring(colon + 1).Split(','))
                {
                    int eq = part.IndexOf('=');
                    if (eq > 0)
                    {
                        fields[part.Substring(0, eq)] = part.Substring(eq + 1);
                    }
                }

                all[id] = fields;
            }

            return all;
        }

        private static void Write(VillageHearth hearth, Dictionary<long, Dictionary<string, string>> all)
        {
            var sb = new StringBuilder();
            foreach (KeyValuePair<long, Dictionary<string, string>> player in all)
            {
                if (sb.Length > 0) sb.Append(';');
                sb.Append(player.Key.ToString(CultureInfo.InvariantCulture)).Append(':');
                sb.Append(string.Join(",", player.Value.Select(f => f.Key + "=" + f.Value.Replace(",", "").Replace(";", "").Replace(":", ""))));
            }

            hearth.Zdo.Set(KeyMemory, sb.ToString());
        }

        private static Dictionary<string, string> For(VillageHearth hearth, Player player)
        {
            if (hearth == null || !hearth.IsValid || player == null)
            {
                return null;
            }

            Read(hearth).TryGetValue(player.GetPlayerID(), out Dictionary<string, string> fields);
            return fields;
        }

        private static void Change(VillageHearth hearth, Player player, System.Action<Dictionary<string, string>> change)
        {
            // Only the hearth's owner writes its record. A client writing a hearth it does not own sends its whole
            // copy of the hearth, which can undo the owner's newer changes to the stock and the plots.
            if (hearth == null || !hearth.IsValid || player == null || !hearth.NView.IsOwner())
            {
                return;
            }

            Dictionary<long, Dictionary<string, string>> all = Read(hearth);
            if (!all.TryGetValue(player.GetPlayerID(), out Dictionary<string, string> fields))
            {
                fields = new Dictionary<string, string>();
                all[player.GetPlayerID()] = fields;
            }

            change(fields);
            Write(hearth, all);
        }

        private static int Int(Dictionary<string, string> f, string key, int fallback = 0) =>
            f != null && f.TryGetValue(key, out string v) && int.TryParse(v, NumberStyles.Integer, CultureInfo.InvariantCulture, out int n) ? n : fallback;

        private static string Str(Dictionary<string, string> f, string key) => f != null && f.TryGetValue(key, out string v) ? v : null;

        private static void Add(Dictionary<string, string> f, string key, int amount) =>
            f[key] = (Int(f, key) + amount).ToString(CultureInfo.InvariantCulture);

        private static void Set(Dictionary<string, string> f, string key, int value) => f[key] = value.ToString(CultureInfo.InvariantCulture);

        // ---------------------------------------------------------------- what the player does

        /// <summary>The player walked into the village (once a day counts as a visit). Also notes better gear.</summary>
        public static void Visited(VillageHearth hearth, Player player)
        {
            if (!LogicConfig.IsOn(LogicConfig.PlayerMemory)) return;

            bool gearUp = false;
            Change(hearth, player, f =>
            {
                int last = Int(f, "lastday", -1);
                if (last != Today)
                {
                    Add(f, "visits", 1);
                    if (last >= 0) Set(f, "prevday", last);
                    Set(f, "lastday", Today);
                }

                string gear = Context.GearWord(player);
                string before = Str(f, "gear");
                if (before != null && Context.GearRank(gear) > Context.GearRank(before))
                {
                    Set(f, "gearup", Today);
                    gearUp = true;
                }

                f["gear"] = gear;
            });

            Goals.PlayerCame(hearth.VillageId);
            if (gearUp)
            {
                Deed(hearth, player, "gearup", player.transform.position);
                Dialogue.Event(hearth.VillageId, "playergear", player.transform.position);
            }
        }

        public static void Gave(VillageHearth hearth, Player player, int amount)
        {
            if (!LogicConfig.IsOn(LogicConfig.PlayerMemory)) return;

            Change(hearth, player, f =>
            {
                Add(f, "gifts", 1);
                Add(f, "given", amount);
                Set(f, "lastgift", Today);
            });
            Deed(hearth, player, "gift", player.transform.position);
            foreach (Villager witness in Witnesses(hearth.VillageId, player.transform.position, 25f))
            {
                Moods.Think(witness, "playergift");
            }
        }

        public static void RequestDone(VillageHearth hearth, Player player)
        {
            if (!LogicConfig.IsOn(LogicConfig.PlayerMemory)) return;

            Change(hearth, player, f => Add(f, "requests", 1));
            Deed(hearth, player, "request", player.transform.position);
        }

        public static void Defended(VillageHearth hearth, Player player)
        {
            if (!LogicConfig.IsOn(LogicConfig.PlayerMemory)) return;

            Change(hearth, player, f =>
            {
                Add(f, "defended", 1);
                Set(f, "lastdefended", Today);
            });
            Deed(hearth, player, "defended", player.transform.position);
        }

        private static readonly HashSet<string> BigBeasts = new HashSet<string>
        {
            "troll", "bear", "draugr", "wolf", "drake", "fenring", "fuling", "lox", "serpent", "ghost", "great stag",
        };

        private static float _nextBuildEvent;
        private static float _nextKillEvent;

        private static void Built(Piece piece)
        {
            if (!LogicConfig.IsOn(LogicConfig.PlayerMemory)) return;

            Player player = Player.m_localPlayer;
            VillageHearth hearth = player != null ? Near(piece.transform.position, 15f) : null;
            if (hearth == null)
            {
                return;
            }

            int count = 0;
            Change(hearth, player, f =>
            {
                Add(f, "built", 1);
                Set(f, "lastbuilt", Today);
                count = Int(f, "built");
            });
            Deed(hearth, player, "built", piece.transform.position);
            if ((count == 1 || count % 25 == 0) && Time.time > _nextBuildEvent)
            {
                _nextBuildEvent = Time.time + 300f;
                Dialogue.Event(hearth.VillageId, "playerbuilt", piece.transform.position);
            }
        }

        private static void Killed(Character dead, Player player)
        {
            if (!LogicConfig.IsOn(LogicConfig.PlayerMemory)) return;

            VillageHearth hearth = Near(dead.transform.position, 25f);
            if (hearth == null)
            {
                return;
            }

            if (dead is Villager villager)
            {
                if (villager.VillageId == hearth.VillageId)
                {
                    Change(hearth, player, f => { Add(f, "slain", 1); Set(f, "lastslain", Today); });
                    if (hearth.NView.IsOwner()) Social.AddReputation(hearth, player, -15, "slain");
                    Deed(hearth, player, "slain", dead.transform.position);
                }

                return;
            }

            string word = Context.CreatureWord(dead);
            if (word == null)
            {
                return;
            }

            if (dead.IsTamed())
            {
                Change(hearth, player, f => { Add(f, "killedtame", 1); Set(f, "lastkilledtame", Today); });
                Deed(hearth, player, "killedtame", dead.transform.position);
                return;
            }

            bool big = BigBeasts.Contains(word);
            Change(hearth, player, f =>
            {
                Add(f, "kills", 1);
                Set(f, "lastkill", Today);
                f["killword"] = word;
                if (big)
                {
                    Set(f, "lastbigkill", Today);
                    f["bigword"] = word;
                }
            });
            Deed(hearth, player, big ? "bigkill" : "kill", dead.transform.position);
            if (big && Time.time > _nextKillEvent)
            {
                _nextKillEvent = Time.time + 180f;
                Dialogue.Event(hearth.VillageId, "playerkill", dead.transform.position);
            }
        }

        private static void Died(Player player)
        {
            if (!LogicConfig.IsOn(LogicConfig.PlayerMemory)) return;

            VillageHearth hearth = Near(player.transform.position, 40f);
            if (hearth == null)
            {
                return;
            }

            Change(hearth, player, f => { Add(f, "died", 1); Set(f, "lastdied", Today); });
            Deed(hearth, player, "died", player.transform.position);
        }

        private static float _nextHurtNote;

        private static void HurtVillager(Villager villager, Player player)
        {
            if (!LogicConfig.IsOn(LogicConfig.PlayerMemory)) return;

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid || Time.time < _nextHurtNote)
            {
                return;
            }

            _nextHurtNote = Time.time + 20f;
            Change(hearth, player, f => { Add(f, "hurtus", 1); Set(f, "lasthurtus", Today); });
            if (hearth.NView.IsOwner()) Social.AddReputation(hearth, player, -2, "hurtus");
            Deed(hearth, player, "hurtus", villager.transform.position);
            Moods.Think(villager, "playerhurtus");
            Dialogue.QueueLine(villager, "talk", "event:hurtbyplayer", new[] { "event:hurtbyplayer" }, 0.6f);
        }

        /// <summary>The hearth whose village <paramref name="at"/> is in (its radius plus a margin), or null.</summary>
        private static VillageHearth Near(Vector3 at, float margin)
        {
            float radius = VillheimConfig.VillageRadius != null ? VillheimConfig.VillageRadius.Value : 60f;
            VillageHearth hearth = VillageHearth.Closest(at, radius + margin);
            return hearth != null && hearth.IsValid ? hearth : null;
        }

        // ---------------------------------------------------------------- who knows

        private static readonly Dictionary<string, float> SeenDays = new Dictionary<string, float>
        {
            ["gift"] = 4f, ["built"] = 3f, ["kill"] = 2f, ["bigkill"] = 5f, ["died"] = 4f, ["defended"] = 6f,
            ["request"] = 4f, ["hurtus"] = 5f, ["slain"] = 20f, ["killedtame"] = 6f, ["gearup"] = 2f, ["trophy"] = 6f,
        };

        private sealed class Knowing
        {
            public string Deed;
            public float Until;
            public bool Saw;
            public string Teller;
            public string Player;
        }

        private static List<Knowing> Knows(Villager villager)
        {
            var list = new List<Knowing>();
            foreach (string part in (villager.Zdo?.GetString(KeyKnows, "") ?? "").Split(','))
            {
                string[] f = part.Split(':');
                if (f.Length < 5 || !float.TryParse(f[1], NumberStyles.Float, CultureInfo.InvariantCulture, out float until) || until < Today)
                {
                    continue;
                }

                list.Add(new Knowing { Deed = f[0], Until = until, Saw = f[2] == "1", Teller = f[3], Player = f[4] });
            }

            return list;
        }

        private static void SaveKnows(Villager villager, List<Knowing> list)
        {
            if (villager.Zdo == null || villager.m_nview == null || !villager.m_nview.IsOwner())
            {
                return;
            }

            villager.Zdo.Set(KeyKnows, string.Join(",", list.Select(k =>
                $"{k.Deed}:{k.Until.ToString("0.#", CultureInfo.InvariantCulture)}:{(k.Saw ? 1 : 0)}:{Clean(k.Teller)}:{Clean(k.Player)}")));
        }

        private static string Clean(string text) => (text ?? "").Replace(":", "").Replace(",", "");

        private static IEnumerable<Villager> Witnesses(int villageId, Vector3 at, float within) =>
            Character.GetAllCharacters().OfType<Villager>().Where(v => !v.IsDead() && v.VillageId == villageId && v.VillageId != 0 &&
                                                                      !Sleep.IsAsleep(v) && Vector3.Distance(v.transform.position, at) < within);

        /// <summary>Villagers within 25 m of <paramref name="at"/> saw the player do <paramref name="deed"/>.</summary>
        public static void Deed(VillageHearth hearth, Player player, string deed, Vector3 at)
        {
            if (!SeenDays.TryGetValue(deed, out float days))
            {
                return;
            }

            foreach (Villager witness in Witnesses(hearth.VillageId, at, 25f))
            {
                Learn(witness, deed, Today + days, true, "", player.GetPlayerName());
            }
        }

        private static void Learn(Villager villager, string deed, float until, bool saw, string teller, string player)
        {
            List<Knowing> list = Knows(villager);
            Knowing known = list.FirstOrDefault(k => k.Deed == deed && k.Player == Clean(player));
            if (known != null && (known.Saw || !saw) && known.Until >= until)
            {
                return;
            }

            list.RemoveAll(k => k.Deed == deed && k.Player == Clean(player));
            list.Add(new Knowing { Deed = deed, Until = until, Saw = saw, Teller = teller, Player = player });
            SaveKnows(villager, list);
        }

        /// <summary>
        /// Two villagers chat: the listener hears what the speaker knows and he doesn't, for half the time it had
        /// left (at most two days). Returns one deed the speaker passed on, for the chat's opening line, or null.
        /// </summary>
        public static string Gossip(Villager speaker, Villager listener)
        {
            if (!LogicConfig.IsOn(LogicConfig.PlayerMemory) || !LogicConfig.IsOn(LogicConfig.ChatScenes)) return null;

            if (speaker == null || listener == null)
            {
                return null;
            }

            List<Knowing> theirs = Knows(listener);
            string told = null;
            foreach (Knowing k in Knows(speaker))
            {
                if (theirs.Any(t => t.Deed == k.Deed && t.Player == k.Player))
                {
                    continue;
                }

                float left = k.Until - Today;
                if (left < 0.5f)
                {
                    continue;
                }

                Learn(listener, k.Deed, Today + Mathf.Min(2f, left * 0.5f), false, speaker.VillagerName, k.Player);
                told = told ?? k.Deed;
            }

            return told;
        }

        // ---------------------------------------------------------------- dialogue

        public static IEnumerable<string> Tags(VillageHearth hearth, Villager villager)
        {
            if (!LogicConfig.IsOn(LogicConfig.PlayerMemory)) yield break;

            Player player = Player.m_localPlayer;
            if (player == null)
            {
                yield break;
            }

            string name = Clean(player.GetPlayerName());
            foreach (Knowing k in Knows(villager))
            {
                if (k.Player != name)
                {
                    continue;
                }

                yield return "knows:" + k.Deed;
                yield return (k.Saw ? "saw:" : "heard:") + k.Deed;
            }

            Dictionary<string, string> f = For(hearth, player);
            if (f == null)
            {
                yield break;
            }

            int visits = Int(f, "visits");
            yield return visits <= 1 ? "pmem:visits:first" : visits <= 5 ? "pmem:visits:few" : visits < 20 ? "pmem:visits:many" : "pmem:visits:regular";
            int prev = Int(f, "prevday", -1);
            int last = Int(f, "lastday", Today);
            if (prev >= 0 && last == Today)
            {
                int away = Today - prev;
                if (away >= 5) yield return "pmem:away:long";
                else if (away >= 2) yield return "pmem:away:short";
            }

            int gifts = Int(f, "gifts");
            if (gifts > 0) yield return "pmem:giver";
            if (Int(f, "given") >= 100) yield return "pmem:generous";
            if (gifts > 0 && Today - Int(f, "lastgift", -99) <= 1) yield return "pmem:gift:recent";
            if (gifts == 0 && visits >= 4) yield return "pmem:nevergave";
            if (Int(f, "built") >= 10) yield return "pmem:builder";
            if (Int(f, "built") > 0 && Today - Int(f, "lastbuilt", -99) <= 1) yield return "pmem:built:recent";
            if (Int(f, "kills") >= 5) yield return "pmem:hunter";
            if (Int(f, "kills") > 0 && Today - Int(f, "lastkill", -99) <= 1)
            {
                yield return "pmem:kill:recent";
                yield return "pmem:killed:" + (Str(f, "killword") ?? "beast");
            }

            if (Today - Int(f, "lastbigkill", -99) <= 3) yield return "pmem:bigkill";
            if (Today - Int(f, "lastdied", -99) <= 3) yield return "pmem:died";
            if (Int(f, "defended") > 0) yield return "pmem:defender";
            if (Int(f, "requests") > 0) yield return "pmem:helper";
            if (Today - Int(f, "gearup", -99) <= 2) yield return "pmem:gearup";
            if (Today - Int(f, "lasthurtus", -99) <= 3) yield return "pmem:hurtus";
            if (Int(f, "slain") > 0) yield return "pmem:slayer";
            if (Today - Int(f, "lastkilledtame", -99) <= 6) yield return "pmem:killedtame";
        }

        private static readonly string[] Numbers =
        {
            "no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
            "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
        };

        public static string Number(int n) => n >= 0 && n < Numbers.Length ? Numbers[n] : n.ToString(CultureInfo.InvariantCulture);

        public static string Fill(string line, Villager villager)
        {
            if (line.IndexOf('{') < 0)
            {
                return line;
            }

            if (line.Contains("{teller}"))
            {
                string name = Clean(Player.m_localPlayer?.GetPlayerName());
                string teller = Knows(villager).Where(k => !k.Saw && k.Player == name).Select(k => k.Teller).FirstOrDefault();
                line = line.Replace("{teller}", string.IsNullOrEmpty(teller) ? "someone" : teller);
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            Dictionary<string, string> f = For(hearth, Player.m_localPlayer);
            int visits = Int(f, "visits");
            int away = Int(f, "lastday", Today) - Int(f, "prevday", Today);
            return line.Replace("{visits}", visits <= 1 ? "once" : visits == 2 ? "twice" : Number(visits) + " times")
                .Replace("{daysaway}", away <= 1 ? "a day" : Number(away) + " days")
                .Replace("{given}", Number(Int(f, "given")))
                .Replace("{lastkill}", Str(f, "killword") ?? "beast")
                .Replace("{bigkill}", Str(f, "bigword") ?? Str(f, "killword") ?? "beast")
                .Replace("{builtcount}", Number(Int(f, "built")))
                .Replace("{kills}", Number(Int(f, "kills")));
        }

        /// <summary>For the inspect command.</summary>
        public static string Describe(VillageHearth hearth, Player player)
        {
            Dictionary<string, string> f = For(hearth, player);
            return f == null ? "nothing yet" : string.Join(", ", f.Select(p => p.Key + " " + p.Value));
        }

        public static string DescribeKnows(Villager villager) =>
            string.Join(", ", Knows(villager).Select(k => $"{k.Deed} ({(k.Saw ? "saw" : "heard from " + k.Teller)}, {k.Player})"));

        // ---------------------------------------------------------------- hooks

        [HarmonyPatch(typeof(Piece), nameof(Piece.SetCreator))]
        private static class BuiltPatch
        {
            private static void Postfix(Piece __instance)
            {
                try
                {
                    if (Player.m_localPlayer != null && __instance != null && __instance.GetCreator() == Player.m_localPlayer.GetPlayerID())
                    {
                        Built(__instance);
                    }
                }
                catch (System.Exception ex)
                {
                    HookFailed("built", ex);
                }
            }
        }

        [HarmonyPatch(typeof(Character), nameof(Character.OnDeath))]
        private static class DeathPatch
        {
            private static void Prefix(Character __instance)
            {
                try
                {
                    Player player = Player.m_localPlayer;
                    if (player != null && __instance != null && !(__instance is Player) &&
                        __instance.m_lastHit != null && __instance.m_lastHit.GetAttacker() == player)
                    {
                        Killed(__instance, player);
                    }
                }
                catch (System.Exception ex)
                {
                    HookFailed("killed", ex);
                }
            }
        }

        [HarmonyPatch(typeof(Player), nameof(Player.OnDeath))]
        private static class PlayerDeathPatch
        {
            private static void Prefix(Player __instance)
            {
                try
                {
                    if (__instance != null && __instance == Player.m_localPlayer)
                    {
                        Died(__instance);
                    }
                }
                catch (System.Exception ex)
                {
                    HookFailed("died", ex);
                }
            }
        }

        [HarmonyPatch(typeof(Character), nameof(Character.Damage))]
        private static class HitPatch
        {
            private static void Prefix(Character __instance, HitData hit)
            {
                try
                {
                    if (__instance is Villager villager && !Wanderers.IsWanderer(villager) && hit != null &&
                        Player.m_localPlayer != null && hit.GetAttacker() == Player.m_localPlayer && hit.GetTotalDamage() > 0f)
                    {
                        HurtVillager(villager, Player.m_localPlayer);
                    }
                }
                catch (System.Exception ex)
                {
                    HookFailed("hurt", ex);
                }
            }
        }

        private static readonly HashSet<string> HookErrors = new HashSet<string>();

        /// <summary>A hook on a game method must never throw into the game: log it once and carry on.</summary>
        private static void HookFailed(string hook, System.Exception ex)
        {
            if (HookErrors.Add(hook + ex.GetType().Name))
            {
                VillheimPlugin.Log.LogWarning($"Player memory ({hook}): {ex}");
            }
        }
    }
}
