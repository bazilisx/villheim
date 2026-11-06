using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// A sign by the hearth that tells passers-by what the village is up to, like Millenaire's village panels: what it
    /// is building or planning next, and what it is short of. Rewritten once a minute.
    /// </summary>
    internal static class NoticeBoard
    {
        public static readonly int Key = "villheim_noticeboard".GetStableHashCode();

        private static readonly Dictionary<int, float> NextUpdate = new Dictionary<int, float>();

        public static void Update(VillageHearth hearth, bool now = false)
        {
            if (!now && NextUpdate.TryGetValue(hearth.VillageId, out float next) && Time.time < next)
            {
                return;
            }

            NextUpdate[hearth.VillageId] = Time.time + 60f;
            Sign board = null;
            foreach (Collider collider in Physics.OverlapSphere(hearth.transform.position, 12f, LayerMask.GetMask("piece", "piece_nonsolid")))
            {
                Sign sign = collider.GetComponentInParent<Sign>();
                ZNetView view = sign != null ? sign.GetComponent<ZNetView>() : null;
                if (view != null && view.IsValid() && view.GetZDO().GetInt(Key) == 1)
                {
                    board = sign;
                    break;
                }
            }

            if (board == null)
            {
                return;
            }

            var state = new VillageState(hearth.Zdo);
            string doing = ConstructionSite.IsActive(hearth.Zdo)
                ? "Building: " + VillageBrain.RoleName(ConstructionSite.Get(hearth.Zdo).Role)
                : "Next: " + Growth.PendingLabel(hearth, state);
            VillageNeeds needs = VillageNeeds.For(hearth.VillageId);
            string wants = needs != null && needs.Missing.Count > 0
                ? "Needs " + string.Join(", ", needs.Missing.OrderByDescending(n => n.Value).Take(2).Select(n => $"{n.Value} {Materials.Label(n.Key)}"))
                : "Needs nothing";
            string text = $"{doing}. {wants}.";
            ZNetView boardView = board.GetComponent<ZNetView>();
            if (boardView.GetZDO().GetString(ZDOVars.s_text, "") != text)
            {
                boardView.ClaimOwnership();
                board.SetText(text);
            }
        }
    }
}
