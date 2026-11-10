using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// How worn a piece really is, measured the way WearNTear.Repair measures it.
    ///
    /// WearNTear.GetHealthPercentage returns a value cached at Awake that reads the stored health against the piece's
    /// maximum before the world level raises that maximum. On a world past level 0 an intact piece reports below 1
    /// for good, and Repair() then does nothing to it. Reading the stored health against the same maximum Repair uses
    /// makes "worn" mean "mending it would do something".
    ///
    /// From ValheimVillages by myrcutio (CC0), Behaviors/Repair/PieceHealth.cs.
    /// </summary>
    internal static class PieceHealth
    {
        /// <summary>Health as a share (0 to 1) of the piece's current maximum. 1 means whole.</summary>
        public static float Fraction(WearNTear wear)
        {
            if (wear == null || wear.m_health <= 0f)
            {
                return 1f;
            }

            ZNetView view = wear.GetComponent<ZNetView>();
            ZDO zdo = view != null && view.IsValid() ? view.GetZDO() : null;
            return zdo == null ? 1f : Mathf.Clamp01(zdo.GetFloat(ZDOVars.s_health, wear.m_health) / wear.m_health);
        }
    }
}
