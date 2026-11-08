using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using Villheim.Logic.Generator;

// dotnet run -- <requests.txt> <out dir> [tries]
// Generates each request with the mod's LabEngine and writes <out>/<n>.blueprint and <out>/summary.txt.
internal static class Program
{
    private static int Main(string[] args)
    {
        if (args.Length == 2 && args[0] == "--js")
        {
            // Debugging aid: the bundle, then a script, in a fresh engine; prints what the script's last line gives.
            var engine = new Jint.Engine();
            engine.Execute(LabEngine.Script());
            Console.WriteLine(engine.Evaluate(File.ReadAllText(args[1])).ToString());
            return 0;
        }

        string list = args.Length > 0 ? args[0] : "requests.txt";
        string output = args.Length > 1 ? args[1] : "out/cs";
        int tries = args.Length > 2 ? int.Parse(args[2]) : 8;
        Directory.CreateDirectory(output);
        LabEngine.Prepare(AppContext.BaseDirectory);
        var summary = new StringBuilder();
        int n = 0, failed = 0;
        foreach (string raw in File.ReadAllLines(list))
        {
            string line = raw.Trim();
            if (line.Length == 0 || line.StartsWith("#"))
            {
                continue;
            }

            string[] f = line.Split('|');
            n++;
            var watch = Stopwatch.StartNew();
            LabResult r = LabEngine.Make(f[0], f[1], f[2].Length > 0 ? f[2] : null, f[3], f[4], int.Parse(f[5]), tries);
            watch.Stop();
            if (r.Error != null)
            {
                failed++;
                summary.AppendLine($"{n}\terror\t{r.Error}");
                Console.WriteLine($"{n}: {r.Error}");
                continue;
            }

            File.WriteAllText(Path.Combine(output, n + ".blueprint"), r.Blueprint, new UTF8Encoding(false));
            summary.AppendLine($"{n}\t{r.Name}\t{r.Plan}\t{r.Roof}\t{r.Walls}\t{r.Pieces}\t{r.Passed}/{r.Checks}\t{string.Join("; ", r.Failed)}");
            Console.WriteLine($"{n}: {r.Name} plan {r.Plan}, roof {r.Roof}, walls {r.Walls}, {r.Pieces} pieces, checks {r.Passed}/{r.Checks}, {watch.ElapsedMilliseconds} ms" +
                              (r.Failed.Count > 0 ? ", failed " + string.Join("; ", r.Failed) : ""));
        }

        File.WriteAllText(Path.Combine(output, "summary.txt"), summary.ToString(), new UTF8Encoding(false));
        return failed;
    }
}
