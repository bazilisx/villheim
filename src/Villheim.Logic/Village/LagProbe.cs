using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using BepInEx.Configuration;
using HarmonyLib;
using UnityEngine;
using UnityEngine.Rendering;
using Villheim.Logic.Villagers;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Where a frame's time goes near a village (lag cluster B, 2026-11-10).
    ///
    /// With LagLog on, every LagSummarySeconds one "Lag summary" line gives the frame times (average, slowest 1 %,
    /// hitches) and the milliseconds per frame spent by each part: the village's own work (every Perf.Time step, the
    /// hearth tick, the villagers' update and brain) and the game's work for villagers (their AI, body and movement,
    /// gear visuals, gear models made, objects spawned). Spikes above LagLogMs in the game's parts are named one by one
    /// ("first pickaxe made took 38 ms"), which shows what is worth loading ahead of time.
    ///
    /// The draw cost of villagers (their ghost shaders, clothes, tools, hair) is on the graphics card and cannot be timed
    /// from code. 'vh lag hide ...' and 'vh lag ab ...' measure it by comparing frame times with and without: villagers
    /// hidden, their gear hidden, their shadows off, or any on/off setting flipped. 'vh lag looks' counts what each
    /// villager draws.
    /// </summary>
    internal static class LagProbe
    {
        private static GameObject _host;

        public static void Start()
        {
            if (_host != null)
            {
                return;
            }

            try
            {
                _host = new GameObject("Villheim LagProbe");
                UnityEngine.Object.DontDestroyOnLoad(_host);
                _host.hideFlags = HideFlags.HideAndDontSave;
                _host.AddComponent<Runner>();
            }
            catch (Exception ex)
            {
                // Without its own updater the probe is driven by the villagers' update (Tick), when villagers are loaded.
                VillheimPlugin.Log.LogWarning($"LagProbe: no frame updater ({ex.Message}); timing only while villagers are loaded.");
            }
        }

        public static void Stop()
        {
            Test.Abort();
            if (_host != null)
            {
                UnityEngine.Object.Destroy(_host);
                _host = null;
            }
        }

        /// <summary>Timing is on (LagLog with a summary interval, or a 'vh lag' test running).</summary>
        public static bool On;

        private static readonly double TicksToMs = 1000.0 / Stopwatch.Frequency;

        private sealed class Part
        {
            public long Ticks;
            public int Calls;
            public double Worst;
        }

        private static readonly Dictionary<string, Part> Parts = new Dictionary<string, Part>();
        private static readonly List<float> Frames = new List<float>(4096);
        private static float _windowStart;

        public static long Now() => On ? Stopwatch.GetTimestamp() : 0L;

        /// <summary>Adds the time since <paramref name="start"/> (from Now()) to a part.</summary>
        public static void Add(string part, long start)
        {
            if (start == 0L || !On)
            {
                return;
            }

            AddMs(part, (Stopwatch.GetTimestamp() - start) * TicksToMs);
        }

        public static void AddMs(string part, double ms)
        {
            if (!On)
            {
                return;
            }

            if (!Parts.TryGetValue(part, out Part entry))
            {
                if (Parts.Count >= 250)
                {
                    part = "(other parts)";
                    if (!Parts.TryGetValue(part, out entry))
                    {
                        entry = new Part();
                        Parts[part] = entry;
                    }
                }
                else
                {
                    entry = new Part();
                    Parts[part] = entry;
                }
            }

            entry.Ticks += (long)(ms / TicksToMs);
            entry.Calls++;
            if (ms > entry.Worst)
            {
                entry.Worst = ms;
            }
        }

        /// <summary>A step from Perf.Time, folded into its part ("Amenities.Find step 5" and "step 2" are one part).</summary>
        public static void AddStep(string what, double ms)
        {
            if (!On)
            {
                return;
            }

            AddMs("village: " + Normalize(what), ms);
        }

        private static string Normalize(string what)
        {
            var text = new StringBuilder(what.Length);
            bool lastDigit = false;
            foreach (char c in what)
            {
                if (char.IsDigit(c))
                {
                    if (!lastDigit)
                    {
                        text.Append('N');
                    }

                    lastDigit = true;
                    continue;
                }

                lastDigit = false;
                text.Append(c);
            }

            string s = text.ToString();
            int colon = s.IndexOf(':');
            return colon > 0 && colon < s.Length - 1 && s.Length > 60 ? s.Substring(0, colon) : s;
        }

        private static double Spike => LogicConfig.LagLogMs != null ? LogicConfig.LagLogMs.Value : 4f;

        private static void SpikeLine(string what, double ms)
        {
            if (ms >= Math.Max(4.0, Spike) && LogicConfig.LagLog != null && LogicConfig.LagLog.Value)
            {
                VillheimPlugin.Log.LogInfo($"Lag: {what} took {ms:0.0} ms (frame {Time.frameCount}).");
            }
        }

        // ---------------------------------------------------------------- frame times and the summary line

        private sealed class Runner : MonoBehaviour
        {
            private void Update() => Tick();
        }

        private static int _tickedFrame = -1;

        /// <summary>Once a frame: from the probe's own updater, and from the villagers' update as a backup.</summary>
        public static void Tick()
        {
            if (_tickedFrame == Time.frameCount)
            {
                return;
            }

            _tickedFrame = Time.frameCount;
            try
            {
                float every = LogicConfig.LagSummarySeconds != null ? LogicConfig.LagSummarySeconds.Value : 60f;
                bool summary = LogicConfig.LagLog != null && LogicConfig.LagLog.Value && every > 0f;
                On = summary || Test.Running;
                if (!On)
                {
                    Frames.Clear();
                    Parts.Clear();
                    _windowStart = Time.realtimeSinceStartup;
                    return;
                }

                Frames.Add(Time.unscaledDeltaTime * 1000f);
                Test.Frame();
                if (summary && !Test.Running && Time.realtimeSinceStartup - _windowStart >= every)
                {
                    VillheimPlugin.Log.LogInfo(Summary(Time.realtimeSinceStartup - _windowStart, 8));
                    Reset();
                }
            }
            catch (Exception ex)
            {
                VillheimPlugin.Debug("LagProbe: " + ex.Message);
            }
        }

        private static void Reset()
        {
            Frames.Clear();
            Parts.Clear();
            PieceIndex.Rebuilds = 0;
            PieceIndex.Queries = 0;
            _windowStart = Time.realtimeSinceStartup;
        }

        public struct FrameStats
        {
            public int Count;
            public double Average, P95, P99, Worst;
            public int Hitches;

            public override string ToString() =>
                Count == 0 ? "no frames" :
                $"{Count} frames, average {Average:0.0} ms ({(Average > 0 ? 1000.0 / Average : 0):0} fps), slowest 5 % {P95:0.0} ms, " +
                $"slowest 1 % {P99:0.0} ms, worst {Worst:0} ms, {Hitches} hitches over 50 ms";
        }

        public static FrameStats Stats(List<float> frames, int skip = 0)
        {
            var list = frames.Skip(skip).ToList();
            var stats = new FrameStats { Count = list.Count };
            if (list.Count == 0)
            {
                return stats;
            }

            list.Sort();
            stats.Average = list.Average();
            stats.P95 = list[Mathf.Clamp((int)(list.Count * 0.95f), 0, list.Count - 1)];
            stats.P99 = list[Mathf.Clamp((int)(list.Count * 0.99f), 0, list.Count - 1)];
            stats.Worst = list[list.Count - 1];
            stats.Hitches = list.Count(f => f > 50f);
            return stats;
        }

        public static string Summary(float seconds, int top)
        {
            FrameStats stats = Stats(Frames);
            int frames = Math.Max(1, stats.Count);
            int villagers = Character.GetAllCharacters().Count(c => c is Villager);
            var text = new StringBuilder();
            text.Append($"Lag summary ({seconds:0} s, {villagers} villagers loaded, {Piece.s_allPieces.Count} pieces loaded" +
                        $"{(Application.isFocused ? "" : ", game in the background: numbers unreliable")}): {stats}.");
            text.Append($" Per frame:");
            foreach (var pair in Parts.OrderByDescending(p => p.Value.Ticks).Take(top))
            {
                double total = pair.Value.Ticks * TicksToMs;
                text.Append($" {pair.Key} {total / frames:0.00} ms ({pair.Value.Calls} calls, worst {pair.Value.Worst:0.0});");
            }

            if (PieceIndex.Queries > 0)
            {
                text.Append($" Piece list: {PieceIndex.Queries} questions, rebuilt {PieceIndex.Rebuilds} times.");
            }

            return text.ToString();
        }

        // ---------------------------------------------------------------- the game's work for villagers

        private static bool IsVillager(Component c) => c != null && c is Villager;

        [HarmonyPatch(typeof(VillagerAI), nameof(VillagerAI.UpdateAI))]
        internal static class AiPatch
        {
            private static void Prefix(out long __state) => __state = Now();
            private static void Postfix(long __state) => Add("game: villager AI and pathing (Villheim brain included)", __state);
        }

        [HarmonyPatch(typeof(Humanoid), nameof(Humanoid.CustomFixedUpdate))]
        internal static class BodyPatch
        {
            private static void Prefix(Humanoid __instance, out long __state) => __state = IsVillager(__instance) ? Now() : 0L;
            private static void Postfix(long __state) => Add("game: villager body and movement", __state);
        }

        [HarmonyPatch(typeof(VisEquipment), "UpdateVisuals")]
        internal static class VisualsPatch
        {
            private static void Prefix(VisEquipment __instance, out long __state) =>
                __state = On && __instance.GetComponent<Villager>() != null ? Now() : 0L;

            private static void Postfix(long __state) => Add("game: villager gear visuals", __state);
        }

        [HarmonyPatch(typeof(VisEquipment), "AttachItem")]
        internal static class AttachPatch
        {
            private static void Prefix(VisEquipment __instance, out long __state) =>
                __state = On && __instance.GetComponent<Villager>() != null ? Now() : 0L;

            private static void Postfix(long __state, int itemHash)
            {
                if (__state == 0L)
                {
                    return;
                }

                double ms = (Stopwatch.GetTimestamp() - __state) * TicksToMs;
                AddMs("game: villager gear models made", ms);
                GameObject prefab = ObjectDB.instance != null ? ObjectDB.instance.GetItemPrefab(itemHash) : null;
                SpikeLine($"making the {(prefab != null ? prefab.name : itemHash.ToString())} model for a villager", ms);
            }
        }

        [HarmonyPatch(typeof(ZNetScene), "CreateObject")]
        internal static class SpawnPatch
        {
            private static void Prefix(out long __state) => __state = Now();

            private static void Postfix(long __state, GameObject __result)
            {
                if (__state == 0L || __result == null)
                {
                    return;
                }

                double ms = (Stopwatch.GetTimestamp() - __state) * TicksToMs;
                string kind = __result.GetComponent<Villager>() != null ? "villager" :
                    __result.GetComponent<Character>() != null ? "creature" :
                    __result.GetComponent<Piece>() != null ? "piece" : "other object";
                AddMs("game: " + kind + " spawned", ms);
                if (kind != "piece" && kind != "other object")
                {
                    SpikeLine($"spawning {Utils.GetPrefabName(__result)} ({kind})", ms);
                }
            }
        }

        // ---------------------------------------------------------------- 'vh lag'

        public const string Help =
            "lag: frame times and where they go now | lag looks: what each villager draws | " +
            "lag hide villagers|gear|animals [seconds]: frame times with and without them drawn | " +
            "lag shadows [seconds]: with and without villager shadows | lag ab <on/off setting> [seconds]: with the setting as it is and flipped";

        public static string Command(string[] args)
        {
            string what = args.Length > 0 ? args[0].ToLowerInvariant() : "";
            float seconds = args.Length > 2 && float.TryParse(args[2], System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out float s) ? s :
                args.Length > 1 && float.TryParse(args[1], System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture, out float s1) ? s1 : 15f;
            seconds = Mathf.Clamp(seconds, 5f, 120f);
            switch (what)
            {
                case "":
                case "now":
                    return On ? Summary(Time.realtimeSinceStartup - _windowStart, 15) :
                        "Turn on LagLog first (or run a 'vh lag hide' test); then 'vh lag' shows this minute's numbers.";
                case "looks":
                    return Looks();
                case "hide":
                    string target = args.Length > 1 ? args[1].ToLowerInvariant() : "villagers";
                    if (target != "villagers" && target != "gear" && target != "animals")
                    {
                        return "vh lag hide villagers | gear | animals [seconds]";
                    }

                    return Test.Begin("hide " + target, seconds, on => HideRenderers(target, on));
                case "shadows":
                    return Test.Begin("villager shadows off", seconds, on => Shadows(on));
                case "ab":
                    if (args.Length < 2)
                    {
                        return "vh lag ab <setting> [seconds], for any on/off setting (GhostLook, HouseSigns, ...).";
                    }

                    ConfigEntry<bool> entry = FindSwitch(args[1]);
                    if (entry == null)
                    {
                        return $"No on/off setting named {args[1]}.";
                    }

                    bool start = entry.Value;
                    return Test.Begin($"{entry.Definition.Key} {(start ? "off" : "on")}", seconds, on => entry.Value = on ? !start : start);
                case "stop":
                    Test.Abort();
                    return "Lag test stopped; everything put back.";
                default:
                    return Help;
            }
        }

        private static ConfigEntry<bool> FindSwitch(string key)
        {
            ConfigFile config = VillheimPlugin.Instance?.Config;
            if (config == null)
            {
                return null;
            }

            foreach (ConfigDefinition definition in config.Keys)
            {
                if (string.Equals(definition.Key, key, StringComparison.OrdinalIgnoreCase) &&
                    config.TryGetEntry(definition, out ConfigEntry<bool> entry))
                {
                    return entry;
                }
            }

            return null;
        }

        /// <summary>
        /// One A/B test: frames with things as they are (A), then with the change (B), each after a second to settle,
        /// then everything is put back. The result goes to the log and the console. Stand still and look the same way
        /// for both halves, or the scene drawn changes more than the test does.
        /// </summary>
        private static class Test
        {
            private static string _name;
            private static float _half, _startedAt;
            private static int _phase; // 0 idle, 1 A, 2 B
            private static Action<bool> _apply;
            private static readonly List<float> A = new List<float>(), B = new List<float>();

            public static bool Running => _phase != 0;

            public static string Begin(string name, float half, Action<bool> apply)
            {
                if (Running)
                {
                    return $"A lag test ({_name}) is running; wait for it or run 'vh lag stop'.";
                }

                _name = name;
                _half = half;
                _apply = apply;
                A.Clear();
                B.Clear();
                _phase = 1;
                _startedAt = Time.realtimeSinceStartup;
                On = true;
                return $"Lag test '{name}': {half:0} s as things are, then {half:0} s with the change. Stand still and keep " +
                       "the view the same until the result shows.";
            }

            public static void Frame()
            {
                if (!Running)
                {
                    return;
                }

                float elapsed = Time.realtimeSinceStartup - _startedAt;
                if (_phase == 1)
                {
                    if (elapsed >= 1f)
                    {
                        A.Add(Time.unscaledDeltaTime * 1000f);
                    }

                    if (elapsed >= _half + 1f)
                    {
                        _phase = 2;
                        _startedAt = Time.realtimeSinceStartup;
                        Safe(true);
                    }

                    return;
                }

                if (elapsed >= 1f)
                {
                    B.Add(Time.unscaledDeltaTime * 1000f);
                }

                if (elapsed >= _half + 1f)
                {
                    Safe(false);
                    FrameStats a = Stats(A), b = Stats(B);
                    string line = $"Lag test '{_name}': as is {a}. With the change {b}. Difference: average " +
                                  $"{a.Average - b.Average:+0.00;-0.00} ms a frame, slowest 1 % {a.P99 - b.P99:+0.0;-0.0} ms " +
                                  "(positive: the change saves that much).";
                    VillheimPlugin.Log.LogInfo(line);
                    Console.instance?.Print(line);
                    MessageHud.instance?.ShowMessage(MessageHud.MessageType.TopLeft, "Villheim: lag test done, see the console.");
                    _phase = 0;
                }
            }

            public static void Abort()
            {
                if (Running)
                {
                    Safe(false);
                    _phase = 0;
                }
            }

            private static void Safe(bool on)
            {
                try
                {
                    _apply?.Invoke(on);
                }
                catch (Exception ex)
                {
                    VillheimPlugin.Log.LogWarning($"Lag test '{_name}': {ex.Message}");
                }
            }
        }

        private static readonly List<Renderer> Hidden = new List<Renderer>();
        private static readonly Dictionary<Renderer, ShadowCastingMode> ShadowsWere = new Dictionary<Renderer, ShadowCastingMode>();

        private static IEnumerable<Character> Targets(string target) =>
            Character.GetAllCharacters().Where(c => c != null && !c.IsPlayer() &&
                (target == "animals" ? Animals.IsVillageAnimal(c) : c is Villager));

        private static void HideRenderers(string target, bool hide)
        {
            if (!hide)
            {
                foreach (Renderer renderer in Hidden)
                {
                    if (renderer != null)
                    {
                        renderer.enabled = true;
                    }
                }

                Hidden.Clear();
                return;
            }

            foreach (Character character in Targets(target))
            {
                SkinnedMeshRenderer body = character.GetComponent<VisEquipment>()?.m_bodyModel;
                foreach (Renderer renderer in character.GetComponentsInChildren<Renderer>())
                {
                    if (renderer == null || !renderer.enabled || (target == "gear" && renderer == body))
                    {
                        continue;
                    }

                    renderer.enabled = false;
                    Hidden.Add(renderer);
                }
            }
        }

        private static void Shadows(bool off)
        {
            if (!off)
            {
                foreach (var pair in ShadowsWere)
                {
                    if (pair.Key != null)
                    {
                        pair.Key.shadowCastingMode = pair.Value;
                    }
                }

                ShadowsWere.Clear();
                return;
            }

            foreach (Character character in Targets("villagers"))
            {
                foreach (Renderer renderer in character.GetComponentsInChildren<Renderer>())
                {
                    if (renderer != null && renderer.shadowCastingMode != ShadowCastingMode.Off && !ShadowsWere.ContainsKey(renderer))
                    {
                        ShadowsWere[renderer] = renderer.shadowCastingMode;
                        renderer.shadowCastingMode = ShadowCastingMode.Off;
                    }
                }
            }
        }

        /// <summary>'vh lag looks': per villager, what the graphics card draws for him.</summary>
        private static string Looks()
        {
            var lines = new List<string>();
            int renderers = 0, materials = 0, transparent = 0, shadows = 0;
            long vertices = 0;
            var shaders = new Dictionary<string, int>();
            foreach (Character character in Targets("villagers").Concat(Targets("animals")))
            {
                int r = 0, m = 0, t = 0, sh = 0;
                long v = 0;
                foreach (Renderer renderer in character.GetComponentsInChildren<Renderer>())
                {
                    if (renderer == null || !renderer.enabled || renderer is ParticleSystemRenderer)
                    {
                        continue;
                    }

                    r++;
                    if (renderer.shadowCastingMode != ShadowCastingMode.Off)
                    {
                        sh++;
                    }

                    Mesh mesh = renderer is SkinnedMeshRenderer skinned ? skinned.sharedMesh :
                        renderer.GetComponent<MeshFilter>()?.sharedMesh;
                    if (mesh != null)
                    {
                        v += mesh.vertexCount;
                    }

                    foreach (Material material in renderer.sharedMaterials)
                    {
                        if (material == null)
                        {
                            continue;
                        }

                        m++;
                        if (material.renderQueue >= 3000)
                        {
                            t++;
                        }

                        string shader = material.shader != null ? material.shader.name : "?";
                        shaders[shader] = shaders.TryGetValue(shader, out int n) ? n + 1 : 1;
                    }
                }

                renderers += r;
                materials += m;
                transparent += t;
                shadows += sh;
                vertices += v;
                string name = character is Villager villager ? villager.VillagerName : Utils.GetPrefabName(character.gameObject);
                lines.Add($"{name}: {r} parts drawn, {m} materials ({t} see-through), {v:N0} vertices, {sh} cast shadows");
            }

            return $"Drawn for {lines.Count} villagers and village animals: {renderers} parts, {materials} materials " +
                   $"({transparent} see-through), {vertices:N0} vertices, {shadows} casting shadows. Shaders: " +
                   string.Join(", ", shaders.OrderByDescending(p => p.Value).Select(p => $"{p.Key} x{p.Value}")) + "\n" +
                   string.Join("\n", lines);
        }
    }
}
