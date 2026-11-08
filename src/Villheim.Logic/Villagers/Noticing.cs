using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Things a village notices as they happen, with a player about (within 60 m of the hearth), so a couple of
    /// villagers remark on them: the weather turning (rain, a storm, snow, mist, the rain stopping), dawn and dusk, a
    /// boss felled anywhere in the world (the whole village is glad, it goes in the chronicle and the evening is a
    /// feast), animals in sight, enemies seen at a distance before they come close, the player's weapon out among
    /// them with nothing to fight (Gothic's "put that away"), the player creeping about, and a boss trophy in his pack.
    ///
    /// Each goes through <see cref="Dialogue.Event"/> (one to three villagers near the player, a few seconds apart,
    /// never the same line) or a single villager's queued line, with its own cool-down. Checked every two seconds.
    /// </summary>
    internal static class Noticing
    {
        private sealed class Watch
        {
            public float Next;
            public string Weather;
            public int DawnDay = -1;
            public int DuskDay = -1;
            public HashSet<string> Bosses;
            public readonly Dictionary<string, float> Cool = new Dictionary<string, float>();
        }

        private static readonly Dictionary<int, Watch> Watches = new Dictionary<int, Watch>();

        private static readonly (string Key, string Name)[] BossKeys =
        {
            ("defeated_eikthyr", "the great stag Eikthyr"), ("defeated_gdking", "the Elder"), ("defeated_bonemass", "Bonemass"),
            ("defeated_dragon", "Moder"), ("defeated_goblinking", "Yagluth"), ("defeated_queen", "the Queen"), ("defeated_fader", "Fader"),
        };

        private static bool Ready(Watch watch, string what, float seconds)
        {
            if (watch.Cool.TryGetValue(what, out float until) && Time.time < until)
            {
                return false;
            }

            watch.Cool[what] = Time.time + seconds;
            return true;
        }

        public static void VillageTick(VillageHearth hearth)
        {
            if (!Watches.TryGetValue(hearth.VillageId, out Watch watch))
            {
                watch = new Watch();
                Watches[hearth.VillageId] = watch;
            }

            if (Time.time < watch.Next || EnvMan.instance == null)
            {
                return;
            }

            watch.Next = Time.time + 2f;
            Bosses(hearth, watch);
            Player player = Player.m_localPlayer;
            if (player == null || player.IsDead() || Vector3.Distance(player.transform.position, hearth.transform.position) > 60f ||
                VillageMood.SecondsSinceThreat(hearth.VillageId) < 30f)
            {
                return;
            }

            int id = hearth.VillageId;
            Weather(id, watch, player);
            DawnAndDusk(id, watch, player);
            PlayerHabits(id, watch, player);
            Sightings(id, watch, player);
        }

        private static void Weather(int id, Watch watch, Player player)
        {
            string env = EnvMan.instance.GetCurrentEnvironment()?.m_name?.ToLowerInvariant() ?? "";
            string now = env.Contains("thunder") ? "storm" : env.Contains("snow") ? "snow" : env.Contains("rain") ? "rain" :
                env.Contains("mist") || env.Contains("fog") ? "mist" : "clear";
            string before = watch.Weather;
            watch.Weather = now;
            if (before == null || before == now || !Ready(watch, "weather", 240f))
            {
                return;
            }

            string kind = now == "clear" && (before == "rain" || before == "storm") ? "rainstop" :
                now == "clear" ? null : now + "start";
            if (kind != null)
            {
                Dialogue.Event(id, kind, player.transform.position);
            }
        }

        private static void DawnAndDusk(int id, Watch watch, Player player)
        {
            float hour = EnvMan.instance.GetDayFraction() * 24f;
            int day = EnvMan.instance.GetDay();
            if (hour >= 5.5f && hour < 6.5f && watch.DawnDay != day)
            {
                watch.DawnDay = day;
                Dialogue.Event(id, "dawn", player.transform.position);
            }
            else if (hour >= 18.5f && hour < 19.5f && watch.DuskDay != day)
            {
                watch.DuskDay = day;
                Dialogue.Event(id, "dusk", player.transform.position);
            }
        }

        private static void Bosses(VillageHearth hearth, Watch watch)
        {
            if (ZoneSystem.instance == null)
            {
                return;
            }

            var now = new HashSet<string>(BossKeys.Where(b => ZoneSystem.instance.GetGlobalKey(b.Key)).Select(b => b.Key));
            if (watch.Bosses == null)
            {
                watch.Bosses = now;
                return;
            }

            foreach (string key in now.Where(k => !watch.Bosses.Contains(k)))
            {
                string name = BossKeys.First(b => b.Key == key).Name;
                Chronicle.Add(hearth, $"Word came that {name} has fallen.");
                Moods.VillageThink(hearth.VillageId, "bossdown");
                Dialogue.Note(hearth.VillageId, "bossdown");
                Dialogue.Event(hearth.VillageId, "bossdown", hearth.transform.position);
            }

            watch.Bosses = now;
        }

        private static Villager NearestTo(int id, Vector3 at, float within) =>
            Character.GetAllCharacters().OfType<Villager>()
                .Where(v => !v.IsDead() && v.VillageId == id && !Sleep.IsAsleep(v) && !Wanderers.IsWanderer(v) &&
                            Vector3.Distance(v.transform.position, at) < within)
                .OrderBy(v => Vector3.Distance(v.transform.position, at)).FirstOrDefault();

        private static void PlayerHabits(int id, Watch watch, Player player)
        {
            Vector3 at = player.transform.position;
            string weapon = Context.WeaponWord(player.GetRightItem());
            bool armed = weapon != null && weapon != "torch" && weapon != "hammer" && weapon != "hoe" && weapon != "cultivator" && weapon != "pickaxe";
            if (armed && !EnvMan.IsNight())
            {
                Villager close = NearestTo(id, at, 5f);
                if (close != null && Ready(watch, "weaponout", 150f))
                {
                    Social.LookAt(close, player, 3f);
                    Dialogue.QueueLine(close, "talk", "event:weaponout", new[] { "event:weaponout", "holding:" + weapon }, 0.8f);
                }
            }

            if (player.IsCrouching())
            {
                Villager close = NearestTo(id, at, 6f);
                if (close != null && Ready(watch, "sneaking", 300f))
                {
                    Social.LookAt(close, player, 3f);
                    Dialogue.QueueLine(close, "talk", "event:sneaking", new[] { "event:sneaking" }, 1f);
                }
            }

            if (player.GetInventory() != null && Ready(watch, "trophycheck", 20f))
            {
                bool trophy = player.GetInventory().GetAllItems().Any(i => i.m_dropPrefab != null &&
                    (i.m_dropPrefab.name == "TrophyEikthyr" || i.m_dropPrefab.name == "TrophyTheElder" || i.m_dropPrefab.name == "TrophyBonemass" ||
                     i.m_dropPrefab.name == "TrophyDragonQueen" || i.m_dropPrefab.name == "TrophyGoblinKing" || i.m_dropPrefab.name == "TrophySeekerQueen"));
                if (trophy && NearestTo(id, at, 12f) != null && Ready(watch, "trophy", 1200f))
                {
                    Dialogue.Event(id, "trophy", at);
                }
            }
        }

        private static void Sightings(int id, Watch watch, Player player)
        {
            if (!Ready(watch, "sightcheck", 6f))
            {
                return;
            }

            Vector3 at = player.transform.position;
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character == null || character.IsDead() || character.IsTamed())
                {
                    continue;
                }

                string word = Context.CreatureWord(character);
                if (word == null)
                {
                    continue;
                }

                float distance = Vector3.Distance(character.transform.position, at);
                bool animal = word == "deer" || word == "boar" || word == "neck" || word == "hare" || word == "lox";
                if (animal && distance < 30f && Ready(watch, "beast", 300f))
                {
                    Villager seer = NearestTo(id, character.transform.position, 30f);
                    if (seer != null && Chores.Describe(seer) == null)
                    {
                        Dialogue.QueueLine(seer, "self", "event:beast", new[] { "event:beast", "sighted:" + word }, 0.5f);
                    }

                    return;
                }

                if (!animal && distance > 25f && distance < 50f)
                {
                    Villager seer = NearestTo(id, character.transform.position, 50f);
                    if (seer != null && BaseAI.IsEnemy(seer, character) && Ready(watch, "enemyfar", 150f))
                    {
                        Dialogue.QueueLine(seer, "self", "event:enemyfar", new[] { "event:enemyfar", "sighted:" + word }, 0.5f);
                        return;
                    }
                }
            }
        }
    }
}
