using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// 'vh weather': the game's local weather zones (EnvZone) within 100 m. An EnvZone gives the ground inside it its own
    /// weather (m_environment), seen from outside as a patch of that weather (m_exteriorMesh), and it makes a player
    /// inside it wet while the sky elsewhere is clear. Some locations carry one, so a design copied from a location can
    /// bring one along.
    ///   vh weather            lists them: number, object, weather, distance, design or plot it stands in
    ///   vh weather remove N   takes number N away (Undo, 8, puts it back when it is a saved object)
    /// </summary>
    internal static class LocalWeather
    {
        public static string Run(string[] args)
        {
            Player player = Player.m_localPlayer;
            if (player == null)
            {
                return "Villheim: 'vh weather' needs you in the world.";
            }

            List<EnvZone> zones = Object.FindObjectsOfType<EnvZone>()
                .Where(z => Utils.DistanceXZ(z.transform.position, player.transform.position) < 100f)
                .OrderBy(z => Utils.DistanceXZ(z.transform.position, player.transform.position))
                .ToList();

            if (args.Length >= 2 && args[0].ToLowerInvariant() == "remove")
            {
                if (!int.TryParse(args[1], out int n) || n < 1 || n > zones.Count)
                {
                    return $"Villheim: 'vh weather remove N' takes a number from 'vh weather' (1 to {zones.Count}).";
                }

                EnvZone zone = zones[n - 1];
                ZNetView view = zone.GetComponentInParent<ZNetView>();
                string name = Describe(zone, player);
                if (view != null && view.IsValid())
                {
                    EditHistory.Snapshot snapshot = EditHistory.Take(view);
                    view.ClaimOwnership();
                    ZNetScene.instance.Destroy(view.gameObject);
                    EditHistory.Push("removing a weather zone", () => EditHistory.Restore(snapshot));
                    return $"Villheim: removed {name}. 8 (Undo) puts it back.";
                }

                Object.Destroy(zone.gameObject);
                return $"Villheim: removed {name} (it is not a saved object, so it may come back when the area reloads; Undo cannot bring it back).";
            }

            if (zones.Count == 0)
            {
                return "Villheim: no local weather zone (EnvZone) within 100 m.";
            }

            return "Villheim: local weather zones within 100 m ('vh weather remove N' takes one away):\n" +
                   string.Join("\n", zones.Select((z, i) => $"{i + 1}. {Describe(z, player)}"));
        }

        private static string Describe(EnvZone zone, Player player)
        {
            ZNetView view = zone.GetComponentInParent<ZNetView>();
            GameObject root = view != null ? view.gameObject : zone.gameObject;
            string design = SwapTool.DesignOf(root);
            return $"{Utils.GetPrefabName(root)} ({zone.gameObject.name}), weather {zone.m_environment}{(zone.m_force ? " (forced)" : "")}, " +
                   $"{Utils.DistanceXZ(zone.transform.position, player.transform.position):0} m away" + (design.Length > 0 ? $", in {design}" : "");
        }
    }
}
