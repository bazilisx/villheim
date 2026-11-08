using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Text;
using Jint;

namespace Villheim.Logic.Generator
{
    /// <summary>One generated design, as the lab returns it.</summary>
    public sealed class LabResult
    {
        public string Error;
        public string Name, Description, Blueprint;
        public string Type, Biome, Culture, Plan, Roof, Walls, Stage, Decor;
        public int Pieces, Seed, Passed, Checks;
        public double Score;
        public readonly List<string> Failed = new List<string>();
        public readonly List<string> Notes = new List<string>();
    }

    /// <summary>
    /// Runs the blueprint lab's own generator (tools/blueprint-lab, bundled into Generator/lab.js by
    /// lib/build_engine.js) in Jint, so the game makes the same design as the lab for the same request and seed.
    /// Free of Unity and BepInEx, so tools/gen-test runs this same file outside the game.
    ///
    /// Jint and its helpers ship next to the mod's DLLs. Methods that touch Jint types are kept apart from the public
    /// ones, so the assembly resolver below is in place before the runtime looks for Jint.
    /// </summary>
    public static class LabEngine
    {
        public const string ResourceName = "Villheim.Logic.Generator.lab.js";
        private static readonly object Gate = new object();
        private static string _searchDirectory;

        /// <summary>Where to look for Jint.dll and its helpers when the runtime cannot find them by itself.</summary>
        public static void Prepare(string searchDirectory)
        {
            _searchDirectory = searchDirectory;
            AppDomain domain = AppDomain.CurrentDomain;
            // One resolver for the whole game, whatever number of logic reloads.
            if (domain.GetData("villheim.labengine.resolver") == null)
            {
                domain.SetData("villheim.labengine.resolver", "on");
                domain.AssemblyResolve += Resolve;
            }
        }

        private static Assembly Resolve(object sender, ResolveEventArgs args)
        {
            string name = new AssemblyName(args.Name).Name;
            if (name != "Jint" && name != "Acornima" && name != "System.Runtime.CompilerServices.Unsafe")
            {
                return null;
            }

            foreach (Assembly loaded in AppDomain.CurrentDomain.GetAssemblies())
            {
                if (loaded.GetName().Name == name)
                {
                    return loaded;
                }
            }

            string directory = _searchDirectory ?? Path.GetDirectoryName(typeof(LabEngine).Assembly.Location) ?? "";
            string file = Path.Combine(directory, name + ".dll");
            return File.Exists(file) ? Assembly.LoadFrom(file) : null;
        }

        /// <summary>The bundled lab script, from this assembly's resources.</summary>
        public static string Script()
        {
            using (Stream stream = typeof(LabEngine).Assembly.GetManifestResourceStream(ResourceName))
            {
                if (stream == null)
                {
                    throw new InvalidOperationException($"{ResourceName} is missing from the logic DLL.");
                }

                using (var reader = new StreamReader(stream, Encoding.UTF8))
                {
                    return reader.ReadToEnd();
                }
            }
        }

        /// <summary>
        /// Generates one request: the best of 'tries' seeds from 'seed' on (checks first, then the keep score).
        /// biome is a code (md, bf, sw, mt, pl, ml, al, dn) or a name; stage is "s1d3" or "s1"; culture may be null.
        /// </summary>
        public static LabResult Make(string type, string biome, string culture, string stage, string words, int seed, int tries)
        {
            lock (Gate)
            {
                return LabJint.Make(type, biome, culture, stage, words, seed, tries);
            }
        }

        /// <summary>The words read from a request, as JSON (for showing what was understood).</summary>
        public static string Read(string words)
        {
            lock (Gate)
            {
                return LabJint.CallString("vhRead", words ?? "");
            }
        }

        /// <summary>Types, cultures and biome codes the lab knows, as JSON.</summary>
        public static string Lists()
        {
            lock (Gate)
            {
                return LabJint.CallString("vhLists");
            }
        }
    }

    /// <summary>Everything that touches Jint types. Called only after LabEngine.Prepare.</summary>
    internal static class LabJint
    {
        private static Jint.Engine _engine;

        private static Jint.Engine Engine()
        {
            if (_engine != null)
            {
                return _engine;
            }

            var engine = new Jint.Engine(options => options.TimeoutInterval(TimeSpan.FromMinutes(2)));
            engine.Execute(LabEngine.Script());
            _engine = engine;
            return engine;
        }

        internal static string CallString(string function, params object[] arguments) =>
            Engine().Invoke(function, arguments).ToString();

        internal static LabResult Make(string type, string biome, string culture, string stage, string words, int seed, int tries)
        {
            Jint.Native.JsValue value = Engine().Invoke("vhMake", type, biome, culture ?? "", stage, words ?? "", seed, tries);
            var o = value.AsObject();
            var result = new LabResult { Error = Text(o.Get("error")) };
            if (result.Error != null)
            {
                return result;
            }

            result.Name = Text(o.Get("name"));
            result.Description = Text(o.Get("description"));
            result.Blueprint = Text(o.Get("blueprint"));
            result.Type = Text(o.Get("type"));
            result.Biome = Text(o.Get("biome"));
            result.Culture = Text(o.Get("culture"));
            result.Plan = Text(o.Get("plan"));
            result.Roof = Text(o.Get("roof"));
            result.Walls = Text(o.Get("walls"));
            result.Stage = Text(o.Get("stage"));
            result.Decor = Text(o.Get("decor"));
            result.Pieces = (int)o.Get("pieces").AsNumber();
            result.Seed = (int)o.Get("seed").AsNumber();
            result.Passed = (int)o.Get("passed").AsNumber();
            result.Checks = (int)o.Get("checks").AsNumber();
            result.Score = o.Get("score").AsNumber();
            AddAll(o.Get("failed"), result.Failed);
            AddAll(o.Get("notes"), result.Notes);
            return result;
        }

        private static string Text(Jint.Native.JsValue value) =>
            value == null || value.IsUndefined() || value.IsNull() ? null : value.ToString();

        private static void AddAll(Jint.Native.JsValue value, List<string> into)
        {
            if (value == null || !value.IsArray())
            {
                return;
            }

            var array = value.AsArray();
            for (uint i = 0; i < array.Length; i++)
            {
                into.Add(array.Get(i.ToString()).ToString());
            }
        }
    }
}
