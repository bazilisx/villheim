using System.Collections.Generic;
using System.Linq;
using System.Globalization;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Paths are laid by a villager walking them, as in Millenaire, where laying paths is background work that comes
    /// after real work and before leisure.
    ///
    /// When a building is finished its path (hearth to building, along the village grid) joins the village's queue,
    /// stored on the hearth. One villager at a time takes the first path in the queue, walks it with a hoe and lays it
    /// a metre at a time where he stands. How far he got is stored too, so a fight, the night or a logout only pauses
    /// the path; the next villager carries on from there.
    ///
    /// Over wet ground in a fen-folk or crannog village the path is a boardwalk on poles (Village/Boardwalks, D-038).
    /// </summary>
    internal static class PathLaying
    {
        private static readonly int KeyQueue = "villheim_path_queue".GetStableHashCode();
        private static readonly int KeyIndex = "villheim_path_index".GetStableHashCode();

        private const float Reach = 1.3f;
        private const float SecondsPerStep = 0.9f;

        private sealed class State
        {
            public float NextStep;
            public float GiveUpAt;
            public int Index = -1;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();
        private static readonly Dictionary<int, Villager> Layers = new Dictionary<int, Villager>();
        private static readonly Dictionary<string, List<Vector3>> PointCache = new Dictionary<string, List<Vector3>>();

        /// <summary>Plans the path (PathPlanner) and adds it to the village's queue.</summary>
        public static void Queue(VillageHearth hearth, Vector3 building, float radius, float yaw, float doorAngle = 0f, string design = null)
        {
            var village = new VillageState(hearth.Zdo);
            List<Vector3> route = PathPlanner.Plan(hearth, village.Axis, building, radius, yaw, doorAngle, design);
            PathPlanner.RememberDetours(hearth, building);
            string entry = string.Join(",", F(building.x), F(building.y), F(building.z), F(radius)) + "|" + PathPlanner.Encode(route);
            string queue = hearth.Zdo.GetString(KeyQueue, "");
            hearth.Zdo.Set(KeyQueue, string.IsNullOrEmpty(queue) ? entry : queue + ";" + entry);
        }

        /// <summary>Every cell of every path planned but not yet laid, so a new path can join a planned one.</summary>
        public static HashSet<Vector2Int> QueuedCells(VillageHearth hearth)
        {
            var cells = new HashSet<Vector2Int>();
            foreach (string entry in hearth.Zdo.GetString(KeyQueue, "").Split(';'))
            {
                int bar = entry.IndexOf('|');
                if (bar < 0)
                {
                    continue;
                }

                foreach (Vector3 point in PathPlanner.Decode(entry.Substring(bar + 1)))
                {
                    cells.Add(PathPlanner.Cell(point));
                }
            }

            return cells;
        }

        /// <summary>A path to this building is already waiting to be laid.</summary>
        public static bool IsQueued(VillageHearth hearth, Vector3 building) =>
            hearth.Zdo.GetString(KeyQueue, "").Split(';').Any(e =>
            {
                string[] parts = e.Split('|')[0].Split(',');
                return parts.Length >= 3 && Utils.DistanceXZ(new Vector3(P(parts[0]), 0f, P(parts[2])), building) < 0.5f;
            });

        public static bool IsLaying(Villager villager) =>
            Layers.TryGetValue(villager.VillageId, out Villager layer) && layer == villager;

        /// <summary>True while this villager is laying a path.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            if (EnvMan.IsNight() || !VillheimConfig.BuildPaths.Value)
            {
                Release(villager);
                return false;
            }

            if (Layers.TryGetValue(villager.VillageId, out Villager layer) && layer != null && layer != villager && !layer.IsDead() &&
                States.TryGetValue(layer, out State theirs) && Time.time < theirs.GiveUpAt)
            {
                return false;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid || !Head(hearth, out Vector3 building, out float radius))
            {
                Release(villager);
                return false;
            }

            var village = new VillageState(hearth.Zdo);
            List<Vector3> points = HeadRoute(hearth) ?? Points(hearth.transform.position, village.Axis, building, radius);
            int index = hearth.Zdo.GetInt(KeyIndex);
            if (index >= points.Count)
            {
                Pop(hearth);
                Release(villager);
                VillheimPlugin.Debug($"{villager.VillagerName} finished a path.");
                return false;
            }

            State state = States.GetOrCreateValue(villager);
            if (!IsLaying(villager))
            {
                Layers[villager.VillageId] = villager;
                state.Index = -1;
                VillheimPlugin.Debug($"{villager.VillagerName} goes to lay the path to the building at {building}.");
            }

            if (state.Index != index)
            {
                state.Index = index;
                state.GiveUpAt = Time.time + 30f;
                Walker.For(villager).Reset();
            }

            Vector3 point = points[index];

            // Trees, stumps and rocks on the way are cleared first (Chores clears queued paths): the road runs straight
            // through where they stood (T-12). Loose sticks and stones he picks up himself. He waits a while for the
            // clearing; after ClearWaitSeconds the spot is skipped, as before.
            GameObject clutter = ClutterAt(point);
            if (clutter != null && clutter.TryGetComponent(out Pickable loose) &&
                Utils.DistanceXZ(villager.transform.position, point) < Reach * 2f)
            {
                loose.Interact(villager, false, false);
                clutter = null;
            }

            if (clutter != null && clutter.GetComponent<Pickable>() == null)
            {
                string key = $"{villager.VillageId}:{index}";
                if (!ClearWait.TryGetValue(key, out float since))
                {
                    ClearWait[key] = since = Time.time;
                }

                if (Time.time - since < ClearWaitSeconds)
                {
                    Release(villager);
                    return false;
                }

                ClearWait.Remove(key);
                hearth.Zdo.Set(KeyIndex, index + 1);
                return true;
            }

            if (Utils.DistanceXZ(villager.transform.position, point) > Reach)
            {
                WalkResult step = Walker.For(villager).Go(villager, ai, dt, point, Reach * 0.6f);
                if (step == WalkResult.Walking && Time.time < state.GiveUpAt)
                {
                    return true;
                }

                if (Utils.DistanceXZ(villager.transform.position, point) > Reach * 3f)
                {
                    // Something stands in the way (a tree, a rock): skip that spot.
                    hearth.Zdo.Set(KeyIndex, index + 1);
                    return true;
                }
            }

            ai.StopMoving();
            VillagerLooks.Hold(villager, VillagerLooks.Tool.Hoe);
            Vector3 ahead = index + 1 < points.Count ? points[index + 1] : point;
            ai.LookAt(ahead);
            if (Time.time < state.NextStep)
            {
                return true;
            }

            state.NextStep = Time.time + SecondsPerStep;
            Chores.ToolAnimation(villager, VillagerLooks.Tool.Hoe);
            LayPoint(hearth, point);
            hearth.Zdo.Set(KeyIndex, index + 1);
            state.GiveUpAt = Time.time + 30f;
            return true;
        }

        private const float ClearWaitSeconds = 150f;
        private static readonly Dictionary<string, float> ClearWait = new Dictionary<string, float>();

        /// <summary>A tree, stump, log, rock or loose stick or stone on the spot (Chores.IsClutter), or null.</summary>
        private static GameObject ClutterAt(Vector3 point)
        {
            if (ClearWait.Count > 64)
            {
                ClearWait.Clear();
            }

            foreach (Collider collider in Physics.OverlapSphere(point + Vector3.up * 0.5f, 1.1f))
            {
                ZNetView view = collider.GetComponentInParent<ZNetView>();
                if (view != null && Chores.IsClutter(view.gameObject) && !PathPlanner.BigObstacle(view.gameObject))
                {
                    return view.gameObject;
                }
            }

            return null;
        }

        /// <summary>Lays one metre of path where the point is, and adds it to the village's network.</summary>
        private static void LayPoint(VillageHearth hearth, Vector3 point)
        {
            // A stretch another path already uses is a shared road: laid wider, as a trunk.
            bool shared = PathPlanner.Network(hearth).Contains(PathPlanner.Cell(point));
            // Fen-folk and crannog villages walk on boards over wet ground (D-038); dirt where that fails.
            if (!(Boardwalks.Wants(hearth, point) && Boardwalks.Lay(hearth, point)))
            {
                PathBuilder.PaintAt(point, shared ? PathBuilder.Width * 1.8f : PathBuilder.Width);
            }

            PathPlanner.AddToNetwork(hearth, point);
        }

        /// <summary>
        /// Lays every path in the village's queue at once, the same way a villager would lay it, and empties the queue.
        /// For a village set up at once (TestVillage). Returns how many metres were laid.
        /// </summary>
        public static int LayAllNow(VillageHearth hearth, int most = int.MaxValue)
        {
            var village = new VillageState(hearth.Zdo);
            int laid = 0;
            for (int guard = 0; guard < 200 && laid < most && Head(hearth, out Vector3 building, out float radius); guard++)
            {
                List<Vector3> points = HeadRoute(hearth) ?? Points(hearth.transform.position, village.Axis, building, radius);
                int i = Mathf.Max(0, hearth.Zdo.GetInt(KeyIndex));
                for (; i < points.Count && laid < most; i++)
                {
                    LayPoint(hearth, points[i]);
                    laid++;
                }

                if (i < points.Count)
                {
                    hearth.Zdo.Set(KeyIndex, i);
                    break;
                }

                Pop(hearth);
            }

            if (Layers.TryGetValue(hearth.VillageId, out Villager layer) && layer != null)
            {
                Release(layer);
            }

            return laid;
        }

        private static void Release(Villager villager)
        {
            if (Layers.TryGetValue(villager.VillageId, out Villager layer) && layer == villager)
            {
                Layers.Remove(villager.VillageId);
            }
        }

        private static List<Vector3> Points(Vector3 hearth, float axis, Vector3 building, float radius)
        {
            string key = $"{hearth}|{axis}|{building}|{radius}";
            if (!PointCache.TryGetValue(key, out List<Vector3> points))
            {
                if (PointCache.Count > 32)
                {
                    PointCache.Clear();
                }

                points = PathBuilder.Points(hearth, axis, building, radius);
                PointCache[key] = points;
            }

            return points;
        }

        private static bool Head(VillageHearth hearth, out Vector3 building, out float radius)
        {
            building = Vector3.zero;
            radius = 0f;
            string queue = hearth.Zdo.GetString(KeyQueue, "");
            if (string.IsNullOrEmpty(queue))
            {
                return false;
            }

            string[] parts = queue.Split(';')[0].Split('|')[0].Split(',');
            if (parts.Length < 4)
            {
                Pop(hearth);
                return false;
            }

            building = new Vector3(P(parts[0]), P(parts[1]), P(parts[2]));
            radius = P(parts[3]);
            return true;
        }

        /// <summary>The planned route of the first path in the queue, or null for paths queued before routes were planned.</summary>
        private static List<Vector3> HeadRoute(VillageHearth hearth)
        {
            string head = hearth.Zdo.GetString(KeyQueue, "").Split(';')[0];
            int bar = head.IndexOf('|');
            if (bar < 0)
            {
                return null;
            }

            string key = "route|" + head;
            if (!PointCache.TryGetValue(key, out List<Vector3> route))
            {
                route = PathPlanner.Decode(head.Substring(bar + 1));
                PointCache[key] = route;
            }

            return route.Count > 0 ? route : null;
        }

        /// <summary>Drops every path waiting for the building at this spot (it is being rebuilt; its new path comes after).</summary>
        public static void Unqueue(VillageHearth hearth, Vector3 building)
        {
            string[] entries = hearth.Zdo.GetString(KeyQueue, "").Split(new[] { ';' }, System.StringSplitOptions.RemoveEmptyEntries);
            bool Matches(string e)
            {
                string[] parts = e.Split('|')[0].Split(',');
                return parts.Length >= 3 && Utils.DistanceXZ(new Vector3(P(parts[0]), 0f, P(parts[2])), building) < 0.5f;
            }

            if (entries.Length == 0 || !entries.Any(Matches))
            {
                return;
            }

            if (Matches(entries[0]))
            {
                hearth.Zdo.Set(KeyIndex, 0);
            }

            hearth.Zdo.Set(KeyQueue, string.Join(";", entries.Where(e => !Matches(e))));
        }

        private static void Pop(VillageHearth hearth)
        {
            string queue = hearth.Zdo.GetString(KeyQueue, "");
            int split = queue.IndexOf(';');
            hearth.Zdo.Set(KeyQueue, split < 0 ? "" : queue.Substring(split + 1));
            hearth.Zdo.Set(KeyIndex, 0);
        }

        private static string F(float value) => value.ToString("0.##", CultureInfo.InvariantCulture);

        private static float P(string value) =>
            float.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out float result) ? result : 0f;
    }
}
