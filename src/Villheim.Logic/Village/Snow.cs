using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// 'vh snow': the snow on the design under the crosshair, and nothing else. The game keeps each building piece's
    /// snow in its saved data (ZDOVars.s_snow) and draws it with WearNTear.UpdateSnowVisual; this reads and sets it
    /// through the piece's own handler (WearNTear.RPC_SetSnow), as the game does when the piece's owner changes it.
    ///   vh snow            how much snow the aimed design's pieces carry
    ///   vh snow 0          takes it all off the aimed design
    ///   vh snow 0.5        sets every piece of the aimed design to that amount
    ///   vh snow 0 piece    the same for the one piece under the crosshair only
    /// Undo (8) puts the snow back as it was.
    /// </summary>
    internal static class Snow
    {
        public static string Run(string[] args)
        {
            Player player = Player.m_localPlayer;
            if (player == null)
            {
                return "Villheim: 'vh snow' needs you in the world.";
            }

            bool onePiece = args.Any(a => a.ToLowerInvariant() == "piece");
            string amountWord = args.FirstOrDefault(a => a.ToLowerInvariant() != "piece");
            float? amount = null;
            if (amountWord != null)
            {
                if (!float.TryParse(amountWord, NumberStyles.Float, CultureInfo.InvariantCulture, out float a) || a < 0f)
                {
                    return "Villheim: 'vh snow' shows the snow on the design you aim at; 'vh snow 0' takes it off, 'vh snow 0.5' sets it; add 'piece' for the one piece you aim at.";
                }

                amount = a;
            }

            var pieces = new List<WearNTear>();
            string what;
            if (onePiece)
            {
                WearNTear aimed = LookAt.Target(player)?.GetComponentInParent<WearNTear>();
                if (aimed == null)
                {
                    return "Villheim: aim at a building piece for 'vh snow ... piece'.";
                }

                pieces.Add(aimed);
                what = Utils.GetPrefabName(aimed.gameObject);
            }
            else
            {
                string design = SwapTool.DesignAimed(player);
                if (string.IsNullOrEmpty(design))
                {
                    return "Villheim: aim at a design (or a piece of one) for 'vh snow'.";
                }

                pieces.AddRange(SwapTool.DesignParts(design).Views.Select(v => v.GetComponent<WearNTear>()).Where(w => w != null));
                what = design;
            }

            var valid = pieces.Select(p => (Piece: p, View: p.GetComponent<ZNetView>())).Where(p => p.View != null && p.View.IsValid()).ToList();
            List<float> levels = valid.Select(p => p.View.GetZDO().GetFloat(ZDOVars.s_snow, 0f)).ToList();
            int snowy = levels.Count(l => l > 0f);
            if (amount == null)
            {
                return valid.Count == 0
                    ? $"Villheim: {what} has no building pieces standing near."
                    : $"Villheim: {what}: {snowy} of {valid.Count} building pieces carry snow" + (snowy > 0 ? $" (from {levels.Where(l => l > 0f).Min():0.##} to {levels.Max():0.##})." : ".");
            }

            for (int i = 0; i < valid.Count; i++)
            {
                Set(valid[i].Piece, valid[i].View, amount.Value);
            }

            var before = valid.Select((p, i) => (p.Piece, p.View, Level: levels[i])).ToList();
            EditHistory.Push($"snow on {what}", () =>
            {
                foreach ((WearNTear piece, ZNetView view, float level) in before)
                {
                    if (piece != null && view != null && view.IsValid())
                    {
                        Set(piece, view, level);
                    }
                }
            });

            return $"Villheim: snow on {what} set to {amount.Value:0.##} on {valid.Count} building pieces ({snowy} had snow). 8 (Undo) puts it back.";
        }

        private static void Set(WearNTear piece, ZNetView view, float level)
        {
            view.ClaimOwnership();
            piece.RPC_SetSnow(0L, level);
            view.GetZDO().Set(ZDOVars.s_snow, level);
            piece.UpdateSnowVisual();
        }
    }
}
