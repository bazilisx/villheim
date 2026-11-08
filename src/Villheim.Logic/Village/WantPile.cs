using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Villagers;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The village's want, shown beside the chest (proposal 9, after Black and White's desire flags and Frostpunk's
    /// promises).
    ///
    /// - Once a game hour the hearth's owner looks at what the village is shortest of (VillageNeeds) and puts the
    ///   game's own pile of it next to the chest: a woodpile for wood, the fine and core wood stacks, the stone pile.
    ///   Anything else goes on an item stand. It cannot be taken down with the hammer, and it goes when the want
    ///   changes or is met.
    /// - A promise without a penalty: when the want shown is filled within a day while a player is near the chest, the
    ///   village takes "promisekept" (+6 for a day) and says so. Ignoring it costs nothing.
    /// - Records on the hearth: what is shown, where, how much the chest held when it went up, and the day.
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
            string top = needs != null && needs.Missing.Count > 0 && chest != null
                ? needs.Missing.OrderByDescending(n => n.Value).First().Key
                : "";

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
                zdo.Set(KeyWanted, needs.Missing[top]);
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

        private static void Place(VillageHearth hearth, Container chest, string material)
        {
            bool pile = Piles.TryGetValue(material, out string prefabName);
            GameObject prefab = ZNetScene.instance != null ? ZNetScene.instance.GetPrefab(pile ? prefabName : Stand) : null;
            if (prefab == null && pile)
            {
                pile = false;
                prefab = ZNetScene.instance.GetPrefab(Stand);
            }

            if (prefab == null || chest == null)
            {
                return;
            }

            Vector3 spot = chest.transform.position + chest.transform.right * 1.8f;
            if (ZoneSystem.instance.GetGroundHeight(spot, out float y))
            {
                spot.y = y;
            }

            GameObject made = Object.Instantiate(prefab, spot, chest.transform.rotation);
            ZNetView view = made.GetComponent<ZNetView>();
            if (view == null || !view.IsValid())
            {
                return;
            }

            view.GetZDO().Set(KeyMark, hearth.VillageId);
            view.GetZDO().Set(Keys.BuiltBy, hearth.VillageId);
            if (!pile)
            {
                view.GetZDO().Set(ZDOVars.s_item, material);
            }

            Lock(made);
            hearth.Zdo.Set(KeyShown, material);
            hearth.Zdo.Set(KeySpot, spot);
            VillheimPlugin.Debug($"{hearth.VillageName} shows it wants {Materials.Label(material)}.");
        }

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
            return shown.Length == 0 ? "nothing shown by the chest" : $"shows {Materials.Label(shown)} by the chest (since day {hearth.Zdo.GetInt(KeyDay)})";
        }
    }
}
