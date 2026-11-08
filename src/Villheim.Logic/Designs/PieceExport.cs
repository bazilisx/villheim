using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using UnityEngine;

namespace Villheim.Logic.Designs
{
    /// <summary>
    /// 'vh exportpieces': every buildable piece prefab (a ZNetScene prefab with a Piece component) written to
    /// BepInEx/config/Villheim/pieces.json, so the blueprint lab (tools/blueprint-lab, lib/pieces.js) can draw and check
    /// designs with the game's own sizes in place of its rules by name.
    ///
    /// Per prefab name: the bounds of its solid colliders (centre and size in the prefab's own space, the union of all
    /// colliders that are not triggers), the bounds of its meshes, how far the pivot sits above the bottom of the
    /// collider bounds, the main material's colour (hex) and texture, the build category, comfort, the build cost
    /// (resource prefab and amount), the crafting station, and whether a tool's piece table offers it.
    ///
    /// Prefabs are assets, not objects in the scene, so Collider.bounds and Renderer.bounds are empty for them. The
    /// bounds are worked out from each collider's own shape and each mesh's bounds, carried into the root's space.
    /// </summary>
    internal static class PieceExport
    {
        public static string ExportPath => Path.Combine(BepInEx.Paths.ConfigPath, "Villheim", "pieces.json");

        public static string Run()
        {
            if (ZNetScene.instance == null)
            {
                return "Villheim: load a world first (the piece prefabs are known once the game has started).";
            }

            HashSet<string> offered = OfferedPieces();
            var prefabs = ZNetScene.instance.m_prefabs.Concat(ZNetScene.instance.m_namedPrefabs.Values)
                .Where(p => p != null && p.GetComponent<Piece>() != null)
                .GroupBy(p => p.name).Select(g => g.First()).OrderBy(p => p.name, System.StringComparer.Ordinal).ToList();

            var sb = new StringBuilder();
            sb.Append("{\n  \"version\": 1,\n");
            sb.Append("  \"game\": ").Append(Quote(Version.GetVersionString())).Append(",\n");
            sb.Append("  \"exported\": ").Append(Quote(System.DateTime.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture))).Append(",\n");
            sb.Append("  \"units\": \"metres, the prefab's own space (x right, y up, z forward)\",\n");
            sb.Append("  \"pieces\": {");
            int written = 0, failed = 0;
            foreach (GameObject prefab in prefabs)
            {
                string entry;
                try
                {
                    entry = Entry(prefab, offered);
                }
                catch (System.Exception ex)
                {
                    failed++;
                    VillheimPlugin.Log.LogWarning($"Piece export skipped {prefab.name}: {ex.Message}");
                    continue;
                }

                sb.Append(written == 0 ? "\n" : ",\n").Append("    ").Append(Quote(prefab.name)).Append(": ").Append(entry);
                written++;
            }

            sb.Append("\n  }\n}\n");
            Directory.CreateDirectory(Path.GetDirectoryName(ExportPath));
            File.WriteAllText(ExportPath, sb.ToString());
            return $"Villheim: {written} pieces written to {ExportPath}" + (failed > 0 ? $" ({failed} skipped, see the log)." : ".") +
                   " Copy it to tools/blueprint-lab/data/pieces-export.json for the blueprint lab.";
        }

        /// <summary>Pieces some tool (hammer, hoe, cultivator, mod tools) offers in its build menu.</summary>
        private static HashSet<string> OfferedPieces()
        {
            var offered = new HashSet<string>();
            if (ObjectDB.instance == null)
            {
                return offered;
            }

            foreach (GameObject item in ObjectDB.instance.m_items)
            {
                PieceTable table = item != null ? item.GetComponent<ItemDrop>()?.m_itemData?.m_shared?.m_buildPieces : null;
                if (table?.m_pieces == null)
                {
                    continue;
                }

                foreach (GameObject piece in table.m_pieces)
                {
                    if (piece != null)
                    {
                        offered.Add(piece.name);
                    }
                }
            }

            return offered;
        }

