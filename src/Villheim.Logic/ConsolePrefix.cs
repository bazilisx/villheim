using HarmonyLib;

namespace Villheim.Logic
{
    /// <summary>
    /// Console shorthand: "vh_settle" works the same as "vh settle" and "villheim_settle", for every Villheim command,
    /// including ones the core doesn't register by name. Only text starting with vh_ (or an unregistered villheim_
    /// command) is touched.
    /// </summary>
    [HarmonyPatch(typeof(Terminal), nameof(Terminal.TryRunCommand))]
    internal static class ConsolePrefix
    {
        private static void Prefix(ref string text)
        {
            if (string.IsNullOrEmpty(text))
            {
                return;
            }

            string trimmed = text.TrimStart();
            string first = trimmed.Split(' ')[0];
            if (first.StartsWith("vh_") && first.Length > 3)
            {
                text = "vh " + trimmed.Substring(3);
            }
            else if (first.StartsWith("villheim_") && Terminal.commands != null && !Terminal.commands.ContainsKey(first))
            {
                text = "vh " + trimmed.Substring("villheim_".Length);
            }
        }
    }
}
