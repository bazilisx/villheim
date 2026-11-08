using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using HarmonyLib;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The village's map table: from MapTableFromStage (a hamlet) on, the game's own cartography table (MapTablePrefab)
    /// stands by the hearth, across from the chest. Reading it copies everything the village knows (Knowledge) onto the
    /// player's map as ordinary pins he can delete: named, one icon per kind, none twice. Writing to it is refused; the
    /// village's map is its own.
    ///
    /// The table is an amenity (Amenities, last in its list): the builder makes it, hammering, paid from the chest in
    /// the tracked materials of its recipe (the rest let off), and makes it again if it is destroyed. Nothing appears by
    /// itself (Tyler, 2026-11-08: no instant buildings). Vanilla has no small map table: Hildir's is part of her camp,
    /// and the stool-sized one some mods add (hildir_maptable_coe) is not a vanilla piece.
    /// </summary>
    internal static class MapTables
    {
        public const string JobName = "map table";
        private const float FromHearth = 4.5f;

        private static readonly int KeyTable = "villheim_maptable".GetStableHashCode();
        private static readonly int KeyTablePos = "villheim_maptable_pos".GetStableHashCode();

        private static bool On => Knowledge.On && LogicConfig.IsOn(LogicConfig.MapTable);

        private static int FromStage => LogicConfig.MapTableFromStage != null ? LogicConfig.MapTableFromStage.Value : 2;

        /// <summary>Hildir's small map table copied from her camp (MapTableProp, Props), else MapTablePrefab.</summary>
        private static string Prefab => Props.Get(LogicConfig.MapTableProp?.Value, true) ??
                                        (string.IsNullOrWhiteSpace(LogicConfig.MapTablePrefab?.Value)
                                            ? "piece_cartographytable"
                                            : LogicConfig.MapTablePrefab.Value.Trim());

        /// <summary>Kept for the knowledge tick, which used to put the table down: the builder makes it now (Job).</summary>
        public static void Ensure(VillageHearth hearth, VillageState state)
        {
        }

        /// <summary>The job of making the table, for Amenities, or null when it stands or isn't due.</summary>
        public static Amenities.Job Job(VillageHearth hearth, VillageState state)
        {
            if (!On || Living.Stage(state) < FromStage || Find(hearth) != null)
            {
                return null;
            }

            GameObject prefab = ZNetScene.instance != null ? ZNetScene.instance.GetPrefab(Prefab) : null;
            if (prefab == null)
            {
                return null;
            }

            Vector3 spot = hearth.Zdo.GetVec3(KeyTablePos, Vector3.zero);
            if ((spot == Vector3.zero || !ZoneSystem.instance.IsZoneLoaded(spot)) && !FindSpot(hearth, state, out spot))
            {
                return null;
            }

            // Only what the village gathers and its biome gives is paid; the rest of the recipe (bronze, feathers) is let off.
            var cost = new Dictionary<string, int>();
            HashSet<string> allowed = Materials.AllowedIn(state.Biome);
            foreach (KeyValuePair<string, int> part in Designs.DesignSpawner.RecipeCost(prefab))
            {
                if (Materials.Tracked.Contains(part.Key) && allowed.Contains(part.Key))
                {
                    cost[part.Key] = part.Value;
                }
            }

            Vector3 toHearth = (hearth.transform.position - spot).Horizontal();
            return new Amenities.Job
            {
                Prefab = Prefab, Name = JobName, Spot = spot, Cost = cost,
                Rotation = toHearth.sqrMagnitude > 0.01f ? Quaternion.LookRotation(toHearth.normalized) : Quaternion.identity,
            };
        }

        /// <summary>Marks a table the builder just made as the village's.</summary>
        public static void Made(VillageHearth hearth, ZNetView view, Vector3 spot)
        {
            bool first = hearth.Zdo.GetVec3(KeyTablePos, Vector3.zero) == Vector3.zero;
            view.GetZDO().Set(KeyTable, hearth.VillageId);
            hearth.Zdo.Set(KeyTablePos, spot);
            Chronicle.Add(hearth, first
                ? "We put up a map table by the hearth, with what we know of the land on it."
                : "We put the map table back by the hearth.");
            VillheimPlugin.Log.LogInfo($"{hearth.VillageName}: map table at {spot}.");
        }

        public static MapTable Find(VillageHearth hearth)
        {
            Vector3 at = hearth.Zdo.GetVec3(KeyTablePos, Vector3.zero);
            if (at == Vector3.zero)
            {
                return null;
            }

            foreach (Collider collider in Physics.OverlapCapsule(at + Vector3.down * 6f, at + Vector3.up * 6f, 2.5f))
            {
                MapTable table = collider.GetComponentInParent<MapTable>();
                if (table != null && table.m_nview != null && table.m_nview.IsValid() &&
                    table.m_nview.GetZDO().GetInt(KeyTable) == hearth.VillageId)
                {
                    return table;
                }
            }

            return null;
        }

        /// <summary>Across the hearth from the chest, or round the hearth where nothing stands.</summary>
        private static bool FindSpot(VillageHearth hearth, VillageState state, out Vector3 spot)
        {
            Vector3 center = hearth.transform.position;
            var pieces = new List<Piece>();
            for (int i = 0; i < 12; i++)
            {
                float turn = (i + 1) / 2 * 30f * (i % 2 == 0 ? 1f : -1f);
                Vector3 side = Quaternion.Euler(0f, state.Axis - 90f + turn, 0f) * Vector3.forward;
                Vector3 p = center + side * (FromHearth + (i % 3) * 0.6f);
                if (!ZoneSystem.instance.GetGroundHeight(p, out float y) || y < ZoneSystem.instance.m_waterLevel + 0.5f ||
                    Mathf.Abs(y - center.y) > 1.5f)
                {
                    continue;
                }

                pieces.Clear();
                Piece.GetAllPiecesInRadius(new Vector3(p.x, y, p.z), 1.6f, pieces);
                if (pieces.Count == 0)
                {
                    spot = new Vector3(p.x, y, p.z);
                    return true;
                }
            }

            spot = Vector3.zero;
            return false;
        }

        private static int VillageOf(MapTable table) =>
            table != null && table.m_nview != null && table.m_nview.IsValid() ? table.m_nview.GetZDO().GetInt(KeyTable) : 0;

        // ---------------------------------------------------------------- reading the table

        /// <summary>Copies the village's discoveries to the player's map. Returns the message shown.</summary>
        public static string CopyTo(VillageHearth hearth, Minimap map)
        {
            if (map == null)
            {
                return "No map.";
            }

            int added = 0, had = 0;
            foreach (Knowledge.Discovery d in Knowledge.Log(hearth))
            {
                string name = PinName(d);
                if (map.m_pins.Any(p => p.m_name == name && Utils.DistanceXZ(p.m_pos, d.Position) < 30f || Utils.DistanceXZ(p.m_pos, d.Position) < 6f))
                {
                    had++;
                    continue;
                }

                if (MapPins.AddPin(map, d.Position, PinType(d.Kind), name, true) != null)
                {
                    added++;
                }
            }

            if (added == 0)
            {
                return had > 0 ? $"Nothing new on {hearth.VillageName}'s map." : $"{hearth.VillageName}'s map is empty so far.";
            }

            return $"Copied {added} places from {hearth.VillageName}'s map" + (had > 0 ? $" ({had} already on yours)." : ".");
        }

        public static string PinName(Knowledge.Discovery d)
        {
            string name = Rumours.Short(d);
            if (name.StartsWith("the ")) name = name.Substring(4);
            name = name.Length > 0 ? char.ToUpperInvariant(name[0]) + name.Substring(1) : d.Key;
            if (d.Kind == "game" || d.Kind == "foe")
            {
                name += d.When == "night" ? " (night)" : d.When == "day" ? " (day)" : "";
            }
            else if (d.Kind == "biome")
            {
                name += " edge";
            }

            return name;
        }

        private static Minimap.PinType PinType(string kind)
        {
            switch (kind)
            {
                case "boss": return Minimap.PinType.Boss;
                case "dungeon": return Minimap.PinType.Icon4;
                case "trader": return Minimap.PinType.Icon1;
                case "ore": return Minimap.PinType.Icon2;
                case "nest":
                case "foe": return Minimap.PinType.Icon0;
                default: return Minimap.PinType.Icon3;
            }
        }

        [HarmonyPatch]
        internal static class ReadPatch
        {
            private static IEnumerable<MethodBase> TargetMethods() =>
                AccessTools.GetDeclaredMethods(typeof(MapTable)).Where(m => m.Name == nameof(MapTable.OnRead));

            private static bool Prefix(MapTable __instance, Humanoid user, ref bool __result)
            {
                int id = VillageOf(__instance);
                if (id == 0)
                {
                    return true;
                }

                __result = true;
                try
                {
                    VillageHearth hearth = VillageHearth.Find(id);
                    if (user is Player player && player == Player.m_localPlayer && hearth != null && hearth.IsValid)
                    {
                        player.Message(MessageHud.MessageType.Center, CopyTo(hearth, Minimap.instance));
                    }
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Village map table: {e.Message}");
                }

                return false;
            }
        }

        [HarmonyPatch]
        internal static class WritePatch
        {
            private static IEnumerable<MethodBase> TargetMethods() =>
                AccessTools.GetDeclaredMethods(typeof(MapTable)).Where(m => m.Name == nameof(MapTable.OnWrite));

            private static bool Prefix(MapTable __instance, Humanoid user, ref bool __result)
            {
                int id = VillageOf(__instance);
                if (id == 0)
                {
                    return true;
                }

                __result = true;
                VillageHearth hearth = VillageHearth.Find(id);
                if (user is Player player && player == Player.m_localPlayer)
                {
                    player.Message(MessageHud.MessageType.Center,
                        $"This is {(hearth != null ? hearth.VillageName : "the village")}'s map. You can copy from it, not draw on it.");
                }

                return false;
            }
        }

        [HarmonyPatch(typeof(MapTable), nameof(MapTable.GetReadHoverText))]
        internal static class ReadHoverPatch
        {
            private static void Postfix(MapTable __instance, ref string __result)
            {
                int id = VillageOf(__instance);
                if (id == 0)
                {
                    return;
                }

                VillageHearth hearth = VillageHearth.Find(id);
                string village = hearth != null ? hearth.VillageName : "The village";
                int known = hearth != null ? Knowledge.Log(hearth).Count : 0;
                string use = Localization.instance != null ? Localization.instance.Localize("[<color=yellow><b>$KEY_Use</b></color>]") : "[E]";
                __result = $"{village}'s map ({known} places)\n{use} Copy them to your map";
            }
        }

        [HarmonyPatch(typeof(MapTable), nameof(MapTable.GetWriteHoverText))]
        internal static class WriteHoverPatch
        {
            private static void Postfix(MapTable __instance, ref string __result)
            {
                if (VillageOf(__instance) != 0)
                {
                    __result = "";
                }
            }
        }

        // ---------------------------------------------------------------- command

        /// <summary>'vh know table': puts the table down now if it is missing, and says where it stands.</summary>
        /// <summary>Puts the table down at once: only for the test command.</summary>
        private static MapTable Place(VillageHearth hearth, Vector3 spot, bool first)
        {
            GameObject prefab = ZNetScene.instance != null ? ZNetScene.instance.GetPrefab(Prefab) : null;
            if (prefab == null)
            {
                VillheimPlugin.Log.LogWarning($"Village knowledge: no '{Prefab}' prefab for the map table.");
                return null;
            }

            Vector3 toHearth = (hearth.transform.position - spot).Horizontal();
            Quaternion facing = toHearth.sqrMagnitude > 0.01f ? Quaternion.LookRotation(toHearth.normalized) : Quaternion.identity;
            GameObject made = Object.Instantiate(prefab, spot, facing);
            ZNetView view = made.GetComponent<ZNetView>();
            if (view == null || !view.IsValid())
            {
                return null;
            }

            view.GetZDO().Set(Keys.BuiltBy, hearth.VillageId);
            Made(hearth, view, spot);
            return made.GetComponent<MapTable>();
        }

        public static string Command(VillageHearth hearth, VillageState state)
        {
            if (!hearth.NView.IsOwner())
            {
                hearth.NView.ClaimOwnership();
            }

            MapTable table = Find(hearth);
            if (table == null)
            {
                Vector3 recorded = hearth.Zdo.GetVec3(KeyTablePos, Vector3.zero);
                Vector3 spot = recorded;
                if (recorded == Vector3.zero && !FindSpot(hearth, state, out spot))
                {
                    return "No clear ground by the hearth for a map table.";
                }

                table = Place(hearth, spot, recorded == Vector3.zero);
            }

            string gate = Living.Stage(state) < FromStage ? $" (the village only puts one up itself from stage {FromStage})" : "";
            return table != null
                ? $"{hearth.VillageName}'s map table stands at {table.transform.position}{gate}. Use it to copy {Knowledge.Log(hearth).Count} places to your map."
                : "Could not make the map table.";
        }
    }
}
