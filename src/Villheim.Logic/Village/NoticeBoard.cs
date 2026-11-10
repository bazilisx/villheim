using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The village notice board, like Millenaire's village panels: Tyler's 'villagenotice' blueprint (saved with
    /// PlanBuild), built over the village chest by the hearth. The top sign shows the village's name in white; the six
    /// below show its level, buildings, population, next project, what it needs and its morale, each a white heading
    /// over a light coloured value (by trade for the project, by material for what is needed, by mood for morale).
    ///
    /// - It is part of settling in (see Amenities): made right after the cooking station, paid in wood from the chest
    ///   (the signs' coal is let off). Any piece of it that is destroyed is made again, as a priority, like the chest.
    /// - Its place is worked out once: the blueprint's chest is set on the village chest, so the board stands over it;
    ///   with no chest in the blueprint (or no village chest), it goes on the ring by the hearth, facing the fire.
    /// - The old single sign and the village name sign on the ground are taken away when the board goes up.
    /// - With no 'villagenotice' blueprint found, there is no board (logged once).
    /// - The back of the board (D-009): every front sign gets a vanilla sign on the other side of the frame, mirrored
    ///   through the frame's line. The top one shows the name again; the rest, read from behind left to right and top
    ///   down, show the contract for players (what, the reward, where to find it), the season, the next feast and the
    ///   prosperity. The front "Needed" sign keeps showing what the village needs.
    /// </summary>
    internal static class NoticeBoard
    {
        public const string BlueprintName = "villagenotice";

        /// <summary>On the old single notice sign (1) and on every piece of the board (2).</summary>
        public static readonly int Key = "villheim_noticeboard".GetStableHashCode();

        private static readonly int KeyOrigin = "villheim_board_pos".GetStableHashCode();
        private static readonly int KeyYaw = "villheim_board_yaw".GetStableHashCode();
        private const int BoardPiece = 2;
        private static readonly int KeyHeading = "villheim_board_heading".GetStableHashCode();

        /// <summary>On a sign on the back of the board (D-009).</summary>
        private static readonly int KeyBack = "villheim_board_back".GetStableHashCode();

        /// <summary>What the back signs show, in reading order from behind (the top sign is the name).</summary>
        private static readonly string[] BackHeadings = { "Contract", "Reward", "Where", "Season", "Next feast", "Prosperity" };

        // Back signs of the plan last worked out by Missing, with their headings.
        private static readonly Dictionary<DesignSpawner.PlanEntry, string> BackHeading = new Dictionary<DesignSpawner.PlanEntry, string>();

        /// <summary>
        /// The heading on a blueprint sign ("&lt;#fff&gt;Morale: &lt;br&gt;Happy" gives "Morale"), or "" for the title sign
        /// (no colon: the village's name).
        /// </summary>
        private static string Heading(string text)
        {
            string plain = System.Text.RegularExpressions.Regex.Replace(text ?? "", "<[^>]*>", " ");
            int colon = plain.IndexOf(':');
            return colon < 0 ? "" : plain.Substring(0, colon).Trim();
        }

        private static readonly Dictionary<int, float> NextUpdate = new Dictionary<int, float>();
        private static bool _warned;

        private static Blueprints.Blueprint Blueprint()
        {
            Blueprints.Blueprint blueprint = Blueprints.ByFileName(BlueprintName);
            if (blueprint == null && !_warned)
            {
                _warned = true;
                VillheimPlugin.Log.LogInfo($"No '{BlueprintName}' blueprint found (BepInEx/config/PlanBuild/blueprints): villages have no notice board.");
            }

            return blueprint;
        }

        private static bool IsChest(string prefab) => prefab.ToLowerInvariant().Contains("chest");

        /// <summary>Where the board stands (its blueprint origin) and which way it turns. Worked out once, then kept.</summary>
        private static bool Placement(VillageHearth hearth, Blueprints.Blueprint blueprint, out Vector3 origin, out float yaw, out bool onChest)
        {
            onChest = false;
            origin = hearth.Zdo.GetVec3(KeyOrigin, Vector3.zero);
            yaw = hearth.Zdo.GetFloat(KeyYaw, 0f);
            Blueprints.Piece chestPiece = blueprint.Pieces.FirstOrDefault(p => IsChest(p.Prefab));
            if (origin != Vector3.zero)
            {
                onChest = chestPiece != null;
                return true;
            }

            Container chest = VillageChest.Find(hearth);
            if (chestPiece != null && chest != null)
            {
                yaw = chest.transform.eulerAngles.y - chestPiece.Rotation.eulerAngles.y;
                origin = chest.transform.position - Quaternion.Euler(0f, yaw, 0f) * chestPiece.Position;
                onChest = true;
            }
            else
            {
                var state = new VillageState(hearth.Zdo);
                Vector3 center = hearth.transform.position;
                origin = center + Quaternion.Euler(0f, state.Axis + 315f, 0f) * Vector3.forward * 5.5f;
                if (ZoneSystem.instance.GetGroundHeight(origin, out float y))
                {
                    origin.y = y;
                }

                Vector3 toFire = center - origin;
                toFire.y = 0f;
                yaw = toFire.sqrMagnitude > 0.01f ? Quaternion.LookRotation(toFire).eulerAngles.y : state.Axis;
            }

            hearth.Zdo.Set(KeyOrigin, origin);
            hearth.Zdo.Set(KeyYaw, yaw);
            return true;
        }

        /// <summary>The board's pieces that aren't standing (all of them before it is first built).</summary>
        private static List<DesignSpawner.PlanEntry> Missing(VillageHearth hearth, out Vector3 origin, out float yaw)
        {
            origin = Vector3.zero;
            yaw = 0f;
            var missing = new List<DesignSpawner.PlanEntry>();
            Blueprints.Blueprint blueprint = Blueprint();
            if (blueprint == null || !Placement(hearth, blueprint, out origin, out yaw, out bool onChest))
            {
                return missing;
            }

            Quaternion turn = Quaternion.Euler(0f, yaw, 0f);
            List<DesignSpawner.PlanEntry> plan = PlanOf(blueprint, origin, yaw);
            foreach (DesignSpawner.PlanEntry entry in plan)
            {
                if (onChest && IsChest(entry.Prefab))
                {
                    continue; // the village chest is the board's chest
                }

                Vector3 at = origin + turn * entry.LocalPosition;
                if (!Standing(at, entry.Prefab, hearth.VillageId, null))
                {
                    missing.Add(entry);
                }
            }

            BackHeading.Clear();
            foreach ((DesignSpawner.PlanEntry entry, string heading) in BackSigns(plan))
            {
                BackHeading[entry] = heading;
                if (!Standing(origin + turn * entry.LocalPosition, entry.Prefab, hearth.VillageId, heading))
                {
                    missing.Add(entry);
                }
            }

            // Strictly ground up (T-37: bottom pieces had gone up last, and what rested on them fell): by the height of
            // each piece's bottom, frame before what hangs on it (signs), in the blueprint's order within that.
            return missing.Select((e, i) => (Entry: e, Index: i))
                .OrderBy(x => Mathf.Round(Bottom(x.Entry) * 4f))
                .ThenBy(x => x.Entry.Shell ? 0 : 1)
                .ThenBy(x => x.Index)
                .Select(x => x.Entry).ToList();
        }

        private static readonly Dictionary<string, List<DesignSpawner.PlanEntry>> Plans = new Dictionary<string, List<DesignSpawner.PlanEntry>>();

        /// <summary>
        /// The board's plan at its place, worked out once (the build order compares every piece with every other and looks
        /// at the ground under each): it was made again on every look at the board, and twice a minute for its signs.
        /// </summary>
        private static List<DesignSpawner.PlanEntry> PlanOf(Blueprints.Blueprint blueprint, Vector3 origin, float yaw)
        {
            string key = $"{blueprint.File}|{origin}|{yaw}";
            if (!Plans.TryGetValue(key, out List<DesignSpawner.PlanEntry> plan))
            {
                if (Plans.Count > 16)
                {
                    Plans.Clear();
                }

                plan = Blueprints.MakePlan(blueprint, origin, yaw).ToList();
                Plans[key] = plan;
            }

            return plan;
        }

        private static int _planCount;

        /// <summary>How many pieces the whole board has (the chest left out when the village chest stands in for it).</summary>
        private static int PlanCount(VillageHearth hearth)
        {
            if (_planCount == 0)
            {
                Blueprints.Blueprint blueprint = Blueprint();
                if (blueprint != null)
                {
                    int front = blueprint.Pieces.Count(p => !IsChest(p.Prefab));
                    _planCount = front + blueprint.Pieces.Count(p => IsSign(p.Prefab));
                }
            }

            return _planCount;
        }

        /// <summary>The height of a piece's bottom in the blueprint (from its measured box; a quarter metre under a sign's middle).</summary>
        private static float Bottom(DesignSpawner.PlanEntry entry) =>
            entry.Bounds.HasValue ? entry.Bounds.Value.min.y : entry.LocalPosition.y - 0.25f;

        /// <summary>
        /// The signs for the back of the board: each front sign mirrored through the line of the frame (the two frame
        /// pieces furthest apart) and turned round, with the heading it shows.
        /// </summary>
        private static List<(DesignSpawner.PlanEntry Entry, string Heading)> BackSigns(List<DesignSpawner.PlanEntry> plan)
        {
            var back = new List<(DesignSpawner.PlanEntry, string)>();
            List<DesignSpawner.PlanEntry> frame = plan.Where(e => !IsChest(e.Prefab) && !IsSign(e.Prefab)).ToList();
            List<DesignSpawner.PlanEntry> signs = plan.Where(e => IsSign(e.Prefab)).ToList();
            if (frame.Count < 2 || signs.Count == 0)
            {
                return back;
            }

            (Vector3 A, Vector3 B, float D) far = (Vector3.zero, Vector3.zero, -1f);
            foreach (DesignSpawner.PlanEntry a in frame)
            {
                foreach (DesignSpawner.PlanEntry b in frame)
                {
                    float d = Utils.DistanceXZ(a.LocalPosition, b.LocalPosition);
                    if (d > far.D)
                    {
                        far = (a.LocalPosition, b.LocalPosition, d);
                    }
                }
            }

            Vector3 axis = (far.B - far.A).Horizontal();
            if (axis.sqrMagnitude < 0.01f)
            {
                return back;
            }

            Vector3 normal = Vector3.Cross(Vector3.up, axis.normalized).normalized;
            Vector3 center = far.A;
            var mirrored = new List<DesignSpawner.PlanEntry>();
            foreach (DesignSpawner.PlanEntry sign in signs)
            {
                float side = Vector3.Dot((sign.LocalPosition - center).Horizontal(), normal);
                mirrored.Add(new DesignSpawner.PlanEntry
                {
                    Prefab = sign.Prefab,
                    LocalPosition = sign.LocalPosition - normal * (2f * side),
                    LocalRotation = Quaternion.Euler(0f, 180f, 0f) * sign.LocalRotation,
                    Scale = sign.Scale,
                    Stage = sign.Stage,
                    Cost = new Dictionary<string, int>(sign.Cost),
                });
            }

            // Read from behind: the viewer looks toward the front side, so his right is across that way.
            float frontSide = Vector3.Dot((signs[0].LocalPosition - center).Horizontal(), normal);
            Vector3 look = frontSide >= 0f ? normal : -normal;
            Vector3 right = Vector3.Cross(Vector3.up, look);
            List<DesignSpawner.PlanEntry> ordered = mirrored.OrderByDescending(e => e.LocalPosition.y).ToList();
            back.Add((ordered[0], ""));
            var rows = new List<List<DesignSpawner.PlanEntry>>();
            foreach (DesignSpawner.PlanEntry entry in ordered.Skip(1))
            {
                List<DesignSpawner.PlanEntry> row = rows.FirstOrDefault(r => Mathf.Abs(r[0].LocalPosition.y - entry.LocalPosition.y) < 0.25f);
                if (row == null)
                {
                    rows.Add(row = new List<DesignSpawner.PlanEntry>());
                }

                row.Add(entry);
            }

            int i = 0;
            foreach (DesignSpawner.PlanEntry entry in rows.SelectMany(r => r.OrderBy(e => Vector3.Dot(e.LocalPosition, right))))
            {
                if (i < BackHeadings.Length)
                {
                    back.Add((entry, BackHeadings[i++]));
                }
            }

            return back;
        }

        private static bool IsSign(string prefab) => prefab == "sign";

        /// <summary>
        /// A piece of the board stands here. Front pieces never count a back sign; a back sign (heading given) must be a
        /// back sign with that heading, since its front twin stands a hand's width away.
        /// </summary>
        private static bool Standing(Vector3 at, string prefab, int villageId, string backHeading)
        {
            // By where the piece itself stands, not by its colliders: a 1 m beam's end reached into the next beam's spot,
            // and the pole below reached up into the next pole's, so those counted as standing and were never built
            // (Tyler: the board was missing its upright 1 m beams and some cross beams).
            foreach (Collider collider in Physics.OverlapSphere(at, 1.5f))
            {
                ZNetView view = collider.GetComponentInParent<ZNetView>();
                if (view == null || !view.IsValid() || Utils.GetPrefabName(view.gameObject) != prefab ||
                    view.GetZDO().GetInt(Keys.BuiltBy) != villageId || Vector3.Distance(view.transform.position, at) > 0.25f)
                {
                    continue;
                }

                bool isBack = view.GetZDO().GetInt(KeyBack) == 1;
                if (backHeading == null ? !isBack : isBack && view.GetZDO().GetString(KeyHeading, "") == backHeading)
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>Tracked materials a piece costs in vanilla (the sign's coal is let off).</summary>
        private static Dictionary<string, int> PieceCost(DesignSpawner.PlanEntry entry)
        {
            var cost = new Dictionary<string, int>();
            GameObject prefab = ZNetScene.instance.GetPrefab(entry.Prefab);
            if (prefab == null)
            {
                return cost;
            }

            foreach (KeyValuePair<string, int> part in DesignSpawner.RecipeCost(prefab))
            {
                if (Materials.Tracked.Contains(part.Key))
                {
                    cost.TryGetValue(part.Key, out int n);
                    cost[part.Key] = n + part.Value;
                }
            }

            return cost;
        }

        /// <summary>
        /// The job of making (or mending) the board, for Amenities, or null when it stands whole. One piece at a time
        /// (Tyler, T-11: no instant buildings): the job is the next missing piece in build order, ground up, paid on its
        /// own; Total is what the rest of the board costs, which the villagers gather for and the builder waits for
        /// before he starts (half its main material, BuildStartShare). The board is plain wood: poles, beams, 1x1 floors, a roof top and
        /// signs (the signs' coal is let off). It never needs fine wood.
        /// </summary>
        public static Amenities.Job Job(VillageHearth hearth)
        {
            List<DesignSpawner.PlanEntry> missing = Missing(hearth, out Vector3 origin, out float yaw);
            if (missing.Count == 0)
            {
                return null;
            }

            var total = new Dictionary<string, int>();
            foreach (DesignSpawner.PlanEntry entry in missing)
            {
                foreach (KeyValuePair<string, int> part in PieceCost(entry))
                {
                    total.TryGetValue(part.Key, out int n);
                    total[part.Key] = n + part.Value;
                }
            }

            Quaternion turn = Quaternion.Euler(0f, yaw, 0f);
            return new Amenities.Job
            {
                Prefab = BlueprintName,
                Name = "notice board",
                Spot = origin + turn * missing[0].LocalPosition,
                Rotation = turn * missing[0].LocalRotation,
                Cost = PieceCost(missing[0]),
                Total = total,
                Pieces = missing.Count,
                Started = missing.Count < PlanCount(hearth),
                Essential = true,
            };
        }

        /// <summary>
        /// Puts up the board's next missing piece (already paid for). The last piece takes the old ground signs away.
        /// False when nothing is missing or the piece could not be made.
        /// </summary>
        public static bool BuildNext(VillageHearth hearth) => Build(hearth, 1) > 0;

        /// <summary>Puts up every missing piece at once: only for 'vh board now' (a test command).</summary>
        public static bool Build(VillageHearth hearth) => Build(hearth, int.MaxValue) > 0;

        private static int Build(VillageHearth hearth, int most)
        {
            List<DesignSpawner.PlanEntry> missing = Missing(hearth, out Vector3 origin, out float yaw);
            if (missing.Count == 0)
            {
                return 0;
            }

            Quaternion turn = Quaternion.Euler(0f, yaw, 0f);
            Blueprints.Blueprint blueprint = Blueprint();
            int made = 0;
            foreach (DesignSpawner.PlanEntry entry in missing.Take(most))
            {
                GameObject piece = DesignSpawner.SpawnEntry(entry, origin, turn, hearth.VillageId, true);
                ZNetView view = piece != null ? piece.GetComponent<ZNetView>() : null;
                if (view == null || !view.IsValid())
                {
                    continue;
                }

                made++;
                view.GetZDO().Set(Key, BoardPiece);
                view.GetZDO().Set(Keys.BuiltBy, hearth.VillageId);
                if (BackHeading.TryGetValue(entry, out string backHeading))
                {
                    view.GetZDO().Set(KeyBack, 1);
                    view.GetZDO().Set(KeyHeading, backHeading);
                }
                else if (piece.GetComponent<Sign>() != null && blueprint != null)
                {
                    // Which stat this sign shows comes from the heading written on it in the blueprint. The nearest
                    // blueprint sign gives it; Update gives any sign left without one a heading by its place.
                    Blueprints.Piece source = blueprint.Pieces
                        .Where(p => p.Prefab == entry.Prefab && p.Text != null)
                        .OrderBy(p => Vector3.Distance(p.Position, entry.LocalPosition)).FirstOrDefault();
                    if (source != null && Vector3.Distance(source.Position, entry.LocalPosition) < 0.6f)
                    {
                        view.GetZDO().Set(KeyHeading, Heading(source.Text));
                    }
                }
            }

            if (made >= missing.Count)
            {
                RemoveOldSigns(hearth);
            }

            Update(hearth, true);
            return made;
        }

        /// <summary>
        /// Takes away notice boards that went up as buildings (T-14: the 'villagenotice' blueprint was in the house
        /// pool, so the builder put up a blank board on every house plot). A site or plot with a fixture design is
        /// dropped, and the pieces it put up come down with their materials back in the stock. The real board over the
        /// chest is left alone. Cheap when there is nothing to do: one look at the plot list and the site.
        /// </summary>
        public static void RemoveStrayBoards(VillageHearth hearth, VillageState state)
        {
            var spots = new List<(Vector3 Position, float Radius)>();
            ConstructionSite.Site site = ConstructionSite.Get(hearth.Zdo);
            if (site != null && Blueprints.IsFixture(site.Design))
            {
                spots.Add((site.Position, Mathf.Max(site.Radius, 3f)));
                ConstructionSite.Abandon(hearth);
                Growth.Clear(hearth);
            }

            foreach (Plot plot in state.Plots)
            {
                if (Blueprints.IsFixture(plot.Design))
                {
                    spots.Add((plot.Position, Mathf.Max(plot.Radius, 3f)));
                }
            }

            if (spots.Count == 0)
            {
                return;
            }

            int removed = state.RemovePlots(p => Blueprints.IsFixture(p.Design));
            Container chest = VillageChest.Find(hearth);
            int pieces = 0;
            var doomed = new List<ZNetView>();
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                if (view == null || !view.IsValid() || view.GetZDO().GetInt(Keys.BuiltBy) != hearth.VillageId ||
                    view.GetZDO().GetInt(Key) == BoardPiece || view.GetComponent<Piece>() == null ||
                    view.GetComponent<VillageHearth>() != null || (chest != null && view.gameObject == chest.gameObject) ||
                    view.GetZDO().GetInt(StorageChests.KeyVillage) != 0)
                {
                    continue;
                }

                if (spots.Any(s => Utils.DistanceXZ(view.transform.position, s.Position) < s.Radius))
                {
                    doomed.Add(view);
                }
            }

            foreach (ZNetView view in doomed)
            {
                foreach (KeyValuePair<string, int> cost in DesignSpawner.RecipeCost(view.gameObject))
                {
                    if (Materials.Tracked.Contains(cost.Key))
                    {
                        state.Add(cost.Key, cost.Value);
                    }
                }

                view.ClaimOwnership();
                ZNetScene.instance.Destroy(view.gameObject);
                pieces++;
            }

            Amenities.Forget(hearth.VillageId);
            VillheimPlugin.Log.LogInfo($"{state.Name}: took away {removed} notice board(s) built as houses ({pieces} pieces, materials back in stock).");
        }

        private static void RemoveOldSigns(VillageHearth hearth)
        {
            // Only the old single sign and name sign by the fire: the storage chests' labels stay (they had been taken
            // away here and made again, over and over, T-43). Looked for round the hearth, not through every object in
            // the world, which was a lag spike when the board was finished (T-105).
            var old = new List<ZNetView>();
            foreach (Collider collider in Physics.OverlapSphere(hearth.transform.position, 12f))
            {
                Sign sign = collider.GetComponentInParent<Sign>();
                ZNetView view = sign != null ? sign.GetComponent<ZNetView>() : null;
                if (view != null && view.IsValid() && !old.Contains(view) &&
                    view.GetZDO().GetInt(Keys.BuiltBy) == hearth.VillageId && view.GetZDO().GetInt(Key) != BoardPiece &&
                    view.GetZDO().GetInt(StorageChests.KeySign) == 0)
                {
                    old.Add(view);
                }
            }

            foreach (ZNetView view in old)
            {
                view.ClaimOwnership();
                ZNetScene.instance.Destroy(view.gameObject);
            }
        }

        /// <summary>For 'vh board': whether the blueprint was found, where the board goes, what is missing and why it waits.</summary>
        public static string Report(VillageHearth hearth, bool buildNow)
        {
            Blueprints.Blueprint blueprint = Blueprints.ByFileName(BlueprintName);
            if (blueprint == null)
            {
                return $"no '{BlueprintName}' blueprint found in BepInEx/config/Villheim/blueprints, BepInEx/config/PlanBuild/blueprints or the plugins folder";
            }

            List<DesignSpawner.PlanEntry> missing = Missing(hearth, out Vector3 origin, out float yaw);
            Amenities.Job job = Job(hearth);
            Amenities.Job next = Amenities.Upcoming(hearth);
            string cost = job != null ? string.Join(", ", (job.Total ?? job.Cost).Select(c => $"{c.Value} {Materials.Label(c.Key)}")) : "-";
            string text = $"blueprint {blueprint.File} ({blueprint.Pieces.Count} pieces, chest piece: " +
                          $"{(blueprint.Pieces.Any(p => IsChest(p.Prefab)) ? "yes" : "no")}); board at {origin.ToString("F1")} turned {yaw:0}; " +
                          $"{missing.Count} pieces missing, cost {cost}; the village's next thing to make: {next?.Name ?? "nothing"}.";
            if (buildNow && missing.Count > 0)
            {
                text += Build(hearth) ? " Built it now (free)." : " Could not build it.";
            }

            Update(hearth, true);
            return text + "\n" + SignReport(hearth);
        }

        /// <summary>Rewrites the board's signs (every 20 seconds, or now).</summary>
        public static void Update(VillageHearth hearth, bool now = false)
        {
            if (!now && NextUpdate.TryGetValue(hearth.VillageId, out float next) && Time.time < next)
            {
                return;
            }

            NextUpdate[hearth.VillageId] = Time.time + 30f;
            Vector3 origin = hearth.Zdo.GetVec3(KeyOrigin, Vector3.zero);
            if (origin == Vector3.zero || (!now && Player.GetClosestPlayer(origin, 80f) == null))
            {
                return; // nobody near enough to read it
            }

            var signs = new List<Sign>();
            foreach (Collider collider in Physics.OverlapSphere(origin, 6f))
            {
                Sign sign = collider.GetComponentInParent<Sign>();
                ZNetView view = sign != null ? sign.GetComponent<ZNetView>() : null;
                if (view != null && view.IsValid() && view.GetZDO().GetInt(Key) == BoardPiece && !signs.Contains(sign))
                {
                    signs.Add(sign);
                }
            }

            if (signs.Count == 0)
            {
                return;
            }

            // Read as someone at the hearth sees it: the top sign is the name, then rows from the top, left to right.
            Vector3 view0 = origin - hearth.transform.position;
            view0.y = 0f;
            Vector3 right = Vector3.Cross(Vector3.up, view0.sqrMagnitude > 0.01f ? view0.normalized : Vector3.forward);
            List<Sign> ordered = signs.OrderByDescending(s => s.transform.position.y).ToList();
            Sign title = ordered[0];
            List<Sign> rest = ordered.Skip(1).ToList();
            var rows = new List<List<Sign>>();
            foreach (Sign sign in rest)
            {
                List<Sign> row = rows.FirstOrDefault(r => Mathf.Abs(r[0].transform.position.y - sign.transform.position.y) < 0.25f);
                if (row == null)
                {
                    rows.Add(row = new List<Sign>());
                }

                row.Add(sign);
            }

            List<Sign> cells = rows.SelectMany(r => r.OrderBy(s => Vector3.Dot(s.transform.position - origin, right))).ToList();
            var state = new VillageState(hearth.Zdo);
            Dictionary<string, (string Value, string Color)> stats;
            using (Perf.Time("NoticeBoard.Stats")) stats = Stats(hearth, state);
            using (Perf.Time("NoticeBoard.AssignHeadings")) AssignHeadings(hearth, origin, signs);
            bool byHeading = signs.Any(s => s.GetComponent<ZNetView>().GetZDO().GetString(KeyHeading, null) != null);
            if (byHeading)
            {

                // Each sign shows the stat its blueprint heading names, under that same heading.
                foreach (Sign sign in signs)
                {
                    string heading = sign.GetComponent<ZNetView>().GetZDO().GetString(KeyHeading, null);
                    if (heading == null)
                    {
                        continue;
                    }

                    if (heading.Length == 0)
                    {
                        Write(sign, $"<#fff>{state.Name}");
                    }
                    else if (stats.TryGetValue(heading.ToLowerInvariant(), out var stat))
                    {
                        Write(sign, $"<#fff>{heading}:<br><{stat.Color}>{stat.Value}");
                    }
                }

                return;
            }

            Write(title, $"<#fff>{state.Name}");
            string[] lines = Lines(hearth, state);
            for (int i = 0; i < cells.Count && i < lines.Length; i++)
            {
                Write(cells[i], lines[i]);
            }
        }

        /// <summary>
        /// Gives every sign of the board the heading of the blueprint sign whose place it stands in: on the front, the
        /// heading written on that sign in the blueprint (the name on top, then Buildings, Stock, Population over
        /// Project, Needed, Morale in Tyler's board); on the back, the heading of the mirrored place (BackSigns). Worked
        /// out from where each sign stands every time the board is written, so a sign that got a wrong heading earlier
        /// (the front had shown the name low down and "..." on top) is put right.
        /// </summary>
        private static void AssignHeadings(VillageHearth hearth, Vector3 origin, List<Sign> signs)
        {
            Blueprints.Blueprint blueprint = Blueprint();
            if (blueprint == null)
            {
                return;
            }

            float yaw = hearth.Zdo.GetFloat(KeyYaw, 0f);
            Quaternion toBoard = Quaternion.Inverse(Quaternion.Euler(0f, yaw, 0f));
            List<(Vector3 At, string Heading)> front = FrontPlaces(blueprint);
            List<DesignSpawner.PlanEntry> plan = PlanOf(blueprint, origin, yaw);
            List<(Vector3 At, string Heading)> back = BackSigns(plan).Select(b => (b.Entry.LocalPosition, b.Heading)).ToList();
            foreach (Sign sign in signs)
            {
                ZNetView view = sign.GetComponent<ZNetView>();
                bool isBack = view.GetZDO().GetInt(KeyBack) == 1;
                Vector3 local = toBoard * (sign.transform.position - origin);
                List<(Vector3 At, string Heading)> places = isBack ? back : front;
                if (places.Count == 0)
                {
                    continue;
                }

                (Vector3 At, string Heading) nearest = places.OrderBy(p => Vector3.Distance(p.At, local)).First();
                if (Vector3.Distance(nearest.At, local) > 0.6f || view.GetZDO().GetString(KeyHeading, null) == nearest.Heading)
                {
                    continue;
                }

                view.ClaimOwnership();
                view.GetZDO().Set(KeyHeading, nearest.Heading);
                view.GetZDO().Set(ZDOVars.s_text, ""); // written again below
            }
        }

        // Tyler's board, read left to right from the front: the name on top, then these two rows (T-123).
        private static readonly string[][] FrontRows =
        {
            new[] { "Buildings", "Stock", "Population" },
            new[] { "Project", "Needed", "Morale" },
        };

        /// <summary>
        /// The heading of each front sign place. The board copy the game reads has its sign texts cleared, so the
        /// headings come from where the signs sit: the highest sign is the name, the rows below take FrontRows, each
        /// row read along the board from the end where Tyler's board has Buildings. A copy that still carries its
        /// texts uses them.
        /// </summary>
        private static List<(Vector3 At, string Heading)> FrontPlaces(Blueprints.Blueprint blueprint)
        {
            List<Blueprints.Piece> signs = blueprint.Pieces.Where(p => IsSign(p.Prefab)).ToList();
            if (signs.Count > 0 && signs.All(p => p.Text != null))
            {
                return signs.Select(p => (p.Position, Heading(p.Text))).ToList();
            }

            var places = new List<(Vector3 At, string Heading)>();
            var rows = new List<List<Blueprints.Piece>>();
            foreach (Blueprints.Piece sign in signs.OrderByDescending(p => p.Position.y))
            {
                List<Blueprints.Piece> row = rows.LastOrDefault();
                if (row == null || Mathf.Abs(row[0].Position.y - sign.Position.y) > 0.3f)
                {
                    rows.Add(row = new List<Blueprints.Piece>());
                }

                row.Add(sign);
            }

            for (int r = 0; r < rows.Count; r++)
            {
                List<Blueprints.Piece> row = rows[r].OrderByDescending(p => p.Position.x + p.Position.z).ToList();
                for (int i = 0; i < row.Count; i++)
                {
                    string heading = r == 0 ? "" : r - 1 < FrontRows.Length && i < FrontRows[r - 1].Length ? FrontRows[r - 1][i] : null;
                    if (heading != null)
                    {
                        places.Add((row[i].Position, heading));
                    }
                }
            }

            return places;
        }

        /// <summary>For 'vh board': each sign of the board, its heading and what it shows.</summary>
        public static string SignReport(VillageHearth hearth)
        {
            Vector3 origin = hearth.Zdo.GetVec3(KeyOrigin, Vector3.zero);
            if (origin == Vector3.zero)
            {
                return "no board placed yet";
            }

            var lines = new List<string>();
            var seen = new HashSet<Sign>();
            foreach (Collider collider in Physics.OverlapSphere(origin, 6f))
            {
                Sign sign = collider.GetComponentInParent<Sign>();
                ZNetView view = sign != null ? sign.GetComponent<ZNetView>() : null;
                if (view == null || !view.IsValid() || view.GetZDO().GetInt(Key) != BoardPiece || !seen.Add(sign))
                {
                    continue;
                }

                ZDO zdo = view.GetZDO();
                string shown = (sign.m_isViewable ? "" : "(hidden) ") + (sign.m_currentText ?? "");
                lines.Add($"{(zdo.GetInt(KeyBack) == 1 ? "back" : "front")} '{zdo.GetString(KeyHeading, "(none)")}' at " +
                          $"{sign.transform.position.y - origin.y:0.0} m: saved '{zdo.GetString(ZDOVars.s_text, "")}', shows '{shown}'");
            }

            return lines.Count == 0 ? "no signs found on the board" : string.Join("\n", lines);
        }

        /// <summary>Every stat a board can show, by the heading words that ask for it.</summary>
        private static Dictionary<string, (string Value, string Color)> Stats(VillageHearth hearth, VillageState state)
        {
            string[] lines = Lines(hearth, state);
            (string, string) Parse(string line)
            {
                int br = line.IndexOf("<br><", System.StringComparison.Ordinal);
                string rest = line.Substring(br + 5);
                int close = rest.IndexOf('>');
                return (rest.Substring(close + 1), rest.Substring(0, close));
            }

            int stock = Materials.Tracked.Sum(m => VillageChest.Have(hearth, state, m));
            (string, string) stockStat = stock >= 150 ? ("Good", "#bfb") : stock >= 50 ? ("Fair", "#ffa") : ("Low", "#fc9");
            var stats = new Dictionary<string, (string, string)>
            {
                ["level"] = Parse(lines[0]),
                ["buildings"] = Parse(lines[1]),
                ["population"] = Parse(lines[2]),
                ["villagers"] = Parse(lines[2]),
                ["project"] = Parse(lines[3]),
                ["next project"] = Parse(lines[3]),
                ["needed"] = Parse(lines[4]),
                ["needs"] = Parse(lines[4]),
                ["morale"] = Parse(lines[5]),
                ["mood"] = Parse(lines[5]),
                ["stock"] = stockStat,
                ["prosperity"] = (Prosperity.Get(hearth).ToString(System.Globalization.CultureInfo.InvariantCulture), "#bdf"),
                ["stores"] = stockStat,
                ["season"] = (Capital(Calendar.Season), "#bdf"),
                ["next feast"] = (Calendar.FestivalToday ? "Today" : Calendar.NextFestivalName(Cultures.Of(state)), "#fd8"),
            };

            // The back of the board: the contract for players (D-009).
            (string What, string Reward, string Where)? contract = Contracts.BoardParts(hearth);
            stats["contract"] = contract.HasValue ? (Capital(contract.Value.What), "#fd8") : ("None posted", "#bfb");
            stats["reward"] = contract.HasValue ? (Capital(contract.Value.Reward), "#fd8") : ("-", "#bfb");
            stats["where"] = contract.HasValue ? (Capital(contract.Value.Where ?? "Nobody knows"), "#bdf") : ("-", "#bfb");
            return stats;
        }

        private static string[] Lines(VillageHearth hearth, VillageState state)
        {
            const string Value = "#bdf";
            int level = VillageBrain.TierIndex(state.Plots.Count) + 1;

            // What the village is at: the building going up, else its next step as on the hearth (a bed, the notice
            // board, a home). "Resting" only when there is truly nothing to do (T-37: it said Resting with no beds).
            NextStep.Step next = NextStep.For(hearth, state);
            string project;
            string projectColor = "#bfb";
            if (ConstructionSite.IsActive(hearth.Zdo))
            {
                Role role = ConstructionSite.Get(hearth.Zdo).Role;
                project = Capital(VillageBrain.RoleName(role));
                projectColor = RoleColor(role);
            }
            else
            {
                string label = next.What ?? "nothing for now";
                int paren = label.IndexOf(" (", System.StringComparison.Ordinal);
                if (paren > 0)
                {
                    label = label.Substring(0, paren);
                }

                label = label.StartsWith("a ") ? label.Substring(2) : label.StartsWith("an ") ? label.Substring(3) : label;
                project = label == "nothing for now" || label == "nothing" ? "Resting" : Capital(label);
                foreach (Role role in System.Enum.GetValues(typeof(Role)))
                {
                    if (label.Contains(VillageBrain.RoleName(role)))
                    {
                        projectColor = RoleColor(role);
                    }
                }
            }

            // What the next step lacks, as on the hearth (NextStep): have/need for the two biggest shortfalls. With the
            // chest full enough, a need still to be made (beds) is named: "Nothing" read wrong while homes had no
            // beds (T-37).
            List<string> lacking = NextStep.Lacking(hearth, state, next, 2);
            Amenities.Job due = Amenities.Upcoming(hearth);
            if (due != null && due.Essential)
            {
                // Beds, the board or a chest come before the next building, so the Project sign names them.
                project = Capital(due.Name == "bed" ? "beds" : due.Inside ? "furnishing" : due.Name);
                projectColor = "#fd8";
            }

            // Needed only ever names materials: have/need for the most pressing shortfalls (Tyler, T-304). What is
            // still to be made (beds, a home) belongs on the Project sign.
            string needed = "Nothing";
            string neededColor = "#bfb";
            if (lacking.Count > 0)
            {
                needed = Capital(string.Join(", ", lacking));
                neededColor = lacking[0].StartsWith(Materials.Label(Materials.Stone)) ? "#ddd" : "#eca";
            }

            float mood = VillageMood.Get(hearth.VillageId);
            string moodColor = mood >= 70f ? "#bfb" : mood >= 50f ? "#ffa" : mood >= 30f ? "#fc9" : "#f99";
            return new[]
            {
                $"<#fff>Level:<br><{Value}>{level}{(Prosperity.On ? $"<size=60%> ({Prosperity.Get(hearth)})" : "")}",
                $"<#fff>Buildings:<br><{Value}>{state.Plots.Count}",
                $"<#fff>Population:<br><{Value}>{VillageBrain.CountVillagers(state.Id)}",
                $"<#fff>Next project:<br><{projectColor}>{project}",
                $"<#fff>Needed:<br><{neededColor}>{needed}",
                $"<#fff>Morale:<br><{moodColor}>{Capital(VillageMood.Label(mood))}",
            };
        }

        /// <summary>Light colours by trade: wood for building in wood, grey for smithing and stone, green for farms.</summary>
        private static string RoleColor(Role role)
        {
            switch (role)
            {
                case Role.Workshop: return "#ddd";
                case Role.Farm: return "#bfb";
                default: return "#eca";
            }
        }

        private static string Capital(string text) =>
            string.IsNullOrEmpty(text) ? text : char.ToUpperInvariant(text[0]) + text.Substring(1);

        private static void Write(Sign sign, string text)
        {
            ZNetView view = sign.GetComponent<ZNetView>();
            if (view == null || !view.IsValid() || view.GetZDO().GetString(ZDOVars.s_text, "") == text)
            {
                return;
            }

            // Straight into the sign's saved text: SetText would cut it to the sign's character limit.
            view.ClaimOwnership();
            view.GetZDO().Set(ZDOVars.s_text, text);
            sign.UpdateText();
        }
    }
}
