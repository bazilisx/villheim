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
    /// </summary>
    internal static class NoticeBoard
    {
        public const string BlueprintName = "villagenotice";

        /// <summary>On the old single notice sign (1) and on every piece of the board (2).</summary>
        public static readonly int Key = "villheim_noticeboard".GetStableHashCode();

        private static readonly int KeyOrigin = "villheim_board_pos".GetStableHashCode();
        private static readonly int KeyYaw = "villheim_board_yaw".GetStableHashCode();
        private const int BoardPiece = 2;

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
            foreach (DesignSpawner.PlanEntry entry in Blueprints.MakePlan(blueprint, origin, yaw))
            {
                if (onChest && IsChest(entry.Prefab))
                {
                    continue; // the village chest is the board's chest
                }

                Vector3 at = origin + turn * entry.LocalPosition;
                if (!Standing(at, entry.Prefab, hearth.VillageId))
                {
                    missing.Add(entry);
                }
            }

            return missing;
        }

        private static bool Standing(Vector3 at, string prefab, int villageId)
        {
            foreach (Collider collider in Physics.OverlapSphere(at, 0.5f))
            {
                ZNetView view = collider.GetComponentInParent<ZNetView>();
                if (view != null && view.IsValid() && Utils.GetPrefabName(view.gameObject) == prefab &&
                    view.GetZDO().GetInt(Keys.BuiltBy) == villageId)
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>The job of making (or mending) the board, for Amenities, or null when it stands whole.</summary>
        public static Amenities.Job Job(VillageHearth hearth)
        {
            List<DesignSpawner.PlanEntry> missing = Missing(hearth, out Vector3 origin, out float yaw);
            if (missing.Count == 0)
            {
                return null;
            }

            var cost = new Dictionary<string, int>();
            foreach (DesignSpawner.PlanEntry entry in missing)
            {
                GameObject prefab = ZNetScene.instance.GetPrefab(entry.Prefab);
                if (prefab == null)
                {
                    continue;
                }

                foreach (KeyValuePair<string, int> part in DesignSpawner.RecipeCost(prefab))
                {
                    if (Materials.Tracked.Contains(part.Key))
                    {
                        cost.TryGetValue(part.Key, out int n);
                        cost[part.Key] = n + part.Value;
                    }
                }
            }

            return new Amenities.Job
            {
                Prefab = BlueprintName,
                Name = "notice board",
                Spot = origin + Quaternion.Euler(0f, yaw, 0f) * missing[0].LocalPosition,
                Rotation = Quaternion.Euler(0f, yaw, 0f),
                Cost = cost,
                Essential = true,
            };
        }

        /// <summary>Puts up the board's missing pieces (already paid for) and takes the old ground signs away.</summary>
        public static bool Build(VillageHearth hearth)
        {
            List<DesignSpawner.PlanEntry> missing = Missing(hearth, out Vector3 origin, out float yaw);
            if (missing.Count == 0)
            {
                return false;
            }

            Quaternion turn = Quaternion.Euler(0f, yaw, 0f);
            foreach (DesignSpawner.PlanEntry entry in missing)
            {
                GameObject made = DesignSpawner.SpawnEntry(entry, origin, turn, hearth.VillageId, true);
                ZNetView view = made != null ? made.GetComponent<ZNetView>() : null;
                if (view != null && view.IsValid())
                {
                    view.GetZDO().Set(Key, BoardPiece);
                    view.GetZDO().Set(Keys.BuiltBy, hearth.VillageId);
                }
            }

            RemoveOldSigns(hearth);
            Update(hearth, true);
            return true;
        }

        private static void RemoveOldSigns(VillageHearth hearth)
        {
            var old = new List<ZNetView>();
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                if (view != null && view.IsValid() && view.GetComponent<Sign>() != null &&
                    view.GetZDO().GetInt(Keys.BuiltBy) == hearth.VillageId && view.GetZDO().GetInt(Key) != BoardPiece &&
                    Utils.DistanceXZ(view.transform.position, hearth.transform.position) < 12f)
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

        /// <summary>Rewrites the board's signs (every 20 seconds, or now).</summary>
        public static void Update(VillageHearth hearth, bool now = false)
        {
            if (!now && NextUpdate.TryGetValue(hearth.VillageId, out float next) && Time.time < next)
            {
                return;
            }

            NextUpdate[hearth.VillageId] = Time.time + 20f;
            Vector3 origin = hearth.Zdo.GetVec3(KeyOrigin, Vector3.zero);
            if (origin == Vector3.zero)
            {
                return;
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
            Write(title, $"<#fff>{state.Name}");
            string[] lines = Lines(hearth, state);
            for (int i = 0; i < cells.Count && i < lines.Length; i++)
            {
                Write(cells[i], lines[i]);
            }
        }

        private static string[] Lines(VillageHearth hearth, VillageState state)
        {
            const string Value = "#bdf";
            int level = VillageBrain.TierIndex(state.Plots.Count) + 1;

            string project;
            string projectColor;
            if (ConstructionSite.IsActive(hearth.Zdo))
            {
                Role role = ConstructionSite.Get(hearth.Zdo).Role;
                project = Capital(VillageBrain.RoleName(role));
                projectColor = RoleColor(role);
            }
            else
            {
                string label = Growth.PendingLabel(hearth, state);
                project = label == "nothing" ? "Resting" : Capital(label.StartsWith("a ") ? label.Substring(2) : label);
                projectColor = "#bfb";
                foreach (Role role in System.Enum.GetValues(typeof(Role)))
                {
                    if (label.Contains(VillageBrain.RoleName(role)))
                    {
                        projectColor = RoleColor(role);
                    }
                }
            }

            VillageNeeds needs = VillageNeeds.For(hearth.VillageId);
            string needed = "Nothing";
            string neededColor = "#bfb";
            if (needs != null && needs.Missing.Count > 0)
            {
                KeyValuePair<string, int> top = needs.Missing.OrderByDescending(n => n.Value).First();
                needed = $"{top.Value} {Materials.Label(top.Key)}";
                neededColor = top.Key == Materials.Stone ? "#ddd" : "#eca";
            }

            float mood = VillageMood.Get(hearth.VillageId);
            string moodColor = mood >= 70f ? "#bfb" : mood >= 50f ? "#ffa" : mood >= 30f ? "#fc9" : "#f99";
            return new[]
            {
                $"<#fff>Level:<br><{Value}>{level}",
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