        private static string Entry(GameObject prefab, HashSet<string> offered)
        {
            Transform root = prefab.transform;
            Piece piece = prefab.GetComponent<Piece>();
            Bounds? colliders = null;
            foreach (Collider collider in prefab.GetComponentsInChildren<Collider>(true))
            {
                if (collider.isTrigger || !collider.enabled || !ActiveUnder(collider.transform, root))
                {
                    continue;
                }

                Bounds? local = ColliderBounds(collider);
                if (local.HasValue)
                {
                    colliders = Union(colliders, ToRoot(local.Value, collider.transform, root));
                }
            }

            Bounds? meshes = null;
            Material main = null;
            foreach (Renderer renderer in prefab.GetComponentsInChildren<Renderer>(true))
            {
                if (!renderer.enabled || !ActiveUnder(renderer.transform, root))
                {
                    continue;
                }

                Bounds? local = null;
                if (renderer is MeshRenderer)
                {
                    Mesh mesh = renderer.GetComponent<MeshFilter>()?.sharedMesh;
                    local = mesh != null ? mesh.bounds : (Bounds?)null;
                }
                else if (renderer is SkinnedMeshRenderer skinned)
                {
                    local = skinned.sharedMesh != null ? skinned.sharedMesh.bounds : skinned.localBounds;
                }

                if (!local.HasValue)
                {
                    continue;
                }

                meshes = Union(meshes, ToRoot(local.Value, renderer.transform, root));
                main = main ?? renderer.sharedMaterials.FirstOrDefault(m => m != null);
            }

            Bounds solid = colliders ?? meshes ?? new Bounds(Vector3.zero, Vector3.zero);
            var sb = new StringBuilder("{");
            sb.Append("\"collider\": ").Append(colliders.HasValue ? BoundsJson(colliders.Value) : "null");
            sb.Append(", \"renderer\": ").Append(meshes.HasValue ? BoundsJson(meshes.Value) : "null");
            sb.Append(", \"pivotFromBottom\": ").Append(F(-solid.min.y));
            string colour = null, texture = null;
            if (main != null)
            {
                if (main.HasProperty("_Color"))
                {
                    colour = "#" + ColorUtility.ToHtmlStringRGB(main.color);
                }

                if (main.HasProperty("_MainTex") && main.mainTexture != null)
                {
                    texture = main.mainTexture.name;
                }
            }

            sb.Append(", \"material\": ").Append(Quote(main != null ? main.name : null));
            sb.Append(", \"colour\": ").Append(Quote(colour));
            sb.Append(", \"texture\": ").Append(Quote(texture));
            sb.Append(", \"name\": ").Append(Quote(piece.m_name));
            sb.Append(", \"category\": ").Append(Quote(piece.m_category.ToString()));
            sb.Append(", \"comfort\": ").Append(piece.m_comfort.ToString(CultureInfo.InvariantCulture));
            sb.Append(", \"comfortGroup\": ").Append(Quote(piece.m_comfortGroup.ToString()));
            sb.Append(", \"station\": ").Append(Quote(piece.m_craftingStation != null ? piece.m_craftingStation.name : null));
            WearNTear wear = prefab.GetComponent<WearNTear>();
            sb.Append(", \"wearMaterial\": ").Append(Quote(wear != null ? wear.m_materialType.ToString() : null));
            sb.Append(", \"inBuildMenu\": ").Append(offered.Contains(prefab.name) ? "true" : "false");
            sb.Append(", \"cost\": {");
            int n = 0;
            foreach (Piece.Requirement requirement in piece.m_resources ?? new Piece.Requirement[0])
            {
                if (requirement?.m_resItem == null)
                {
                    continue;
                }

                sb.Append(n++ == 0 ? "" : ", ").Append(Quote(requirement.m_resItem.gameObject.name)).Append(": ")
                    .Append(requirement.m_amount.ToString(CultureInfo.InvariantCulture));
            }

            sb.Append("}}");
            return sb.ToString();
        }

        /// <summary>Active in the prefab itself (a prefab asset is never active in a scene, so activeInHierarchy is no help).</summary>
        private static bool ActiveUnder(Transform t, Transform root)
        {
            for (; t != null; t = t.parent)
            {
                if (!t.gameObject.activeSelf)
                {
                    return false;
                }

                if (t == root)
                {
                    return true;
                }
            }

            return true;
        }

        /// <summary>A collider's shape as a box in its own transform's space.</summary>
        private static Bounds? ColliderBounds(Collider collider)
        {
            switch (collider)
            {
                case BoxCollider box:
                    return new Bounds(box.center, box.size);
                case SphereCollider sphere:
                    return new Bounds(sphere.center, Vector3.one * sphere.radius * 2f);
                case CapsuleCollider capsule:
                {
                    Vector3 size = Vector3.one * capsule.radius * 2f;
                    size[Mathf.Clamp(capsule.direction, 0, 2)] = Mathf.Max(capsule.height, capsule.radius * 2f);
                    return new Bounds(capsule.center, size);
                }

                case MeshCollider mesh:
                    return mesh.sharedMesh != null ? mesh.sharedMesh.bounds : (Bounds?)null;
                default:
                    return null;
            }
        }

        /// <summary>A box in <paramref name="from"/>'s space, as the axis-aligned box round it in <paramref name="root"/>'s space.</summary>
        private static Bounds ToRoot(Bounds local, Transform from, Transform root)
        {
            Matrix4x4 m = root.worldToLocalMatrix * from.localToWorldMatrix;
            Bounds? result = null;
            for (int i = 0; i < 8; i++)
            {
                Vector3 corner = local.center + Vector3.Scale(local.extents,
                    new Vector3((i & 1) == 0 ? -1f : 1f, (i & 2) == 0 ? -1f : 1f, (i & 4) == 0 ? -1f : 1f));
                Vector3 p = m.MultiplyPoint3x4(corner);
                result = Union(result, new Bounds(p, Vector3.zero));
            }

            return result.Value;
        }

        private static Bounds Union(Bounds? a, Bounds b)
        {
            if (!a.HasValue)
            {
                return b;
            }

            Bounds u = a.Value;
            u.Encapsulate(b);
            return u;
        }

        private static string BoundsJson(Bounds b) =>
            $"{{\"center\": [{F(b.center.x)}, {F(b.center.y)}, {F(b.center.z)}], \"size\": [{F(b.size.x)}, {F(b.size.y)}, {F(b.size.z)}]}}";

        private static string F(float f) => (Mathf.Abs(f) < 0.0005f ? 0f : f).ToString("0.###", CultureInfo.InvariantCulture);

        private static string Quote(string s)
        {
            if (s == null)
            {
                return "null";
            }

            var sb = new StringBuilder("\"");
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }

            return sb.Append('"').ToString();
        }
    }
}
