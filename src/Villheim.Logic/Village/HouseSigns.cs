using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Villagers;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Signs on the village's homes (Tyler, D-073, step 3). Once someone lives in a home (Households), a vanilla sign
    /// goes on the outside wall right of its front door at about head height (where a house number goes): a lone
    /// villager's name over his role, in the role's color; for a family, the family's name over its members, comma
    /// separated. A family's home also gets one sign per member on the
    /// inside wall by the door, laid out like a lone villager's outside sign.
    ///
    /// - Each sign is an amenity job (Amenities), made by the builder like a storage chest's label: paid from the
    ///   village chest (one wood; the sign's coal is let off), never placed at once.
    /// - The front door is the ground floor door nearest the building's door side (its path marker, or Doors). The sign
    ///   goes on the wall right of it as seen from outside (the left, or over the door, when that wall is missing or
    ///   taken); members' signs go inside right of the door as seen from inside, in one column. A sign needs a wall of
    ///   the house behind it to hang on and is set 2 cm into it. A home with no door or no wall found gets no sign (logged with DebugLog on).
    /// - Each sign is marked with its home (by the plot's position) and its place: the front sign, or the member's
    ///   number for a sign inside. The text is written again every 20 seconds, so a new member, a new role or a grown
    ///   child shows. A sign nobody needs any more (the family is smaller, the home is empty) comes down after a minute,
    ///   and every material in its recipe goes to the village (Refund, D-088), the coal included.
    /// </summary>
    internal static class HouseSigns
    {
        public const string JobName = "house sign";
        private const string SignPrefab = "sign";
        private const int FrontSlot = -1;

        private static readonly int KeyHome = "villheim_home_sign".GetStableHashCode();
        private static readonly int KeySlot = "villheim_home_slot".GetStableHashCode();

        private static readonly Dictionary<int, float> NextUpdate = new Dictionary<int, float>();
        private static readonly Dictionary<ZDOID, float> UnneededSince = new Dictionary<ZDOID, float>();
        private static readonly HashSet<string> Warned = new HashSet<string>();

        public static bool On => LogicConfig.IsOn(LogicConfig.HouseSigns);

        private static int PlotKey(Plot plot) =>
            $"{Mathf.RoundToInt(plot.Position.x * 2f)}:{Mathf.RoundToInt(plot.Position.z * 2f)}".GetStableHashCode();

        // ---------------------------------------------------------------- jobs

        /// <summary>The next house sign to make, or null when every home that has people has its signs.</summary>
        private static readonly Dictionary<string, float> RetryAt = new Dictionary<string, float>();
        private static readonly Dictionary<int, float> QuietUntil = new Dictionary<int, float>();
        private static readonly Dictionary<int, (float Time, List<(Sign Sign, int Home, int Slot)> Signs)> VillageSigns =
            new Dictionary<int, (float, List<(Sign, int, int)>)>();

        public static Amenities.Job Job(VillageHearth hearth, VillageState state)
        {
            if (!On || ZNetScene.instance == null)
            {
                return null;
            }

            // Every home had its signs a moment ago: the look round every home ran each few seconds (10 to 18 ms, 2026-11-09).
            if (QuietUntil.TryGetValue(hearth.VillageId, out float quiet) && Time.time < quiet)
            {
                return null;
            }

            GameObject prefab = ZNetScene.instance.GetPrefab(SignPrefab);
            if (prefab == null || !Amenities.Buildable(prefab, state.Biome, out Dictionary<string, int> cost, true))
            {
                return null;
            }

            QuietUntil[hearth.VillageId] = Time.time + 20f;
            foreach (Households.Household home in Households.Of(hearth))
            {
                Plot plot = home.Plot;
                if (!ZoneSystem.instance.IsZoneLoaded(plot.Position) || UnderConstruction(hearth, plot))
                {
                    continue;
                }

                List<(Sign Sign, int Slot)> standing = Signs(hearth, plot);
                foreach (int slot in Wanted(home))
                {
                    if (standing.Any(s => s.Slot == slot))
                    {
                        continue;
                    }

                    string retryKey = $"{hearth.VillageId}:{PlotKey(plot)}:{slot}";
                    if (RetryAt.TryGetValue(retryKey, out float retry) && Time.time < retry)
                    {
                        break; // looked a moment ago and found no place: the search ran every few seconds (lag, 2026-11-09)
                    }

                    if (!Place(hearth, plot, slot, standing.Select(s => s.Sign.transform.position).ToList(), out Vector3 spot, out Quaternion rotation))
                    {
                        RetryAt[retryKey] = Time.time + 120f;
                        string key = retryKey;
                        if (Warned.Add(key))
                        {
                            VillheimPlugin.Debug($"{state.Name}: no place found for {(slot == FrontSlot ? "the front sign" : $"inside sign {slot + 1}")} " +
                                                 $"of the {plot.Design} at {plot.Position.ToString("F0")} (no door, or no wall by it).");
                        }

                        break; // the inside signs wait for the front one
                    }

                    QuietUntil.Remove(hearth.VillageId);
                    return new Amenities.Job
                    {
                        Prefab = SignPrefab, Name = JobName, Spot = spot, Rotation = rotation, Cost = cost, Inside = true,
                        HomePlot = plot.Position, HomeSlot = slot,
                    };
                }
            }

            return null;
        }

        /// <summary>The sign places a household needs: the front sign, and one inside per member for a family.</summary>
        private static IEnumerable<int> Wanted(Households.Household home)
        {
            yield return FrontSlot;
            if (home.IsFamily)
            {
                for (int i = 0; i < home.Members.Count; i++)
                {
                    yield return i;
                }
            }
        }

        private static bool UnderConstruction(VillageHearth hearth, Plot plot)
        {
            if (!ConstructionSite.IsActive(hearth.Zdo))
            {
                return false;
            }

            ConstructionSite.Site site = ConstructionSite.Get(hearth.Zdo);
            return site != null && Utils.DistanceXZ(site.Position, plot.Position) < 0.5f;
        }

        /// <summary>Puts the sign up (already paid for) and writes it. False when its place is taken now.</summary>
        public static bool Make(VillageHearth hearth, VillageState state, Amenities.Job job)
        {
            Plot plot = state.Plots.FirstOrDefault(p => Utils.DistanceXZ(p.Position, job.HomePlot) < 0.5f);
            GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(SignPrefab) : null;
            if (plot == null || prefab == null || Signs(hearth, plot).Any(s => s.Slot == job.HomeSlot))
            {
                return false;
            }

            GameObject made = Object.Instantiate(prefab, job.Spot, job.Rotation);
            ZNetView view = made.GetComponent<ZNetView>();
            if (view == null || view.GetZDO() == null)
            {
                return false;
            }

            VillageSigns.Remove(hearth.VillageId);
            QuietUntil.Remove(hearth.VillageId);
            ZDO zdo = view.GetZDO();
            zdo.Set(Keys.BuiltBy, hearth.VillageId);
            zdo.Set(KeyHome, PlotKey(plot));
            zdo.Set(KeySlot, job.HomeSlot);
            if (made.TryGetComponent(out Sign sign))
            {
                Write(sign, TextFor(Households.At(hearth, plot), job.HomeSlot));
            }

            if (made.TryGetComponent(out Piece piece))
            {
                piece.m_placeEffect?.Create(job.Spot, job.Rotation, made.transform);
            }

            VillheimPlugin.Log.LogInfo($"{state.Name} put up a house sign on the {plot.Design} " +
                                       $"({(job.HomeSlot == FrontSlot ? "by the front door" : $"inside, member {job.HomeSlot + 1}")}).");
            return true;
        }

        // ---------------------------------------------------------------- keeping the signs up to date

        /// <summary>Every 20 seconds (or now): writes every house sign again and takes down the ones nobody needs.</summary>
        public static void Update(VillageHearth hearth, bool now = false)
        {
            if (!On || hearth == null || !hearth.IsValid)
            {
                return;
            }

            int id = hearth.VillageId;
            if (!now && NextUpdate.TryGetValue(id, out float next) && Time.time < next)
            {
                return;
            }

            NextUpdate[id] = Time.time + 20f;
            var state = new VillageState(hearth.Zdo);
            foreach (Plot plot in state.Plots)
            {
                if (!ZoneSystem.instance.IsZoneLoaded(plot.Position))
                {
                    continue;
                }

                List<(Sign Sign, int Slot)> signs = Signs(hearth, plot);
                if (signs.Count == 0)
                {
                    continue;
                }

                Households.Household home = Households.IsHome(plot) ? Households.At(hearth, plot) : null;
                foreach ((Sign sign, int slot) in signs)
                {
                    string text = TextFor(home, slot);
                    ZNetView view = sign.GetComponent<ZNetView>();
                    if (text.Length > 0)
                    {
                        UnneededSince.Remove(view.GetZDO().m_uid);
                        Write(sign, text);
                        continue;
                    }

                    // Nobody for this sign now. Villagers out of loading range don't count as living here, so it waits a
                    // minute before it comes down.
                    ZDOID uid = view.GetZDO().m_uid;
                    if (!UnneededSince.TryGetValue(uid, out float since))
                    {
                        UnneededSince[uid] = Time.time;
                    }
                    else if (Time.time - since > 60f)
                    {
                        UnneededSince.Remove(uid);
                        TakeDown(hearth, state, plot, sign);
                    }
                }
            }
        }

        /// <summary>What the sign in that place says, or "" when nobody is there for it.</summary>
        private static string TextFor(Households.Household home, int slot)
        {
            if (home == null || home.Members.Count == 0)
            {
                return "";
            }

            if (slot == FrontSlot)
            {
                return Households.HomeText(home);
            }

            return home.IsFamily && slot < home.Members.Count ? Households.PersonText(home.Members[slot]) : "";
        }

        private static void TakeDown(VillageHearth hearth, VillageState state, Plot plot, Sign sign)
        {
            ZNetView view = sign.GetComponent<ZNetView>();
            if (view == null || !view.IsValid())
            {
                return;
            }

            VillageSigns.Remove(hearth.VillageId);
            QuietUntil.Remove(hearth.VillageId);
            Refund.TakeDown(hearth, sign.gameObject, false); // all its materials back (D-088)
            VillheimPlugin.Log.LogInfo($"{state.Name} took down a house sign on the {plot.Design} that nobody needs now.");
        }

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

        // ---------------------------------------------------------------- finding signs, doors and walls

        private static readonly List<Piece> Nearby = new List<Piece>();

        /// <summary>The house signs of this home that stand now, with their places.</summary>
        private static List<(Sign Sign, int Slot)> Signs(VillageHearth hearth, Plot plot)
        {
            // The village's house signs are listed once for all its homes and kept a few seconds: one walk over the
            // world's pieces for the village where there was one for each home.
            int id = hearth.VillageId;
            if (!VillageSigns.TryGetValue(id, out var all) || Time.time - all.Time > 5f || all.Signs.Any(s => s.Sign == null))
            {
                var found = new List<(Sign, int, int)>();
                Nearby.Clear();
                PieceIndex.InRadius(hearth.transform.position, VillheimConfig.VillageRadius.Value * 2f + 40f, Nearby);
                foreach (Piece piece in Nearby)
                {
                    if (piece == null || piece.m_nview == null || !piece.m_nview.IsValid() || !piece.TryGetComponent(out Sign sign))
                    {
                        continue;
                    }

                    ZDO zdo = piece.m_nview.GetZDO();
                    if (zdo.GetInt(Keys.BuiltBy) == id && zdo.GetInt(KeyHome) != 0)
                    {
                        found.Add((sign, zdo.GetInt(KeyHome), zdo.GetInt(KeySlot, FrontSlot)));
                    }
                }

                all = (Time.time, found);
                VillageSigns[id] = all;
            }

            var signs = new List<(Sign, int)>();
            int key = PlotKey(plot);
            foreach ((Sign sign, int home, int slot) in all.Signs)
            {
                if (home == key)
                {
                    signs.Add((sign, slot));
                }
            }

            return signs;
        }

        /// <summary>The home's front door: of its ground floor doors, the one nearest its door side. Null if it has none.</summary>
        public static Door FrontDoor(VillageHearth hearth, Plot plot)
        {
            // Kept 10 s per home (lag cluster B): the look round a whole house for its doors ran for every sign and every
            // home each time the next job was searched for (Amenities.Find step 5, up to 51 ms on 2026-11-09).
            string key = $"{hearth.VillageId}:{Mathf.RoundToInt(plot.Position.x)}:{Mathf.RoundToInt(plot.Position.z)}:{plot.Design}";
            if (DoorCache.TryGetValue(key, out var kept) && Time.time - kept.At < 10f && (kept.Door == null || kept.Door))
            {
                return kept.Door;
            }

            Door found = FindFrontDoor(hearth, plot);
            DoorCache[key] = (Time.time, found);
            return found;
        }

        private static readonly Dictionary<string, (float At, Door Door)> DoorCache = new Dictionary<string, (float, Door)>();
        private static readonly List<Piece> DoorPieces = new List<Piece>();

        private static Door FindFrontDoor(VillageHearth hearth, Plot plot)
        {
            var doors = new List<Door>();
            DoorPieces.Clear();
            // The village's piece list (PieceIndex) in place of a sphere of colliders: a house has hundreds of colliders,
            // each walked up to its piece, where the list holds each piece once. 1 m more than the plot, since a door's
            // middle may stand a little past a collider at the edge.
            PieceIndex.InRadius(plot.Position, plot.Radius + 1f, DoorPieces);
            foreach (Piece piece in DoorPieces)
            {
                Door door = piece != null ? piece.GetComponent<Door>() : null;
                if (door == null || doors.Contains(door) || door.m_keyItem != null || door.m_nview == null || !door.m_nview.IsValid() ||
                    door.m_nview.GetZDO().GetInt(Keys.BuiltBy) != hearth.VillageId)
                {
                    continue;
                }

                doors.Add(door);
            }

            if (doors.Count == 0)
            {
                return null;
            }

            float lowest = doors.Min(d => d.transform.position.y);
            Vector3 front = PathPlanner.Door(plot.Design, plot.Position, plot.Radius, plot.Yaw, Designs.Doors.Angle(plot.Design),
                hearth.transform.position);
            return doors.Where(d => d.transform.position.y < lowest + 1.5f)
                .OrderBy(d => Utils.DistanceXZ(d.transform.position, front)).First();
        }

        /// <summary>
        /// The door's middle, the way out (away from the home's middle), its half width and its bottom and top heights,
        /// from the door piece's measured size.
        /// </summary>
        private static bool Frame(Door door, Plot plot, out Vector3 middle, out Vector3 outward, out float halfWidth, out float bottom,
            out float top)
        {
            GameObject root = door.m_nview.gameObject;
            string name = Utils.GetPrefabName(root);
            GameObject prefab = ZNetScene.instance.GetPrefab(name);
            Bounds? local = prefab != null
                ? Designs.BuildOrder.Measure(prefab, name, Vector3.zero, Quaternion.identity, root.transform.localScale)
                : null;
            Bounds box = local ?? new Bounds(new Vector3(0f, 1f, 0f), new Vector3(1.2f, 2f, 0.2f));
            middle = root.transform.position + root.transform.rotation * box.center;
            halfWidth = box.extents.x;
            bottom = middle.y - box.extents.y;
            top = middle.y + box.extents.y;
            outward = root.transform.forward.Horizontal();
            if (outward.sqrMagnitude < 0.01f)
            {
                return false;
            }

            outward.Normalize();
            if (Vector3.Dot(outward, (middle - plot.Position).Horizontal()) < 0f)
            {
                outward = -outward;
            }

            return true;
        }

        private static Bounds SignBox()
        {
            GameObject prefab = ZNetScene.instance.GetPrefab(SignPrefab);
            Bounds? local = prefab != null ? Designs.BuildOrder.Measure(prefab, SignPrefab, Vector3.zero, Quaternion.identity, prefab.transform.localScale) : null;
            return local ?? new Bounds(Vector3.zero, new Vector3(1f, 0.5f, 0.1f));
        }

        /// <summary>
        /// Where the sign in this place goes: the front sign outside beside the door at eye height (or over the door),
        /// the members' signs inside beside it, in rows and then further along the wall. Each place needs a wall of the
        /// house right behind it and nothing else in the way.
        /// </summary>
        private static bool Place(VillageHearth hearth, Plot plot, int slot, List<Vector3> taken, out Vector3 spot, out Quaternion rotation)
        {
            spot = Vector3.zero;
            rotation = Quaternion.identity;
            Door door = FrontDoor(hearth, plot);
            if (door == null || !Frame(door, plot, out Vector3 middle, out Vector3 outward, out float halfWidth, out float bottom, out float top))
            {
                return false;
            }

            Bounds sign = SignBox();
            float signHalfWidth = sign.extents.x;
            float signHalfHeight = sign.extents.y;
            Vector3 along = Vector3.Cross(Vector3.up, outward).normalized;
            var places = new List<Vector3>(); // middle of the sign, in the plane of the door
            Vector3 facing;
            // 'along' points to the right of someone inside looking out; the right as seen from outside is -along.
            // Tyler (2026-11-09): where a house number goes, right of the door at about head height; inside, right of
            // the door as seen from inside, in one column. The other side and over the door only when the wall there
            // is missing or taken.
            float lateral = halfWidth + signHalfWidth + 0.15f;
            if (slot == FrontSlot)
            {
                facing = outward;
                float height = bottom + 1.65f;
                places.Add(Flat(middle, height) - along * lateral);
                places.Add(Flat(middle, height) + along * lateral);
                places.Add(Flat(middle, top + signHalfHeight + 0.12f));
            }
            else
            {
                facing = -outward;
                foreach (float side in new[] { 1f, -1f })
                {
                    for (int row = 0; row < 4; row++)
                    {
                        float height = bottom + 1.8f - row * (signHalfHeight * 2f + 0.08f);
                        places.Add(Flat(middle, height) + along * side * lateral);
                    }
                }
            }

            foreach (Vector3 place in places)
            {
                if (taken.Any(t => Vector3.Distance(t, place) < signHalfWidth * 1.5f))
                {
                    continue;
                }

                if (OnWall(hearth, middle, outward, place, facing, sign, out Vector3 found, out Quaternion turn) &&
                    !taken.Any(t => Vector3.Distance(t, found) < signHalfWidth * 1.5f))
                {
                    spot = found;
                    rotation = turn;
                    return true;
                }
            }

            return false;
        }

        private static Vector3 Flat(Vector3 point, float y) => new Vector3(point.x, y, point.z);

        /// <summary>
        /// How far the wall's model reaches past the collider face at <paramref name="face"/>, toward
        /// <paramref name="facing"/>. From the box of each of its meshes that spans the sign's height, turned into the
        /// world, so a bar or a log on that side counts and a flat face gives about 0. A guess from boxes: a wall with
        /// a bar only at the top is passed over on that side too.
        /// </summary>
        private static float Proud(ZNetView wall, Vector3 facing, Vector3 face, float middleY, float halfHeight)
        {
            float faceDepth = Vector3.Dot(face, facing);
            float most = 0f;
            foreach (MeshFilter filter in wall.GetComponentsInChildren<MeshFilter>())
            {
                Mesh mesh = filter != null ? filter.sharedMesh : null;
                Renderer renderer = filter != null ? filter.GetComponent<Renderer>() : null;
                if (mesh == null || renderer == null || !renderer.enabled ||
                    renderer.bounds.max.y < middleY - halfHeight || renderer.bounds.min.y > middleY + halfHeight)
                {
                    continue;
                }

                Bounds b = mesh.bounds;
                for (int i = 0; i < 8; i++)
                {
                    Vector3 corner = new Vector3((i & 1) == 0 ? b.min.x : b.max.x, (i & 2) == 0 ? b.min.y : b.max.y,
                        (i & 4) == 0 ? b.min.z : b.max.z);
                    Vector3 world = filter.transform.TransformPoint(corner);
                    most = Mathf.Max(most, Vector3.Dot(world, facing) - faceDepth);
                }
            }

            return most;
        }

        /// <summary>
        /// A wall of the house stands at <paramref name="place"/> facing <paramref name="facing"/>, within half a metre of
        /// the door's plane, with room in front of it for the sign. Gives the sign's position and turn.
        /// </summary>
        private static bool OnWall(VillageHearth hearth, Vector3 doorMiddle, Vector3 outward, Vector3 place, Vector3 facing, Bounds sign,
            out Vector3 spot, out Quaternion rotation)
        {
            spot = Vector3.zero;
            rotation = Quaternion.LookRotation(facing);
            int mask = LayerMask.GetMask("piece", "piece_nonsolid");
            if (!Physics.Raycast(place + facing * 1.2f, -facing, out RaycastHit hit, 2f, mask, QueryTriggerInteraction.Ignore))
            {
                return false;
            }

            ZNetView wall = hit.collider.GetComponentInParent<ZNetView>();
            if (wall == null || !wall.IsValid() || wall.GetZDO().GetInt(Keys.BuiltBy) != hearth.VillageId ||
                wall.GetComponentInChildren<Door>() != null || wall.GetComponent<Sign>() != null ||
                Vector3.Dot(hit.normal, facing) < 0.7f || Mathf.Abs(Vector3.Dot(hit.point - doorMiddle, outward)) > 0.5f)
            {
                return false;
            }

            // A wall whose model stands proud of its collider on this side (the 2x2 wood wall's cross bar when it faces
            // the sign, T-606 and T-612) would have the sign clip through it: try the next place instead.
            if (Proud(wall, facing, hit.point, place.y, sign.extents.y) > 0.06f)
            {
                return false;
            }

            // The sign's back against the wall, its middle at the place.
            Vector3 face = hit.point;
            // set 2 cm into the wall so the game counts it as resting on the wall (Tyler: a sign may clip a little)
            spot = face + facing * (-sign.min.z - 0.02f) - rotation * new Vector3(sign.center.x, sign.center.y, 0f);
            spot.y = place.y - sign.center.y;

            // Nothing in front of the wall where the sign goes (a torch, a shelf, a window frame).
            Vector3 boxMiddle = spot + rotation * sign.center + facing * 0.03f;
            Vector3 half = new Vector3(sign.extents.x * 0.9f, sign.extents.y * 0.9f, Mathf.Max(0.02f, sign.extents.z * 0.5f));
            foreach (Collider collider in Physics.OverlapBox(boxMiddle, half, rotation, ~0, QueryTriggerInteraction.Ignore))
            {
                if (collider.GetComponentInParent<Heightmap>() != null || collider.GetComponentInParent<Character>() != null ||
                    collider.GetComponentInParent<ItemDrop>() != null)
                {
                    continue;
                }

                ZNetView other = collider.GetComponentInParent<ZNetView>();
                if (other != null && other != wall)
                {
                    return false;
                }
            }

            // The wall reaches the sign's ends too (a sign half off the end of a wall looks wrong and may break).
            Vector3 along = Vector3.Cross(Vector3.up, facing).normalized;
            foreach (float end in new[] { -0.8f, 0.8f })
            {
                Vector3 probe = new Vector3(face.x, place.y, face.z) + along * sign.extents.x * end;
                if (!Physics.Raycast(probe + facing * 0.5f, -facing, out RaycastHit endHit, 0.8f, mask, QueryTriggerInteraction.Ignore) ||
                    endHit.collider.GetComponentInParent<Door>() != null || endHit.collider.GetComponentInParent<ZNetView>() == null ||
                    endHit.collider.GetComponentInParent<ZNetView>().GetZDO().GetInt(Keys.BuiltBy) != hearth.VillageId)
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>For 'vh homes': the home's front door and its signs.</summary>
        public static string Describe(VillageHearth hearth, Plot plot)
        {
            if (!On)
            {
                return "House signs are off (HouseSigns).";
            }

            if (!ZoneSystem.instance.IsZoneLoaded(plot.Position))
            {
                return "Not loaded.";
            }

            Door door = FrontDoor(hearth, plot);
            List<(Sign Sign, int Slot)> signs = Signs(hearth, plot);
            string doorText = door == null ? "no front door found" : $"front door at {door.transform.position.ToString("F1")}";
            string signText = signs.Count == 0
                ? "no signs yet"
                : string.Join("; ", signs.OrderBy(s => s.Slot).Select(s =>
                    $"{(s.Slot == FrontSlot ? "front" : $"inside {s.Slot + 1}")}: \"{Plain(s.Sign.GetComponent<ZNetView>()?.GetZDO()?.GetString(ZDOVars.s_text, ""))}\""));
            return $"{doorText}, {signText}.";
        }

        /// <summary>The sign's text without its color and size tags, for the console.</summary>
        private static string Plain(string text) =>
            System.Text.RegularExpressions.Regex.Replace((text ?? "").Replace("<br>", " / "), "<[^>]*>", "");
    }
}
