using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// 'vh gallery [meadows|blackforest]': lays out every design a village of that biome could build, side by side on
    /// one flat, cleared plain, to review them in a fresh world. Each stands flush on its pad as a village would build
    /// it (the same pieces, the bottom of its walls on the ground), with a sign in front: the kind of building and the
    /// village level it is meant for on top in bright blue, the design's name below in white.
    ///
    /// The gallery starts in front of the player and runs in rows of six away from him. First the whole area (with a
    /// 12 m margin) is made one flat, bare plain: everything standing on it is removed at any height (trees, stumps,
    /// logs, rocks, bushes, ruins, anything not a creature or built by a player), the ground is levelled at the middle height of the area
    /// (up to 40 m of change) and the grass taken off, in overlapping pads 24 m apart. A plot's design goes up once
    /// all the ground round it is done. Parts in zones that aren't loaded yet are done as the player walks up to them
    /// (checked every two seconds for 40 minutes).
    /// </summary>
    internal static class Gallery
    {
        private sealed class Cell
        {
            public DesignLibrary.Design Design;
            public Role Role;
            public Vector3 Center;
            public float Half;
            public bool Done;
        }

        private static readonly Role[] Order = { Role.House, Role.Hub, Role.Workshop, Role.Storage, Role.Farm };
        private static readonly int KeyGallery = "villheim_gallery".GetStableHashCode();
        private const float PadSpacing = 24f;
        private const float PadRadius = 20f;
        private const float Margin = 12f;

        private sealed class Pad
        {
            public Vector3 Center;
            public bool Done;
        }

        public static string Start(Player player, string biomeName)
        {
            Heightmap.Biome biome = biomeName != null && biomeName.ToLowerInvariant().StartsWith("black")
                ? Heightmap.Biome.BlackForest
                : Heightmap.Biome.Meadows;

            var seen = new HashSet<string>();
            var cells = new List<Cell>();
            foreach (Role role in Order)
            {
                foreach (DesignLibrary.Design design in DesignLibrary.PoolFor(biome, role).Concat(DesignLibrary.FallbackPool(biome, role)))
                {
                    if (seen.Add(design.Name))
                    {
                        cells.Add(new Cell { Design = design, Role = role, Half = Mathf.Clamp(design.Radius + 4f, 8f, 36f) });
                    }
                }
            }

            if (cells.Count == 0)
            {
                return $"Villheim: no designs found for {biome}.";
            }

            cells = cells.OrderBy(c => Level(c)).ThenBy(c => System.Array.IndexOf(Order, c.Role)).ThenBy(c => c.Design.Name).ToList();

            // Rows of six, away from the player.
            Vector3 forward = player.transform.forward;
            forward.y = 0f;
            forward.Normalize();
            Vector3 right = Vector3.Cross(Vector3.up, forward);
            Vector3 start = player.transform.position + forward * 6f;
            float height = start.y;
            if (ZoneSystem.instance.GetGroundHeight(start, out float ground))
            {
                height = Mathf.Max(ground, ZoneSystem.instance.m_waterLevel + 1.5f);
            }

            float depth = 0f;
            float widest = 0f;
            for (int row = 0; row * 6 < cells.Count; row++)
            {
                List<Cell> line = cells.Skip(row * 6).Take(6).ToList();
                float rowDepth = line.Max(c => c.Half);
                float width = line.Sum(c => c.Half * 2f);
                widest = Mathf.Max(widest, width);
                float x = -width / 2f;
                foreach (Cell cell in line)
                {
                    cell.Center = start + forward * (depth + rowDepth) + right * (x + cell.Half);
                    x += cell.Half * 2f;
                }

                depth += rowDepth * 2f;
            }

            // One plain over the whole gallery: pads 24 m apart, levelled at the middle height of the area.
            var pads = new List<Pad>();
            var heights = new List<float>();
            for (float z = -Margin; z <= depth + Margin; z += PadSpacing)
            {
                for (float x = -widest / 2f - Margin; x <= widest / 2f + Margin; x += PadSpacing)
                {
                    Vector3 p = start + forward * z + right * x;
                    pads.Add(new Pad { Center = p });
                    if (ZoneSystem.instance.GetGroundHeight(p, out float h))
                    {
                        heights.Add(h);
                    }
                }
            }

            heights.Sort();
            height = Mathf.Max(heights.Count > 0 ? heights[heights.Count / 2] : height, ZoneSystem.instance.m_waterLevel + 1.5f);
            foreach (Pad pad in pads)
            {
                pad.Center.y = height;
            }

            foreach (Cell cell in cells)
            {
                cell.Center.y = height;
            }

            VillheimPlugin.Instance.StartCoroutine(Build(cells, pads, forward));
            return $"Villheim: clearing and levelling {widest + Margin * 2f:0} by {depth + Margin * 2f:0} m ahead of you at {height:0.0} m, " +
                   $"then laying out {cells.Count} {biome} designs in {(cells.Count + 5) / 6} rows. Walk along it to load the far end.";
        }

        private static IEnumerator Build(List<Cell> cells, List<Pad> pads, Vector3 forward)
        {
            float until = Time.time + 40f * 60f;
            int built = 0;
            while (built < cells.Count && Time.time < until)
            {
                // Ground first: every pad whose zone is loaded is cleared, levelled and bared.
                bool shaped = false;
                foreach (Pad pad in pads.Where(p => !p.Done))
                {
                    if (!Loaded(pad.Center, PadRadius + 6f))
                    {
                        continue;
                    }

                    pad.Done = true;
                    shaped = true;
                    ClearAll(pad.Center, PadRadius + 2f);
                    TerrainShaper.LevelPad(pad.Center, PadRadius, PadRadius + 8f, 40f);
                    HearthGround.ClearVegetation(pad.Center, PadRadius + 2f);
                    yield return null;
                }

                if (shaped)
                {
                    yield return new WaitForSeconds(1f); // let the ground's collider catch up
                }

                // Then each plot whose ground is all done.
                foreach (Cell cell in cells.Where(c => !c.Done))
                {
                    float reach = cell.Half * 1.42f + PadRadius;
                    if (pads.Any(p => !p.Done && Utils.DistanceXZ(p.Center, cell.Center) < reach))
                    {
                        continue;
                    }

                    cell.Done = true;
                    int pieces = Put(cell, forward);
                    Sign(cell, forward);
                    built++;
                    VillheimPlugin.Log.LogInfo($"Gallery: {cell.Design.Name} ({Label(cell)}, level {Level(cell)}): {pieces} pieces.");
                    yield return null;
                }

                MessageHud.instance?.ShowMessage(MessageHud.MessageType.TopLeft,
                    $"Gallery: ground {pads.Count(p => p.Done)}/{pads.Count}, designs {built}/{cells.Count}");
                yield return new WaitForSeconds(2f);
            }

            VillheimPlugin.Log.LogInfo($"Gallery: {built} of {cells.Count} designs built.");
        }

        /// <summary>
        /// Takes away everything standing in the circle, at any height: trees, logs, stumps, rocks, bushes, ruins and
        /// loose objects. Creatures, graves, village hearths, location markers and the gallery's own pieces stay.
        /// </summary>
        private static void ClearAll(Vector3 center, float radius)
        {
            var doomed = new List<ZNetView>();
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                if (view == null || !view.IsValid() || Utils.DistanceXZ(view.transform.position, center) > radius)
                {
                    continue;
                }

                GameObject go = view.gameObject;
                if (go.GetComponent<Character>() || go.GetComponent<TombStone>() || go.GetComponent<VillageHearth>() ||
                    go.GetComponent<LocationProxy>() || view.GetZDO().GetInt(KeyGallery) == 1 ||
                    (go.GetComponent<Piece>() is Piece piece && piece.GetCreator() != 0L))
                {
                    continue;
                }

                doomed.Add(view);
            }

            foreach (ZNetView view in doomed)
            {
                view.ClaimOwnership();
                ZNetScene.instance.Destroy(view.gameObject);
            }
        }

        private static bool Loaded(Vector3 center, float reach)
        {
            for (int i = 0; i < 4; i++)
            {
                Vector3 corner = center + Quaternion.Euler(0f, 45f + 90f * i, 0f) * Vector3.forward * reach;
                if (!ZoneSystem.instance.IsZoneLoaded(corner))
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>The design's pieces, its foundation on the ground (see ConstructionSite.FloorOf), facing the sign.</summary>
        private static int Put(Cell cell, Vector3 forward)
        {
            float yaw = Quaternion.LookRotation(-forward).eulerAngles.y;
            List<DesignSpawner.PlanEntry> plan;
            if (cell.Design.Blueprint != null)
            {
                plan = Blueprints.MakePlan(cell.Design.Blueprint, cell.Center, yaw);
                return Spawn(plan, cell, yaw);
            }

            ZoneSystem.ZoneLocation location = cell.Design.Location;
            location.m_prefab.Load();
            try
            {
                GameObject asset = location.m_prefab.Asset;
                if (asset == null)
                {
                    return 0;
                }

                plan = DesignSpawner.MakePlan(asset, cell.Center, cell.Design.Name.GetStableHashCode(), yaw);
                return Spawn(plan, cell, yaw);
            }
            finally
            {
                location.m_prefab.Release();
            }
        }

        private static int Spawn(List<DesignSpawner.PlanEntry> plan, Cell cell, float yaw)
        {
            Vector3 origin = cell.Center - Vector3.up * ConstructionSite.FloorOf(plan);
            Quaternion turn = Quaternion.Euler(0f, yaw, 0f);
            int count = 0;
            foreach (DesignSpawner.PlanEntry entry in plan)
            {
                GameObject made = DesignSpawner.SpawnEntry(entry, origin, turn, 0, false);
                if (made != null)
                {
                    made.GetComponent<ZNetView>()?.GetZDO()?.Set(KeyGallery, 1);
                    count++;
                }
            }

            return count;
        }

        /// <summary>A sign at the front of the plot (two back to back, so it reads from either side), standing on the ground.</summary>
        private static void Sign(Cell cell, Vector3 forward)
        {
            GameObject prefab = ZNetScene.instance.GetPrefab("sign");
            if (prefab == null)
            {
                return;
            }

            string text = $"<#5cf>{Label(cell)}, {Level(cell)}<br><#fff>{cell.Design.Name}";
            Vector3 at = cell.Center - forward * (cell.Half - 1f);
            foreach (float turn in new[] { 0f, 180f })
            {
                Quaternion rotation = Quaternion.LookRotation(-forward) * Quaternion.Euler(0f, turn, 0f);
                GameObject sign = Object.Instantiate(prefab, at + rotation * Vector3.forward * 0.03f, rotation);
                StandOnGround(sign, cell.Center.y);
                ZNetView view = sign.GetComponent<ZNetView>();
                if (view != null && view.IsValid())
                {
                    view.GetZDO().Set(KeyGallery, 1);
                    view.GetZDO().Set(ZDOVars.s_text, text);
                    sign.GetComponent<Sign>()?.UpdateText();
                }
            }
        }

        private static void StandOnGround(GameObject go, float ground)
        {
            Bounds? bounds = null;
            foreach (Renderer renderer in go.GetComponentsInChildren<Renderer>())
            {
                if (bounds.HasValue)
                {
                    Bounds b = bounds.Value;
                    b.Encapsulate(renderer.bounds);
                    bounds = b;
                }
                else
                {
                    bounds = renderer.bounds;
                }
            }

            if (bounds.HasValue)
            {
                go.transform.position += Vector3.up * (ground - bounds.Value.min.y);
                go.GetComponent<ZNetView>()?.GetZDO()?.SetPosition(go.transform.position);
            }
        }

        /// <summary>The village level a design is meant for: homes from the start, the longhouse, workshop and storehouse next, farms after.</summary>
        private static int Level(Cell cell)
        {
            if (cell.Design.Blueprint != null)
            {
                return cell.Design.Blueprint.Level;
            }

            switch (cell.Role)
            {
                case Role.House: return 1;
                case Role.Farm: return 3;
                default: return 2;
            }
        }

        /// <summary>What kind of building it reads as, from its name, else its role.</summary>
        private static string Label(Cell cell)
        {
            string name = cell.Design.Name.ToLowerInvariant();
            if (name.Contains("sawmill")) return "Sawmill";
            if (name.Contains("forge") || name.Contains("smith")) return "Smithy";
            if (name.Contains("tavern") || name.Contains("hall")) return "Longhouse";
            if (name.Contains("barn")) return "Barn";
            if (name.Contains("farm")) return "Farm";
            if (name.Contains("camp")) return "Camp";
            if (name.Contains("tower")) return "Tower";
            if (name.Contains("maypole")) return "Maypole hut";
            string role = VillageBrain.RoleName(cell.Role);
            return char.ToUpperInvariant(role[0]) + role.Substring(1);
        }
    }
}
