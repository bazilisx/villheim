using System;
using System.Collections.Generic;
using System.Linq;
using BepInEx.Configuration;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Hair styles by lean, and the F1 controls to review them on the 'vh kids rig' models (T-104, T-202). Config
    /// section "3d - Hair review".
    ///
    /// - Leans (HairLeans): a few broad looks, northern, southern, steppe and celtic, each a list of styles that suit
    ///   it. Each culture has a lean (CultureLeans). A villager of that culture gets the styles in its lean
    ///   HairLeanWeight times as often as any other; every other style can still come up.
    /// - HairBlock: styles nobody gets. HairChildren: when it lists any, the only styles children get (still never a
    ///   blocked one).
    /// - The rig: RigCulture picks the culture (its lean, skin and hair colors go on all four models), and RigHairMan,
    ///   RigHairWoman, RigHairBoy, RigHairGirl and RigBeardMan pick what each model wears, browsed with arrows. Beside
    ///   each style are three buttons: add it to (or take it off) the culture's lean, block (or unblock) it, allow (or
    ///   disallow) it for children. So a style is ruled in by lean first, then for grown-ups, then for children.
    ///
    /// The arrows and buttons are this logic build's own drawers in the config manager; each logic load puts its own in.
    /// </summary>
    internal static class HairReview
    {
        public const string Section = "3d - Hair review";

        public const string DefaultLeans = "northern=; southern=; steppe=; celtic=";

        public const string DefaultCultureLeans =
            "norse=northern, norse-forest=northern, norse-highland=northern, saami=northern, anglo-saxon=northern, " +
            "frankish-norman=northern, slavic=northern, baltic=northern, fen-folk=northern, celtic=celtic, " +
            "celtic-crannog=celtic, middle-eastern=southern, byzantine=southern, lamari=southern, steppe=steppe";

        // ---------------------------------------------------------------- the lists

        private static List<string> Names(string text) =>
            (text ?? "").Split(',').Select(n => n.Trim()).Where(n => n.Length > 0).ToList();

        // Default leans, by words in the name the game shows for each style (Tyler, 2026-11-09: sorting every style by
        // hand was too much; these are a start to correct). A style can be in more than one lean.
        private static readonly Dictionary<string, string[]> LeanWords = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            { "northern", new[] { "braid", "long", "ponytail", "royal", "matronly", "gathered" } },
            { "southern", new[] { "short", "loc", "shav", "bald", "parted", "sideswept", "bun", "crop" } },
            { "steppe", new[] { "ponytail", "topknot", "bun", "mohawk", "shav", "sideswept", "speeddemon", "tail" } },
            { "celtic", new[] { "curl", "long", "wild", "scruff", "pulledback", "twin", "neat" } },
        };

        private static bool _seeded;

        /// <summary>The styles whose shown name has one of the lean's words, among every hair the game has.</summary>
        public static List<string> DefaultLean(string lean)
        {
            if (!LeanWords.TryGetValue(lean ?? "", out string[] words))
            {
                return new List<string>();
            }

            return VillagerLooks.AllHair().Where(style =>
            {
                string shown = new string(VillagerLooks.ShownName(style).ToLowerInvariant().Where(char.IsLetter).ToArray());
                return words.Any(w => shown.Contains(w));
            }).ToList();
        }

        /// <summary>
        /// Once per game, when the hair styles are known: every lean still empty in HairLeans gets its default list,
        /// written to the config so it shows in the config manager to be corrected there or on the rig.
        /// </summary>
        private static void SeedLeans(Dictionary<string, List<string>> map)
        {
            if (_seeded || ObjectDB.instance == null || Localization.instance == null || LogicConfig.HairLeans == null ||
                VillagerLooks.AllHair().Count == 0)
            {
                return;
            }

            _seeded = true;
            var filled = new List<string>();
            foreach (string lean in LeanWords.Keys)
            {
                if (!map.TryGetValue(lean, out List<string> styles) || styles.Count == 0)
                {
                    map[lean] = DefaultLean(lean);
                    filled.Add($"{lean}: {string.Join(", ", map[lean].Select(h => $"{h} ({VillagerLooks.ShownName(h)})"))}");
                }
            }

            if (filled.Count > 0)
            {
                WriteLeans(map);
                VillheimPlugin.Log.LogInfo("Villheim: default hair leans filled in (HairLeans, correct what looks wrong):\n   " +
                                           string.Join("\n   ", filled));
            }
        }

        /// <summary>'vh hair leans': every lean's styles with their shown names, and the defaults by name.</summary>
        public static string LeansCommand()
        {
            Dictionary<string, List<string>> map = Leans();
            var lines = new List<string> { "Villheim hair leans (HairLeans in 3d - Hair review):" };
            foreach (KeyValuePair<string, List<string>> lean in map)
            {
                lines.Add($"   {lean.Key}: {string.Join(", ", lean.Value.Select(h => $"{h} ({VillagerLooks.ShownName(h)})"))}");
            }

            lines.Add("   In no lean: " + string.Join(", ", VillagerLooks.AllHair().Where(h => !map.Values.Any(l => l.Contains(h, StringComparer.OrdinalIgnoreCase)))
                .Select(h => $"{h} ({VillagerLooks.ShownName(h)})")));
            return string.Join("\n", lines);
        }

        private static Dictionary<string, List<string>> Leans()
        {
            Dictionary<string, List<string>> map = ReadLeans();
            if (!_seeded)
            {
                SeedLeans(map);
            }

            return map;
        }

        private static Dictionary<string, List<string>> ReadLeans()
        {
            var map = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
            foreach (string part in (LogicConfig.HairLeans?.Value ?? DefaultLeans).Split(';'))
            {
                int eq = part.IndexOf('=');
                string key = eq > 0 ? part.Substring(0, eq).Trim() : part.Trim();
                if (key.Length > 0)
                {
                    map[key] = eq > 0 ? Names(part.Substring(eq + 1)) : new List<string>();
                }
            }

            return map;
        }

        private static void WriteLeans(Dictionary<string, List<string>> map)
        {
            LogicConfig.HairLeans.Value = string.Join("; ", map.Select(e => $"{e.Key}={string.Join(",", e.Value)}"));
        }

        /// <summary>The lean of a culture (CultureLeans), or null when it has none.</summary>
        public static string LeanOf(string culture)
        {
            foreach (string part in (LogicConfig.CultureLeans?.Value ?? DefaultCultureLeans).Split(','))
            {
                int eq = part.IndexOf('=');
                if (eq > 0 && part.Substring(0, eq).Trim().Equals(culture ?? "", StringComparison.OrdinalIgnoreCase))
                {
                    string lean = part.Substring(eq + 1).Trim();
                    return lean.Length > 0 ? lean : null;
                }
            }

            return null;
        }

        private static bool InLean(string lean, string style) =>
            lean != null && Leans().TryGetValue(lean, out List<string> styles) && styles.Contains(style, StringComparer.OrdinalIgnoreCase);

        public static bool Blocked(string style) => Names(LogicConfig.HairBlock?.Value).Contains(style, StringComparer.OrdinalIgnoreCase);

        private static bool ChildListed(string style) => Names(LogicConfig.HairChildren?.Value).Contains(style, StringComparer.OrdinalIgnoreCase);

        private static void Toggle(ConfigEntry<string> entry, string style)
        {
            List<string> names = Names(entry.Value);
            if (names.RemoveAll(n => n.Equals(style, StringComparison.OrdinalIgnoreCase)) == 0)
            {
                names.Add(style);
            }

            entry.Value = string.Join(",", names);
        }

        private static void ToggleLean(string lean, string style)
        {
            Dictionary<string, List<string>> map = Leans();
            if (!map.TryGetValue(lean, out List<string> styles))
            {
                styles = new List<string>();
                map[lean] = styles;
            }

            if (styles.RemoveAll(n => n.Equals(style, StringComparison.OrdinalIgnoreCase)) == 0)
            {
                styles.Add(style);
            }

            WriteLeans(map);
        }

        /// <summary>A grown villager's styles: all of them less the blocked ones (all of them if that leaves none).</summary>
        public static List<string> ForAdult(List<string> styles)
        {
            List<string> kept = styles.Where(s => !Blocked(s)).ToList();
            return kept.Count > 0 ? kept : styles;
        }

        /// <summary>A child's styles: the grown-up ones that HairChildren lists, when it lists any.</summary>
        public static List<string> ForChild(List<string> adultStyles)
        {
            List<string> listed = Names(LogicConfig.HairChildren?.Value);
            if (listed.Count == 0)
            {
                return adultStyles;
            }

            List<string> kept = adultStyles.Where(s => listed.Contains(s, StringComparer.OrdinalIgnoreCase)).ToList();
            return kept.Count > 0 ? kept : adultStyles;
        }

        /// <summary>The extra weight of each style for a culture (its lean's styles HairLeanWeight times), or null when the lean lists none.</summary>
        public static Func<string, float> LeanWeight(string culture)
        {
            string lean = LeanOf(culture);
            if (lean == null || !Leans().TryGetValue(lean, out List<string> styles) || styles.Count == 0)
            {
                return null;
            }

            var set = new HashSet<string>(styles, StringComparer.OrdinalIgnoreCase);
            float weight = Mathf.Max(1f, LogicConfig.HairLeanWeight?.Value ?? 4f);
            return style => set.Contains(style) ? weight : 1f;
        }

        // ---------------------------------------------------------------- binding

        private static ConfigEntry<T> Bind<T>(ConfigFile config, string key, T value, string description, int order,
            Action<ConfigEntryBase> drawer = null, AcceptableValueBase range = null)
        {
            var attributes = new ConfigurationManagerAttributes { IsAdminOnly = true, Order = order, CustomDrawer = drawer };
            ConfigEntry<T> entry = config.Bind(Section, key, value, new ConfigDescription(description, range, attributes));
            // The entry outlives a logic build: this build's drawer replaces the one an earlier build put in.
            foreach (object tag in entry.Description.Tags ?? new object[0])
            {
                if (tag is ConfigurationManagerAttributes existing)
                {
                    existing.CustomDrawer = drawer;
                }
            }

            return entry;
        }

        public static void Bind(ConfigFile config)
        {
            LogicConfig.RigCulture = Bind(config, "RigCulture", "norse",
                "Culture shown on the 'vh kids rig' models: its skin and hair colors, and the lean the buttons below add to.", 100, DrawCulture);
            LogicConfig.RigHairMan = Bind(config, "RigHairMan", "Hair3", "Hair on the grown man of the rig.", 90, e => DrawStyle(e, false));
            LogicConfig.RigBeardMan = Bind(config, "RigBeardMan", "Beard5", "Beard on the grown man of the rig.", 85, DrawBeard);
            LogicConfig.RigHairWoman = Bind(config, "RigHairWoman", "Hair12", "Hair on the grown woman of the rig.", 80, e => DrawStyle(e, false));
            LogicConfig.RigHairBoy = Bind(config, "RigHairBoy", "Hair3", "Hair on the boy of the rig.", 70, e => DrawStyle(e, true));
            LogicConfig.RigHairGirl = Bind(config, "RigHairGirl", "Hair12", "Hair on the girl of the rig.", 60, e => DrawStyle(e, true));
            LogicConfig.RigGhost = Bind(config, "RigGhost", false,
                "Give the rig models the villagers' ghost look (they blink out for a moment as it goes on or off).", 50);
            LogicConfig.HairLeanWeight = Bind(config, "HairLeanWeight", 4f,
                "How many times as often a villager gets a style in his culture's lean as any other style.", 45, null,
                new AcceptableValueRange<float>(1f, 20f));
            LogicConfig.HairLeans = Bind(config, "HairLeans", DefaultLeans,
                "The leans and their styles: lean=Hair1,Hair5; next lean=... The 'Add to lean' buttons above write here.", 44);
            LogicConfig.CultureLeans = Bind(config, "CultureLeans", DefaultCultureLeans,
                "Each culture's lean: culture=lean, separated by commas. Culture keys as in 'vh cultures'.", 43);
            LogicConfig.HairBlock = Bind(config, "HairBlock", "", "Styles nobody gets (comma separated). The Block buttons write here.", 42);
            LogicConfig.HairChildren = Bind(config, "HairChildren", "",
                "Styles children may have (comma separated). Empty: any style that is not blocked. The 'Children' buttons write here.", 41);
        }

        // ---------------------------------------------------------------- the drawers

        private static GUIStyle _center;

        private static GUIStyle Center => _center ?? (_center = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter });

        private static List<string> CultureKeys() => Cultures.All.Select(c => c.Key).OrderBy(k => k, StringComparer.OrdinalIgnoreCase).ToList();

        private static string Step(List<string> items, string current, int by)
        {
            if (items.Count == 0)
            {
                return current;
            }

            int at = items.FindIndex(i => i.Equals(current ?? "", StringComparison.OrdinalIgnoreCase));
            return items[((at < 0 ? (by > 0 ? -1 : 0) : at) + by + items.Count) % items.Count];
        }

        private static void Arrows(ConfigEntry<string> entry, List<string> items, string label)
        {
            if (GUILayout.Button("<", GUILayout.Width(28)))
            {
                entry.Value = Step(items, entry.Value, -1);
            }

            GUILayout.Label(label, Center, GUILayout.ExpandWidth(true));
            if (GUILayout.Button(">", GUILayout.Width(28)))
            {
                entry.Value = Step(items, entry.Value, 1);
            }
        }

        private static string RigCultureKey => LogicConfig.RigCulture?.Value ?? "norse";

        /// <summary>Any trouble in a drawer is logged once and the row left blank, so the window and the rig carry on.</summary>
        private static void Safely(string what, Action draw)
        {
            try
            {
                draw();
            }
            catch (Exception ex) when (!(ex is ExitGUIException))
            {
                if (_logged.Add(what))
                {
                    VillheimPlugin.Log.LogWarning($"Hair review: the {what} control failed: {ex}");
                }
            }
        }

        private static readonly HashSet<string> _logged = new HashSet<string>();

        private static void DrawCulture(ConfigEntryBase entryBase) => Safely("culture", () =>
        {
            if (!(entryBase is ConfigEntry<string> entry))
            {
                return;
            }

            string key = entry.Value;
            string lean = LeanOf(key) ?? "no lean";
            string name = Cultures.Known(key) ? $"{Cultures.Get(key).Name} ({key}), {lean}" : key;
            GUILayout.BeginHorizontal();
            Arrows(entry, CultureKeys(), name);
            GUILayout.EndHorizontal();
        });

        private static void DrawStyle(ConfigEntryBase entryBase, bool child) => Safely(entryBase.Definition.Key, () =>
        {
            if (!(entryBase is ConfigEntry<string> entry))
            {
                return;
            }

            string style = entry.Value;
            List<string> all = VillagerLooks.AllHair();
            int at = all.FindIndex(n => n.Equals(style ?? "", StringComparison.OrdinalIgnoreCase));
            string lean = LeanOf(RigCultureKey);
            bool inLean = InLean(lean, style);
            bool blocked = Blocked(style);
            bool forChildren = ChildListed(style);

            GUILayout.BeginVertical();
            GUILayout.BeginHorizontal();
            Arrows(entry, all, $"{VillagerLooks.ShownName(style)}  ({style}, {at + 1} of {all.Count})");
            GUILayout.EndHorizontal();

            GUILayout.BeginHorizontal();
            if (lean != null && GUILayout.Button(inLean ? $"Take off {lean}" : $"Add to lean: {lean}", GUILayout.ExpandWidth(true)))
            {
                ToggleLean(lean, style);
            }

            if (GUILayout.Button(blocked ? "Unblock" : "Block", GUILayout.Width(80)))
            {
                Toggle(LogicConfig.HairBlock, style);
            }

            if (GUILayout.Button(forChildren ? "Not for children" : "Allow for children", GUILayout.Width(130)))
            {
                Toggle(LogicConfig.HairChildren, style);
            }

            GUILayout.EndHorizontal();

            bool childList = Names(LogicConfig.HairChildren?.Value).Count > 0;
            string grown = blocked ? "blocked for everyone" : inLean ? $"in the {lean} lean (more likely)" : "possible";
            string young = blocked ? "no" : !childList || forChildren ? "yes" : "no";
            GUILayout.Label($"{(child ? "This child's style" : "This style")}: {grown}; children: {young}.");
            GUILayout.EndVertical();
        });

        private static void DrawBeard(ConfigEntryBase entryBase) => Safely("beard", () =>
        {
            if (!(entryBase is ConfigEntry<string> entry))
            {
                return;
            }

            List<string> all = VillagerLooks.AllBeards();
            string beard = entry.Value;
            GUILayout.BeginHorizontal();
            Arrows(entry, all, beard == "none" || string.IsNullOrEmpty(beard) ? "no beard" : $"{VillagerLooks.ShownName(beard)}  ({beard})");
            GUILayout.EndHorizontal();
        });

        /// <summary>The rig culture's skin and hair colors.</summary>
        public static void RigColors(out Vector3 skin, out Vector3 hair)
        {
            skin = new Vector3(0.9f, 0.8f, 0.7f);
            hair = new Vector3(0.5f, 0.35f, 0.2f);
            string key = RigCultureKey;
            if (Cultures.Known(key))
            {
                VillagerLooks.CultureColors(Cultures.Get(key), out skin, out hair);
            }
        }
    }
}
