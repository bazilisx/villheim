using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// A plot chosen by hand for the village's next building, as in Millénaire (Tyler, 2026-11-09). This is the part
    /// behind the tool: the spot is judged by the same tests the village's own search uses, kept on the hearth, and
    /// taken by the village the next time it looks for a place. The tool itself (made at the notice board, with the
    /// building's size shown on the ground) is still to build; until then the commands below do the same job:
    ///
    ///   vh plot check   what the village would say to building its next project where you stand
    ///   vh plot here    choose where you stand for the next project (door toward the hearth)
    ///   vh plot clear   forget the chosen spot
    /// </summary>
    internal static class PlotPick
    {
        private static readonly int Key = "villheim_plot_pick".GetStableHashCode();

        internal sealed class Pick
        {
            public Role Role;
            public string Design;
            public Vector3 Position;
            public float Yaw;
        }

        public static Pick Read(VillageHearth hearth)
        {
            string[] f = hearth.Zdo.GetString(Key, "").Split('|');
            if (f.Length < 6 || !System.Enum.TryParse(f[0], out Role role))
            {
                return null;
            }

            float F(int i) => float.TryParse(f[i], NumberStyles.Float, CultureInfo.InvariantCulture, out float v) ? v : 0f;
            return new Pick { Role = role, Design = f[1], Position = new Vector3(F(2), F(3), F(4)), Yaw = F(5) };
        }

        public static void Clear(VillageHearth hearth) => hearth.Zdo.Set(Key, "");

        private static void Write(VillageHearth hearth, Pick pick)
        {
            string N(float v) => v.ToString("0.###", CultureInfo.InvariantCulture);
            hearth.Zdo.Set(Key, string.Join("|", pick.Role.ToString(), pick.Design, N(pick.Position.x), N(pick.Position.y), N(pick.Position.z), N(pick.Yaw)));
        }

        /// <summary>
        /// The design the village would build next and how it would stand at a spot, with the verdict of the plot
        /// tests. For the tool's preview: <paramref name="foot"/> is the ground to draw, green when the result is true.
        /// </summary>
        public static bool Judge(VillageHearth hearth, VillageState state, Vector3 at, out Pick pick, out Foot foot, out string why)
        {
            pick = null;
            foot = default;
            Role? role = Growth.PendingRole(hearth, state);
            if (role == null)
            {
                why = "the village has no building planned right now";
                return false;
            }

            List<DesignLibrary.Design> pool = DesignLibrary.PoolFor(state.Biome, role.Value, Cultures.Of(state));
            if (pool.Count == 0)
            {
                why = $"no design for a {VillageBrain.RoleName(role.Value)}";
                return false;
            }

            // The same pick each time for one village and building count, so the preview and the building agree.
            DesignLibrary.Design design = pool.OrderBy(d => d.Name, System.StringComparer.Ordinal)
                .ElementAt(Mathf.Abs(state.Seed + state.Plots.Count * 7919) % pool.Count);
            Vector3 center = hearth.transform.position;
            float yaw = PlotFinder.FaceHearth(at, center, state.Axis) - Doors.Angle(design);
            bool fits = PlotFinder.JudgeAt(center, state.Axis, state.Plots, state.Id, design.Name, design.Radius, design.MaxTerrainDelta,
                at, yaw, out why, out float groundY, out bool clearing);
            bool level = Mathf.Abs(groundY - center.y) <= PlotFinder.LevelTolerance;
            pick = new Pick { Role = role.Value, Design = design.Name, Position = new Vector3(at.x, level ? center.y : groundY, at.z), Yaw = yaw };
            foot = Footprints.Of(design.Name, at, yaw, design.Radius, false);
            if (fits && clearing)
            {
                why = "fits once the trees, rocks or old ruins on it are cleared";
            }

            return fits;
        }

        /// <summary>The chosen plot for this role, if it still passes the tests. A plot that no longer does is dropped.</summary>
        public static bool TryTake(VillageHearth hearth, VillageState state, Role role, out DesignLibrary.Design design, out Vector3 position, out float yaw)
        {
            design = default;
            position = Vector3.zero;
            yaw = 0f;
            Pick pick = Read(hearth);
            if (pick == null || pick.Role != role)
            {
                return false;
            }

            DesignLibrary.Design? found = DesignLibrary.ByName(pick.Design);
            if (found == null || !PlotFinder.JudgeAt(hearth.transform.position, state.Axis, state.Plots, state.Id, pick.Design,
                    found.Value.Radius, found.Value.MaxTerrainDelta, pick.Position, pick.Yaw, out string why, out float _, out bool _))
            {
                VillheimPlugin.Log.LogInfo($"{state.Name}: the spot chosen for the {VillageBrain.RoleName(role)} can't be used now.");
                Clear(hearth);
                return false;
            }

            design = found.Value;
            position = pick.Position;
            yaw = pick.Yaw;
            return true; // kept until ground is broken (the village may still be saving up for it)
        }

        public static string Command(string[] args, Player player)
        {
            VillageHearth hearth = VillageHearth.Closest(player.transform.position, 250f);
            if (hearth == null)
            {
                return "Villheim: no village hearth within 250 m.";
            }

            var state = new VillageState(hearth.Zdo);
            string verb = args.Length > 0 ? args[0].ToLowerInvariant() : "check";
            if (verb == "clear")
            {
                Clear(hearth);
                return $"Villheim: {state.Name} will choose its own spot again.";
            }

            Vector3 at = player.transform.position;
            bool fits = Judge(hearth, state, at, out Pick pick, out Foot foot, out string why);
            if (pick == null)
            {
                return "Villheim: " + why + ".";
            }

            string size = $"{foot.HalfX * 2f:0} x {foot.HalfZ * 2f:0} m";
            string what = $"a {VillageBrain.RoleName(pick.Role)} ({pick.Design}, {size})";
            if (!fits)
            {
                return $"Villheim: {what} does not fit here: {why}.";
            }

            if (verb != "here")
            {
                return $"Villheim: {what} fits here{(why.Length > 0 ? ": " + why : "")}. 'vh plot here' chooses this spot.";
            }

            Write(hearth, pick);
            Growth.ClearAside(hearth);
            PlotFinder.ClearHoldUp(state.Id);
            return $"Villheim: {state.Name} will build {what} here{(why.Length > 0 ? " (" + why + ")" : "")}.";
        }
    }
}
