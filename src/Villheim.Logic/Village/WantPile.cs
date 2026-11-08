using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Villagers;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The village's want (proposal 9, after Black and White's desire flags and Frostpunk's promises).
    ///
    /// - Once a game hour the hearth's owner notes what the next step is shortest of (NextStep). Nothing is put by the
    ///   chest for it any more (Tyler, 2026-11-08): a pile of wood by the chest looked as if the village had wood, not
    ///   needed it. The hearth's hover text and the board's Needed sign say what is needed. Piles an earlier build put
    ///   there are taken away.
    /// - A promise without a penalty: when the want is filled within a day while a player is near the chest, the
    ///   village takes "promisekept" (+6 for a day) and says so. Ignoring it costs nothing.
    /// - Records on the hearth: what is wanted, how much the chest held then, and the day.
    /// </summary>
    internal static class WantPile
    {
        private static readonly int KeyShown = "villheim_want_mat".GetStableHashCode();
        private static readonly int KeySpot = "villheim_want_pos".GetStableHashCode();
        private static readonly int KeyPosted = "villheim_want_had".GetStableHashCode();
        private static readonly int KeyWanted = "villheim_want_amount".GetStableHashCode();
        private static readonly int KeyDay = "villheim_want_day".GetStableHashCode();
        private static readonly int KeyAt = "villheim_want_at".GetStableHashCode();
        private static readonly int KeyMark = "villheim_wantpile".GetStableHashCode();

        private static readonly Dictionary<string, string> Piles = new Dictionary<string, string>
        {
            [Materials.Wood] = "wood_stack", [Materials.FineWood] = "wood_fine_stack", [Materials.CoreWood] = "wood_core_stack",
            [Materials.Stone] = "stone_pile",
        };

        private const string Stand = "itemstandh";

        private static bool On => Living.On(LogicConfig.WantPile);

        public static void Tick(VillageHearth hearth, VillageState state, bool now = false)
        {
            ZDO zdo = hearth.Zdo;
            ClearOldPiles(hearth);
            if (!On)
            {
                if (zdo.GetString(KeyShown, "").Length > 0)
                {
                    Remove(hearth);
                }

                return;
            }

            double at = zdo.GetLong(KeyAt) / 10.0;
            if (!now && at > 0.0 && Living.Now >= at && Living.Now - at < VillageBrain.DayLength() / 24.0)
            {
                return;
            }

            zdo.Set(KeyAt, (long)(Living.Now * 10.0));
            Container chest = VillageChest.Find(hearth);
            VillageNeeds needs = VillageNeeds.For(state.Id);
            string shown = zdo.GetString(KeyShown, "");
            // Only what the next step is short of (NextStep): the stock the village keeps for later (fine wood in the
            // Meadows) had shown a fine wood pile by the chest that nothing planned needed (T-11).
            Dictionary<string, int> shortfall = NextStep.Short(hearth, state, NextStep.For(hearth, state));
            string top = shortfall.Count > 0 && chest != null ? shortfall.OrderByDescending(n => n.Value).First().Key : "";

            if (shown.Length > 0 && chest != null)
            {
                CheckPromise(hearth, chest, needs, shown);
            }

            if (top == shown)
            {
                if (top.Length > 0 && Find(hearth) == null)
                {
                    Place(hearth, chest, top);
                }

                return;
            }

            Remove(hearth);
            if (top.Length > 0)
            {
                Place(hearth, chest, top);
                zdo.Set(KeyPosted, VillageChest.Count(chest, top));
                zdo.Set(KeyWanted, shortfall[top]);
                zdo.Set(KeyDay, Living.Today);
            }
        }

        private static void CheckPromise(VillageHearth hearth, Container chest, VillageNeeds needs, string shown)
        {
            ZDO zdo = hearth.Zdo;
            if (Living.Today - zdo.GetInt(KeyDay) > 1)
            {
                return;
            }

            int gained = VillageChest.Count(chest, shown) - zdo.GetInt(KeyPosted);
            bool met = needs == null || !needs.Missing.ContainsKey(shown) || gained >= Mathf.Max(1, zdo.GetInt(KeyWanted));
            Player player = Player.m_localPlayer;
            if (!met || gained <= 0 || player == null || Vector3.Distance(player.transform.position, chest.transform.position) > 40f)
            {
                return;
            }

            // Counted once: the day moves on so the same promise can't be kept twice.
            zdo.Set(KeyDay, -10);
            Moods.VillageThink(hearth.VillageId, "promisekept");
            Dialogue.Note(hearth.VillageId, "promisekept");
            Chronicle.Add(hearth, $"{player.GetPlayerName()} brought the {Materials.Label(shown)} we were short of.");
        }

        /// <summary>
        /// Records the want. Nothing is put by the chest any more (Tyler, 2026-11-08: a pile of a material by the chest
        /// read as the village having it, not needing it; the hearth hover and the board's Needed sign say what is
        /// needed). The promise below still works from the record.
        /// </summary>
        private static void Place(VillageHearth hearth, Container chest, string material)
        {
            if (chest == null)
            {
                return;
            }

            hearth.Zdo.Set(KeyShown, material);
            hearth.Zdo.Set(KeySpot, Vector3.zero);
        }

        /// <summary>Takes away any pile or item stand an earlier build put by the chest (once per village per session).</summary>
        private static void ClearOldPiles(VillageHearth hearth)
        {
            if (!Cleared.Add(hearth.VillageId) || ZNetScene.instance == null)
            {
                return;
            }

            var old = new List<ZNetView>();
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                if (view != null && view.IsValid() && view.GetZDO().GetInt(KeyMark) == hearth.VillageId)
                {
                    old.Add(view);
                }
            }

            foreach (ZNetView view in old)
            {
                view.ClaimOwnership();
                ZNetScene.instance.Destroy(view.gameObject);
            }

            if (old.Count > 0)
            {
                VillheimPlugin.Log.LogInfo($"{hearth.VillageName}: took away {old.Count} want pile(s) by the chest.");
            }
        }

        private static readonly HashSet<int> Cleared = new HashSet<int>();

        /// <summary>The pile can't be taken down with the hammer, and the item can't be taken off the stand.</summary>
        private static void Lock(GameObject made)
        {
            Piece piece = made.GetComponent<Piece>();
            if (piece != null)
            {
                piece.m_canBeRemoved = false;
            }

            ItemStand stand = made.GetComponent<ItemStand>();
            if (stand != null)
            {
                stand.m_canBeRemoved = false;
            }
        }

        private static GameObject Find(VillageHearth hearth)
        {
            Vector3 spot = hearth.Zdo.GetVec3(KeySpot, Vector3.zero);
            if (spot == Vector3.zero)
            {
                return null;
            }

            foreach (Collider collider in Physics.OverlapSphere(spot, 1.5f))
            {
                ZNetView view = collider.GetComponentInParent<ZNetView>();
                if (view != null && view.IsValid() && view.GetZDO().GetInt(KeyMark) == hearth.VillageId)
                {
                    Lock(view.gameObject);
                    return view.gameObject;
                }
            }

            return null;
        }

        private static void Remove(VillageHearth hearth)
        {
            GameObject old = Find(hearth);
            if (old != null)
            {
                ZNetView view = old.GetComponent<ZNetView>();
                view.ClaimOwnership();
                ZNetScene.instance.Destroy(old);
            }

            hearth.Zdo.Set(KeyShown, "");
        }

        public static string Describe(VillageHearth hearth)
        {
            string shown = hearth.Zdo.GetString(KeyShown, "");
            return shown.Length == 0 ? "wants nothing in particular" : $"wants {Materials.Label(shown)} (since day {hearth.Zdo.GetInt(KeyDay)})";
        }
    }
}
