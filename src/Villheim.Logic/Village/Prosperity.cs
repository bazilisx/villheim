using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Villagers;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// How well a village is doing, as one number (proposal 1 in docs/LIVING_WORLD_RESEARCH.md, after MineColonies'
    /// raid level and Bannerlord's town prosperity; our own code).
    ///
    /// - prosperity = 5 per grown villager + per building (5 + stage squared / 5) + the chest's worth / 50, times
    ///   (0.5 + village mood / 100). Stage is 1 for a camp up to 4 for a town.
    /// - A villager killed or a raid lost takes 15% off at once (at most 60% in all); it comes back 2% a day.
    /// - Worked out once a game hour by the hearth's owner and kept on the hearth, so the board and other machines
    ///   read the same number.
    /// - Read by: the notice board (shown after the level), visitors (more come to a prosperous village), newcomers
    ///   (come a little sooner), raids (none below ProsperityRaidsFrom, bigger as it grows).
    /// </summary>
    internal static class Prosperity
    {
        private static readonly int KeyValue = "villheim_prosperity".GetStableHashCode();
        private static readonly int KeyHit = "villheim_prosperity_hit".GetStableHashCode();
        private static readonly int KeyHitDay = "villheim_prosperity_hitday".GetStableHashCode();
        private static readonly int KeyAt = "villheim_prosperity_at".GetStableHashCode();

        public static bool On => Living.On(LogicConfig.Prosperity);

        /// <summary>The village's last worked-out prosperity, 0 if none yet.</summary>
        public static int Get(VillageHearth hearth) => hearth != null && hearth.IsValid ? hearth.Zdo.GetInt(KeyValue) : 0;

        public static int Get(int villageId) => Get(VillageHearth.Find(villageId));

        public static float Hit(ZDO zdo) => zdo != null ? zdo.GetFloat(KeyHit) : 0f;

        public static void Tick(VillageHearth hearth, VillageState state)
        {
            if (!On)
            {
                return;
            }

            ZDO zdo = hearth.Zdo;
            double now = Living.Now;
            double last = zdo.GetLong(KeyAt) / 10.0;
            if (last > 0.0 && now >= last && now - last < VillageBrain.DayLength() / 24.0)
            {
                return;
            }

            zdo.Set(KeyAt, (long)(now * 10.0));
            Recover(zdo);
            zdo.Set(KeyValue, Compute(hearth, state));
        }

        public static int Compute(VillageHearth hearth, VillageState state)
        {
            int stage = Living.Stage(state);
            int adults = Character.GetAllCharacters().OfType<Villager>()
                .Count(v => !v.IsDead() && v.VillageId == state.Id && !Childhood.IsChild(v) && !Wanderers.IsWanderer(v));
            float score = 5f * adults + state.Plots.Count * (5f + stage * stage / 5f) + Worth(hearth, state) / 50f;
            score *= 0.5f + VillageMood.Get(state.Id) / 100f;
            score *= 1f - Hit(hearth.Zdo);
            return Mathf.Max(0, Mathf.RoundToInt(score));
        }

        /// <summary>What the chest and the stock are worth, at the village store's prices (1 a coin).</summary>
        private static float Worth(VillageHearth hearth, VillageState state)
        {
            float worth = 0f;
            Container chest = VillageChest.Find(hearth);
            if (chest != null && chest.GetInventory() != null)
            {
                foreach (ItemDrop.ItemData item in chest.GetInventory().GetAllItems())
                {
                    string name = item.m_dropPrefab != null ? item.m_dropPrefab.name : "";
                    if (name == "Coins")
                    {
                        worth += item.m_stack;
                    }
                    else if (Market.Prices.TryGetValue(name, out (int Stack, int Price) deal))
                    {
                        worth += item.m_stack * deal.Price / (float)Mathf.Max(1, deal.Stack);
                    }
                    else if (item.m_shared.m_food > 0f)
                    {
                        worth += item.m_stack * Mathf.Max(2f, item.m_shared.m_food / 6f);
                    }
                    else
                    {
                        worth += item.m_stack * 0.5f;
                    }
                }
            }

            foreach (KeyValuePair<string, int> entry in state.Stock)
            {
                worth += entry.Value * 0.6f;
            }

            return worth;
        }

        /// <summary>A villager was killed or a raid was lost: 15% off at once.</summary>
        public static void Hurt(int villageId, string why)
        {
            VillageHearth hearth = VillageHearth.Find(villageId);
            if (!On || hearth == null || !hearth.IsValid)
            {
                return;
            }

            ZDO zdo = hearth.Zdo;
            float hit = Mathf.Min(0.6f, Hit(zdo) + 0.15f);
            zdo.Set(KeyHit, hit);
            zdo.Set(KeyHitDay, Living.Today);
            zdo.Set(KeyValue, Mathf.RoundToInt(zdo.GetInt(KeyValue) * 0.85f));
            VillheimPlugin.Debug($"{hearth.VillageName}: prosperity falls ({why}), {hit:P0} off.");
        }

        private static void Recover(ZDO zdo)
        {
            int day = zdo.GetInt(KeyHitDay);
            float hit = Hit(zdo);
            if (hit <= 0f || day >= Living.Today)
            {
                return;
            }

            zdo.Set(KeyHit, Mathf.Max(0f, hit - 0.02f * (Living.Today - day)));
            zdo.Set(KeyHitDay, Living.Today);
        }

        public static string Label(int prosperity) =>
            prosperity < 40 ? "poor" : prosperity < 100 ? "modest" : prosperity < 200 ? "thriving" : "rich";

        /// <summary>Visitors: 0.6 to 2 times as likely, from a poor village to a rich one.</summary>
        public static float VisitorFactor(VillageHearth hearth) =>
            On ? Mathf.Clamp(0.6f + Get(hearth) / 150f, 0.6f, 2f) : 1f;

        /// <summary>Newcomers: the wait between arrivals is 0.75 to 1.25 of DaysPerNewVillager.</summary>
        public static double ArrivalFactor(VillageHearth hearth) =>
            On ? Mathf.Clamp(1.25f - Get(hearth) / 400f, 0.75f, 1.25f) : 1.0;

        /// <summary>No raids on a village below ProsperityRaidsFrom.</summary>
        public static bool RaidAllowed(VillageHearth hearth) =>
            !On || Get(hearth) >= (LogicConfig.ProsperityRaidsFrom != null ? LogicConfig.ProsperityRaidsFrom.Value : 75);

        /// <summary>Extra raiders: one per 60 prosperity.</summary>
        public static int RaidExtra(VillageHearth hearth) => On ? Mathf.Min(6, Get(hearth) / 60) : 0;

        public static IEnumerable<string> Tags(VillageHearth hearth)
        {
            if (!On)
            {
                yield break;
            }

            yield return "prosper:" + Label(Get(hearth));
            if (Hit(hearth.Zdo) >= 0.1f)
            {
                yield return "prosper:hit";
            }
        }

        public static string Describe(VillageHearth hearth)
        {
            var state = new VillageState(hearth.Zdo);
            return $"prosperity {Get(hearth)} ({Label(Get(hearth))}), now worked out as {Compute(hearth, state)}, " +
                   $"{Hit(hearth.Zdo):P0} off after losses; visitors x{VisitorFactor(hearth):0.00}, arrivals x{ArrivalFactor(hearth):0.00}, " +
                   $"raids {(RaidAllowed(hearth) ? "possible" : "not yet")} (+{RaidExtra(hearth)} raiders)";
        }

        /// <summary>For 'vh prosperity now': work it out again at once.</summary>
        public static void Refresh(VillageHearth hearth)
        {
            hearth.Zdo.Set(KeyValue, Compute(hearth, new VillageState(hearth.Zdo)));
        }
    }
}
