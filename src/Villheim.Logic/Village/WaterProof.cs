using System.Runtime.CompilerServices;
using HarmonyLib;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Village-built pieces take no rain or water damage (Tyler, 2026-11-08, D-038). The game wears a piece in the
    /// rain or under water only when its m_noRoofWear is set; for a piece with the village mark (Keys.BuiltBy) it is
    /// cleared the first time the piece's wear is updated. Pieces players build are left alone. Setting
    /// WaterProofPieces.
    /// </summary>
    [HarmonyPatch(typeof(WearNTear), nameof(WearNTear.UpdateWear))]
    internal static class WaterProof
    {
        private static readonly ConditionalWeakTable<WearNTear, object> Checked = new ConditionalWeakTable<WearNTear, object>();
        private static readonly object Seen = new object();

        private static void Prefix(WearNTear __instance)
        {
            if (!__instance.m_noRoofWear || Checked.TryGetValue(__instance, out _) || !LogicConfig.IsOn(LogicConfig.WaterProofPieces))
            {
                return;
            }

            ZNetView view = __instance.m_nview;
            if (view == null || !view.IsValid())
            {
                return;
            }

            Checked.Add(__instance, Seen);
            if (view.GetZDO().GetInt(Keys.BuiltBy) != 0)
            {
                __instance.m_noRoofWear = false;
            }
        }
    }
}
