using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Vanilla models that live only inside a location prefab, made into pieces a village can build (D-047): Hildir's
    /// small map on a stool and the tents round her camp that flutter in the wind. Nothing new is modelled: the piece
    /// is a copy of the location's own child object (its meshes, materials, colliders and cloth), with the game's own
    /// components added to make it a networked piece (ZNetView, Piece, and for the map table MapTable with its two
    /// Switch handles). All of them are vanilla types, so a logic reload never leaves a piece pointing at an unloaded
    /// class.
    ///
    /// - A prop is named in the config as "location:child", the child found by the start of its name (case ignored),
    ///   e.g. "Hildir_camp:map". 'vh props &lt;location&gt; [filter]' lists a location's children so the names can be
    ///   checked in game.
    /// - The piece is registered with the game's scene under "vh_prop_&lt;location&gt;_&lt;child&gt;", once the locations are
    ///   loaded (ZoneSystem.Start) and again on demand. Its template sits under an inactive holder, kept for the session.
    ///   The location's asset stays loaded while the template uses its meshes.
    /// - When the child is not found, the prop is not made and the caller falls back (the map table to
    ///   MapTablePrefab, the decor to nothing).
    /// </summary>
    internal static class Props
    {
        private const string Prefix = "vh_prop_";
        private static GameObject _holder;
        private static readonly Dictionary<string, string> Registered = new Dictionary<string, string>();
        private static readonly HashSet<string> Failed = new HashSet<string>();

        public static string HolderName => "Villheim props";

        /// <summary>Registers every prop the config names. Called once the locations are loaded.</summary>
        public static void RegisterAll()
        {
            Failed.Clear();
            Get(LogicConfig.MapTableProp?.Value, true);
            foreach (string spec in DecorSpecs())
            {
                Get(spec, false);
            }
        }

        public static IEnumerable<string> DecorSpecs() =>
            (LogicConfig.DecorProps?.Value ?? "").Split(',').Select(s => s.Trim()).Where(s => s.Contains(":"));

        /// <summary>
        /// The prefab name of the prop for "location:child", registering it on first use. Null when the location or
        /// child is not found (tried once per session and logged).
        /// </summary>
        public static string Get(string spec, bool mapTable)
        {
            if (string.IsNullOrWhiteSpace(spec) || ZNetScene.instance == null || ZoneSystem.instance == null || !spec.Contains(":"))
            {
                return null;
            }

            spec = spec.Trim();
            string key = spec + (mapTable ? "|map" : "");
            if (Registered.TryGetValue(key, out string known) && ZNetScene.instance.GetPrefab(known) != null)
            {
                return known;
            }

            if (Failed.Contains(key))
            {
                return null;
            }

            int colon = spec.IndexOf(':');
            string locationName = spec.Substring(0, colon).Trim();
            string childName = spec.Substring(colon + 1).Trim();
            string name = Prefix + Clean(locationName) + "_" + Clean(childName) + (mapTable ? "_map" : "");
            if (ZNetScene.instance.GetPrefab(name) != null)
            {
                // Made by an earlier logic build this session, or by this one on an earlier world load.
                Registered[key] = name;
                return name;
            }

            ZoneSystem.ZoneLocation location = FindLocation(locationName);
            if (location == null)
            {
                Fail(key, $"no location named '{locationName}'");
                return null;
            }

            Designs.AssetGuard.Load(location);
            GameObject asset = location.m_prefab.Asset;
            Transform child = asset != null ? FindChild(asset.transform, childName) : null;
            if (child == null)
            {
                Fail(key, $"no child starting with '{childName}' in {location.m_prefabName}");
                return null;
            }

            Transform kept = Holder().Find(name);
            GameObject template = kept != null ? kept.gameObject : MakeTemplate(name, asset.transform, child, mapTable);
            if (template == null)
            {
                Fail(key, $"could not copy {child.name}");
                return null;
            }

            ZNetScene.instance.m_prefabs.Add(template);
            ZNetScene.instance.m_namedPrefabs[name.GetStableHashCode()] = template;
            Registered[key] = name;
            VillheimPlugin.Log.LogInfo($"Props: '{spec}' is the piece {name} (from {Path(asset.transform, child)}).");
            return name;
        }

        private static void Fail(string key, string why)
        {
            Failed.Add(key);
            VillheimPlugin.Log.LogInfo($"Props: {why}; 'vh props <location> [filter]' lists what a location holds.");
        }

        private static string Clean(string text) =>
            new string(text.ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '_').ToArray());

        public static ZoneSystem.ZoneLocation FindLocation(string name)
        {
            List<ZoneSystem.ZoneLocation> all = ZoneSystem.instance != null ? ZoneSystem.instance.m_locations : null;
            if (all == null)
            {
                return null;
            }

            return all.FirstOrDefault(l => l != null && string.Equals(l.m_prefabName, name, System.StringComparison.OrdinalIgnoreCase)) ??
                   all.FirstOrDefault(l => l != null && l.m_prefabName != null &&
                                           l.m_prefabName.IndexOf(name, System.StringComparison.OrdinalIgnoreCase) >= 0);
        }

        /// <summary>
        /// The child by its path from the root ("a/b/c", as 'vh props' prints it), or else the first (depth first) whose
        /// name starts with the text, then the first that contains it.
        /// </summary>
        private static Transform FindChild(Transform root, string name)
        {
            List<Transform> all = root.GetComponentsInChildren<Transform>(true).Where(t => t != root).ToList();
            if (name.Contains("/"))
            {
                return all.FirstOrDefault(t => Path(root, t).EndsWith(name, System.StringComparison.OrdinalIgnoreCase));
            }

            return all.FirstOrDefault(t => t.name.StartsWith(name, System.StringComparison.OrdinalIgnoreCase)) ??
                   all.FirstOrDefault(t => t.name.IndexOf(name, System.StringComparison.OrdinalIgnoreCase) >= 0);
        }

        private static string Path(Transform root, Transform t)
        {
            var parts = new List<string>();
            for (Transform at = t; at != null && at != root; at = at.parent)
            {
                parts.Add(at.name);
            }

            parts.Reverse();
            return string.Join("/", parts);
        }

        private static Transform Holder()
        {
            if (_holder == null)
            {
                _holder = GameObject.Find(HolderName);
            }

            if (_holder == null)
            {
                _holder = new GameObject(HolderName);
                _holder.SetActive(false);
                Object.DontDestroyOnLoad(_holder);
            }

            return _holder.transform;
        }

        /// <summary>
        /// A networked piece made from a copy of the child: the copy's own scripts are taken off (it keeps meshes,
        /// colliders, cloth and lights), it is set on its base at the root's origin, and a ZNetView and a Piece go on the
        /// root. For the map table, a MapTable with its read handle over the model and a write handle without a collider.
        /// </summary>
        private static GameObject MakeTemplate(string name, Transform assetRoot, Transform child, bool mapTable)
        {
            Transform holder = Holder();
            var root = new GameObject(name);
            root.transform.SetParent(holder, false);
            GameObject model = Object.Instantiate(child.gameObject, root.transform, false);
            model.name = child.name;
            model.transform.localPosition = Vector3.zero;
            model.transform.localRotation = Quaternion.Inverse(assetRoot.rotation) * child.rotation;
            model.transform.localScale = child.lossyScale;
            Strip(model);

            Bounds? bounds = MeshBounds(root.transform);
            if (bounds.HasValue)
            {
                // Its base on the ground at the root, its middle over the root.
                Vector3 shift = new Vector3(-bounds.Value.center.x, -bounds.Value.min.y, -bounds.Value.center.z);
                model.transform.localPosition += shift;
                bounds = new Bounds(bounds.Value.center + shift, bounds.Value.size);
            }

            int pieceLayer = LayerMask.NameToLayer("piece");
            foreach (Transform t in root.GetComponentsInChildren<Transform>(true))
            {
                if (pieceLayer >= 0)
                {
                    t.gameObject.layer = pieceLayer;
                }
            }

            Bounds box = bounds ?? new Bounds(Vector3.up * 0.5f, Vector3.one);
            if (root.GetComponentsInChildren<Collider>(true).All(c => c.isTrigger))
            {
                BoxCollider collider = root.AddComponent<BoxCollider>();
                collider.center = box.center;
                collider.size = box.size;
            }

            ZNetView view = root.AddComponent<ZNetView>();
            view.m_persistent = true;
            view.m_type = ZDO.ObjectType.Default;

            Piece piece = root.AddComponent<Piece>();
            piece.m_name = mapTable ? "$piece_cartographytable" : child.name;
            piece.m_description = "";
            piece.m_category = Piece.PieceCategory.Furniture;
            piece.m_canBeRemoved = true;
            piece.m_resources = Resources(mapTable);

            if (mapTable)
            {
                MapTable vanilla = ZNetScene.instance.GetPrefab("piece_cartographytable")?.GetComponent<MapTable>();
                MapTable table = root.AddComponent<MapTable>();
                table.m_name = vanilla != null ? vanilla.m_name : "$piece_cartographytable";
                table.m_writeEffects = vanilla != null ? vanilla.m_writeEffects : new EffectList();
                table.m_readSwitch = Handle(root.transform, "read", vanilla?.m_readSwitch, box, pieceLayer);
                table.m_writeSwitch = Handle(root.transform, "write", vanilla?.m_writeSwitch, null, pieceLayer);
            }

            return root;
        }

        /// <summary>A Switch for the map table: with a box over the model for reading, without one for writing.</summary>
        private static Switch Handle(Transform root, string name, Switch vanilla, Bounds? box, int layer)
        {
            var go = new GameObject(name);
            go.transform.SetParent(root, false);
            if (layer >= 0)
            {
                go.layer = layer;
            }

            if (box.HasValue)
            {
                BoxCollider collider = go.AddComponent<BoxCollider>();
                collider.center = box.Value.center;
                collider.size = box.Value.size + Vector3.one * 0.1f;
            }

            Switch handle = go.AddComponent<Switch>();
            handle.m_name = vanilla != null ? vanilla.m_name : name;
            handle.m_hoverText = vanilla != null ? vanilla.m_hoverText : "";
            handle.m_holdRepeatInterval = vanilla != null ? vanilla.m_holdRepeatInterval : 0f;
            return handle;
        }

        /// <summary>What taking it down gives back: the cartography table's recipe for the map, a little wood for decor.</summary>
        private static Piece.Requirement[] Resources(bool mapTable)
        {
            Piece vanilla = mapTable ? ZNetScene.instance.GetPrefab("piece_cartographytable")?.GetComponent<Piece>() : null;
            if (vanilla != null && vanilla.m_resources != null)
            {
                return vanilla.m_resources;
            }

            ItemDrop wood = ObjectDB.instance ? ObjectDB.instance.GetItemPrefab(Materials.Wood)?.GetComponent<ItemDrop>() : null;
            return wood == null
                ? new Piece.Requirement[0]
                : new[] { new Piece.Requirement { m_resItem = wood, m_amount = mapTable ? 10 : 6, m_recover = true } };
        }

        /// <summary>Takes the copy's scripts and bodies off (spawners, network views, location parts), keeping its look.</summary>
        private static void Strip(GameObject model)
        {
            for (int pass = 0; pass < 3; pass++)
            {
                foreach (Component component in model.GetComponentsInChildren<Component>(true))
                {
                    if (component is MonoBehaviour || component is Rigidbody || component is Joint)
                    {
                        try
                        {
                            Object.DestroyImmediate(component);
                        }
                        catch (System.Exception)
                        {
                            // Something else needs it; the next pass takes it once that is gone.
                        }
                    }
                }
            }
        }

        private static Bounds? MeshBounds(Transform root)
        {
            Bounds? all = null;
            void Add(Transform t, Bounds local)
            {
                Vector3 min = local.min, max = local.max;
                for (int i = 0; i < 8; i++)
                {
                    var corner = new Vector3((i & 1) == 0 ? min.x : max.x, (i & 2) == 0 ? min.y : max.y, (i & 4) == 0 ? min.z : max.z);
                    Vector3 p = root.InverseTransformPoint(t.TransformPoint(corner));
                    if (all.HasValue)
                    {
                        Bounds b = all.Value;
                        b.Encapsulate(p);
                        all = b;
                    }
                    else
                    {
                        all = new Bounds(p, Vector3.zero);
                    }
                }
            }

            foreach (MeshFilter filter in root.GetComponentsInChildren<MeshFilter>(true))
            {
                if (filter.sharedMesh != null)
                {
                    Add(filter.transform, filter.sharedMesh.bounds);
                }
            }

            foreach (SkinnedMeshRenderer skinned in root.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                if (skinned.sharedMesh != null)
                {
                    Add(skinned.transform, skinned.sharedMesh.bounds);
                }
            }

            return all;
        }

        // ---------------------------------------------------------------- the command

        /// <summary>
        /// 'vh props &lt;location&gt; [filter]': every child of the location prefab (or those whose path contains the filter),
        /// with its meshes and components, written to BepInEx/Villheim/props-&lt;location&gt;.txt; the first lines shown.
        /// Without a location: the location names that contain "hildir".
        /// </summary>
        public static string Command(string[] args)
        {
            if (ZoneSystem.instance == null)
            {
                return "Villheim: be in a world to use this.";
            }

            if (args.Length == 0)
            {
                IEnumerable<string> names = ZoneSystem.instance.m_locations.Where(l => l?.m_prefabName != null &&
                    l.m_prefabName.IndexOf("hildir", System.StringComparison.OrdinalIgnoreCase) >= 0).Select(l => l.m_prefabName);
                return "Villheim: usage 'vh props <location> [filter]'. Hildir's locations: " + string.Join(", ", names);
            }

            ZoneSystem.ZoneLocation location = FindLocation(args[0]);
            if (location == null)
            {
                return $"Villheim: no location named like '{args[0]}' ('vh locations {args[0]}' lists names).";
            }

            string filter = args.Length > 1 ? string.Join(" ", args.Skip(1)) : "";
            Designs.AssetGuard.Load(location);
            GameObject asset = location.m_prefab.Asset;
            if (asset == null)
            {
                return $"Villheim: {location.m_prefabName} could not be loaded.";
            }

            var lines = new List<string>();
            foreach (Transform t in asset.GetComponentsInChildren<Transform>(true))
            {
                string path = t == asset.transform ? "(root)" : Path(asset.transform, t);
                // 'cloth': the children that flutter in the wind (a Cloth anywhere under them), to find tents and banners.
                bool cloth = filter.Equals("cloth", System.StringComparison.OrdinalIgnoreCase);
                if (cloth ? t.GetComponentInChildren<Cloth>(true) == null || t == asset.transform
                          : filter.Length > 0 && path.IndexOf(filter, System.StringComparison.OrdinalIgnoreCase) < 0)
                {
                    continue;
                }

                var parts = new List<string>();
                MeshFilter mesh = t.GetComponent<MeshFilter>();
                if (mesh != null && mesh.sharedMesh != null)
                {
                    parts.Add("mesh " + mesh.sharedMesh.name);
                }

                SkinnedMeshRenderer skinned = t.GetComponent<SkinnedMeshRenderer>();
                if (skinned != null && skinned.sharedMesh != null)
                {
                    parts.Add("skinned " + skinned.sharedMesh.name);
                }

                string components = string.Join(", ", t.GetComponents<Component>()
                    .Where(c => c != null && !(c is Transform) && !(c is MeshFilter) && !(c is MeshRenderer))
                    .Select(Describe));
                if (components.Length > 0)
                {
                    parts.Add(components);
                }

                Vector3 at = asset.transform.InverseTransformPoint(t.position);
                lines.Add($"{path} @ {at.x:0.0},{at.y:0.0},{at.z:0.0}" + (parts.Count > 0 ? " | " + string.Join(" | ", parts) : ""));
            }

            string folder = System.IO.Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim");
            Directory.CreateDirectory(folder);
            string file = System.IO.Path.Combine(folder, $"props-{Clean(location.m_prefabName)}.txt");
            File.WriteAllLines(file, lines, Encoding.UTF8);
            VillheimPlugin.Log.LogInfo($"Props of {location.m_prefabName}{(filter.Length > 0 ? $" ('{filter}')" : "")}:\n" + string.Join("\n", lines));
            return $"Villheim: {lines.Count} objects in {location.m_prefabName}{(filter.Length > 0 ? $" matching '{filter}'" : "")}, " +
                   $"written to {file} and the log. First ones:\n" + string.Join("\n", lines.Take(25));
        }

        private static string Describe(Component component)
        {
            if (!(component is ZNetView))
            {
                return component.GetType().Name;
            }

            string prefab = Utils.GetPrefabName(component.gameObject);
            bool inScene = ZNetScene.instance != null && ZNetScene.instance.GetPrefab(prefab) != null;
            return $"ZNetView (prefab {prefab}, a scene prefab: {(inScene ? "yes" : "no")})";
        }

        /// <summary>Registers the props once the game's locations are set up, for every world loaded.</summary>
        [HarmonyLib.HarmonyPatch(typeof(ZoneSystem), nameof(ZoneSystem.Start))]
        internal static class RegisterPatch
        {
            private static void Postfix()
            {
                try
                {
                    RegisterAll();
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Props: {e.Message}");
                }
            }
        }
    }
}
