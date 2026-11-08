using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// 'vh nosnow [metres]': takes the snow off every building piece round the player (30 m unless given). The game keeps
    /// each piece's snow in its saved data (ZDOVars.s_snow) and draws it with WearNTear.UpdateSnowVisual; this sets it
    /// to none through the piece's own handler (WearNTear.RPC_SetSnow), as the game does when the piece's owner changes it.
    /// </summary>
    internal static class NoSnow
    {
        public static string Run(string[] args)
        {
            Player player = Player.m_localPlayer;
            if (player == null)
            {
                return "Villheim: 'vh nosnow' needs you in the world.";
            }

            float radius = args.Length > 0 && float.TryParse(args[0], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out float r) ? r : 30f;
            int cleared = 0, pieces = 0;
            foreach (WearNTear piece in Object.FindObjectsOfType<WearNTear>())
            {
                if (Utils.DistanceXZ(piece.transform.position, player.transform.position) > radius)
                {
                    continue;
                }

                ZNetView view = piece.GetComponent<ZNetView>();
                if (view == null || !view.IsValid())
                {
                    continue;
                }

                pieces++;
                if (view.GetZDO().GetFloat(ZDOVars.s_snow, 0f) <= 0f)
                {
                    continue;
                }

                view.ClaimOwnership();
                piece.RPC_SetSnow(0L, 0f);
                view.GetZDO().Set(ZDOVars.s_snow, 0f);
                piece.UpdateSnowVisual();
                cleared++;
            }

            return cleared > 0
                ? $"Villheim: snow taken off {cleared} of {pieces} building pieces within {radius:0} m."
                : $"Villheim: none of the {pieces} building pieces within {radius:0} m has snow in its saved data.";
        }
    }
}
