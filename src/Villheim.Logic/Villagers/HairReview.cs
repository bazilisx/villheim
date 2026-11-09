using System;
using System.Collections.Generic;
using System.Linq;
using BepInEx.Configuration;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Hair by culture, and the F1 controls to review it on the 'vh kids rig' models (T-104). Config section
    /// "3d - Hair review".
    ///
    /// - Lists for everyone of a culture: HairAllowMen, HairBlockMen, HairAllowWomen, HairBlockWomen, in the form
    ///   culture=Hair1,Hair5; other=Hair3 (the key * means every culture). A culture with an allow list only gives
    ///   styles on it; a blocked style is never given. Children must also be on HairAllowBoys or HairAllowGirls for
    ///   their culture when it has a list there, as well as pass the grown-up lists for their sex.
    /// - The rig: RigCulture picks a culture (its skin and hair colors go on all four models), and RigHairMan,
    ///   RigHairWoman, RigHairBoy, RigHairGirl and RigBeardMan pick what each model wears. Each shows the style's name
    ///   between arrows; the buttons beside it put the shown style on the culture's lists or take it off, and the
    ///   label says whether villagers of that culture would get it. RigGhost gives the models the ghost look.
    ///
    /// The arrows and buttons are drawn by this logic build in the config manager (its CustomDrawer); each logic load
    /// puts its own drawers in.
    /// </summary>
    internal static class HairReview
    {
        public const string Section = "3d - Hair review";
        private const string AllCultures = "*";

        // ---------------------------------------------------------------- the lists

        private static Dictionary<string, List<string>> Parse(string text)
        {
            var map = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
            foreach (string part in (text ?? "").Split(';'))
            {
                int eq = part.IndexOf('=');
                if (eq <= 0)
                {
                    continue;
                }

                string key = part.Substring(0, eq).Trim();
                List<string> names = part.Substring(eq + 1).Split(',').Select(n => n.Trim()).Where(n => n.Length > 0).ToList();
                if (key.Length > 0)
                {
                    map[key] = names;
                }
            }

            return map;
        }

        private static string Write(Dictionary<string, List<string>> map) =>
            string.Join("; ", map.Where(e => e.Value.Count > 0).OrderBy(e => e.Key == AllCultures ? "" : e.Key)
                .Select(e => $"{e.Key}={string.Join(",", e.Value)}"));

        /// <summary>The styles on a list for this culture (with those listed for every culture), or null when it has none.</summary>
        private static HashSet<string> For(ConfigEntry<string> entry, string culture)
        {
            Dictionary<string, List<string>> map = Parse(entry?.Value);
            var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            bool any = false;
            foreach (string key in new[] { AllCultures, culture ?? "" })
            {
                if (map.TryGetValue(key, out List<string> names))
                {
                    any = true;
                    set.UnionWith(names);
                }
            }

            return any ? set : null;
        }

        private static void Edit(ConfigEntry<string> entry, string culture, string style, bool add)
        {
            if (entry == null || string.IsNullOrEmpty(style))
            {
                return;
            }

            Dictionary<string, List<string>> map = Parse(entry.Value);
            if (!map.TryGetValue(culture, out List<string> names))
            {
                names = new List<string>();
                map[culture] = names;
            }

            names.RemoveAll(n => n.Equals(style, StringComparison.OrdinalIgnoreCase));
            if (add)
            {
                names.Add(style);
            }

            entry.Value = Write(map);
        }

        private static ConfigEntry<string> AllowList(bool female) => female ? LogicConfig.HairAllowWomen : LogicConfig.HairAllowMen;
        private static ConfigEntry<string> BlockList(bool female) => female ? LogicConfig.HairBlockWomen : LogicConfig.HairBlockMen;
        private static ConfigEntry<string> ChildList(bool female) => female ? LogicConfig.HairAllowGirls : LogicConfig.HairAllowBoys;

        /// <summary>Whether a grown villager of this culture and sex may have the style.</summary>
        public static bool AdultMay(string culture, bool female, string style)
        {
            HashSet<string> allow = For(AllowList(female), culture);
            HashSet<string> block = For(BlockList(female), culture);
            return (allow == null || allow.Contains(style)) && (block == null || !block.Contains(style));
        }

        /// <summary>A grown villager's styles: those the lists allow, or all of them when the lists leave none.</summary>
        public static List<string> ForAdult(string culture, bool female, List<string> styles)
        {
            List<string> kept = styles.Where(s => AdultMay(culture, female, s)).ToList();
            return kept.Count > 0 ? kept : styles;
        }

        /// <summary>A child's styles: the grown-up ones also on the culture's list for children. Empty when none pass.</summary>
        public static List<string> ForChild(string culture, bool female, List<string> adultStyles)
        {
            HashSet<string> young = For(ChildList(female), culture);
            return young == null ? adultStyles : adultStyles.Where(young.Contains).ToList();
        }

        // ---------------------------------------------------------------- binding

        private static ConfigurationManagerAttributes Attributes(int order, Action<ConfigEntryBase> drawer = null) =>
            new ConfigurationManagerAttributes { IsAdminOnly = true, Order = order, CustomDrawer = drawer };

        private static ConfigEntry<T> Bind<T>(ConfigFile config, string key, T value, string description, int order, Action<ConfigEntryBase> drawer = null)
        {
            ConfigEntry<T> entry = config.Bind(Section, key, value, new ConfigDescription(description, null, Attributes(order, drawer)));
            // The entry outlives a logic build: this build's drawer replaces the one an earlier build put in.
            foreach (object tag in entry.Description.Tags ?? new object[0])
            {
                if (tag is ConfigurationManagerAttributes attributes)
                {
                    attributes.CustomDrawer = drawer;
                }
            }

            return entry;
        }

        public static void Bind(ConfigFile config)
        {
            LogicConfig.RigCulture = Bind(config, "RigCulture", "norse",
                "Culture shown on the 'vh kids rig' models: their skin and hair colors, and the lists the buttons below edit. " +
                "* edits the lists for every culture.", 100, DrawCulture);
            LogicConfig.RigHairMan = Bind(config, "RigHairMan", "Hair3", "Hair on the grown man of the rig.", 90, e => DrawStyle(e, false, false));
            LogicConfig.RigBeardMan = Bind(config, "RigBeardMan", "Beard5", "Beard on the grown man of the rig.", 85, DrawBeard);
            LogicConfig.RigHairWoman = Bind(config, "RigHairWoman", "Hair12", "Hair on the grown woman of the rig.", 80, e => DrawStyle(e, true, false));
            LogicConfig.RigHairBoy = Bind(config, "RigHairBoy", "Hair3", "Hair on the boy of the rig.", 70, e => DrawStyle(e, false, true));
            LogicConfig.RigHairGirl = Bind(config, "RigHairGirl", "Hair12", "Hair on the girl of the rig.", 60, e => DrawStyle(e, true, true));
            LogicConfig.RigGhost = Bind(config, "RigGhost", false,
                "Give the rig models the villagers' ghost look (they blink out for a moment as it goes on or off).", 50);
            LogicConfig.HairAllowMen = Bind(config, "HairAllowMen", "",
                "Styles men of a culture may have: culture=Hair1,Hair5; other=Hair3 (* for every culture). A culture with " +
                "no list here may have any style. The Allow buttons above write here.", 40);
            LogicConfig.HairBlockMen = Bind(config, "HairBlockMen", "", "Styles men of a culture never have (same form).", 39);
            LogicConfig.HairAllowWomen = Bind(config, "HairAllowWomen", "", "Styles women of a culture may have (same form).", 38);
            LogicConfig.HairBlockWomen = Bind(config, "HairBlockWomen", "", "Styles women of a culture never have (same form).", 37);
            LogicConfig.HairAllowBoys = Bind(config, "HairAllowBoys", "",
                "Styles boys of a culture may have (same form). A boy's style must also pass HairAllowMen and HairBlockMen. " +
                "A culture with no list here gives boys any style its men may have.", 36);
            LogicConfig.HairAllowGirls = Bind(config, "HairAllowGirls", "",
                "Styles girls of a culture may have; they must also pass the lists for women.", 35);
        }

        // ---------------------------------------------------------------- the drawers

        private static GUIStyle _center;

        private static GUIStyle Center => _center ?? (_center = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter });

        /// <summary>The culture keys, * first.</summary>
        private static List<string> CultureKeys() =>
            new[] { AllCultures }.Concat(Cultures.All.Select(c => c.Key).OrderBy(k => k, StringComparer.OrdinalIgnoreCase)).ToList();

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

        private static string RigCultureKey => string.IsNullOrEmpty(LogicConfig.RigCulture?.Value) ? AllCultures : LogicConfig.RigCulture.Value;

        private static void DrawCulture(ConfigEntryBase entryBase)
        {
            if (!(entryBase is ConfigEntry<string> entry))
            {
                return;
            }

            string key = entry.Value;
            string name = key == AllCultures ? "every culture" : Cultures.Known(key) ? $"{Cultures.Get(key).Name} ({key})" : key;
            GUILayout.BeginHorizontal();
            Arrows(entry, CultureKeys(), name);
            GUILayout.EndHorizontal();
        }

        private static void DrawStyle(ConfigEntryBase entryBase, bool female, bool child)
        {
            if (!(entryBase is ConfigEntry<string> entry))
            {
                return;
            }

            string culture = RigCultureKey;
            string style = entry.Value;
            List<string> all = VillagerLooks.AllHair();
            int at = all.FindIndex(n => n.Equals(style ?? "", StringComparison.OrdinalIgnoreCase));
            GUILayout.BeginVertical();
            GUILayout.BeginHorizontal();
            Arrows(entry, all, $"{VillagerLooks.ShownName(style)}  ({style}, {at + 1} of {all.Count})");
            GUILayout.EndHorizontal();

            GUILayout.BeginHorizontal();
            string who = child ? (female ? "girls" : "boys") : (female ? "women" : "men");
            string where = culture == AllCultures ? "every culture" : culture;
            if (child)
            {
                HashSet<string> young = For(ChildList(female), culture);
                bool listed = young != null && young.Contains(style);
                bool adultOk = culture == AllCultures || AdultMay(culture, female, style);
                GUILayout.Label(!adultOk ? $"{where} {who}: not given (not allowed for grown-ups)"
                    : young == null ? $"{where} {who}: given (no list for {who} yet)"
                    : listed ? $"{where} {who}: given" : $"{where} {who}: not given", GUILayout.ExpandWidth(true));
                if (GUILayout.Button("Allow", GUILayout.Width(60)))
                {
                    Edit(ChildList(female), culture, style, true);
                }

                if (GUILayout.Button("Remove", GUILayout.Width(66)))
                {
                    Edit(ChildList(female), culture, style, false);
                }
            }
            else
            {
                HashSet<string> allow = For(AllowList(female), culture);
                HashSet<string> block = For(BlockList(female), culture);
                string state = block != null && block.Contains(style) ? "blocked"
                    : allow == null ? "given (no allow list yet)"
                    : allow.Contains(style) ? "allowed" : "not given (not on the allow list)";
                GUILayout.Label($"{where} {who}: {state}", GUILayout.ExpandWidth(true));
                if (GUILayout.Button("Allow", GUILayout.Width(60)))
                {
                    Edit(BlockList(female), culture, style, false);
                    Edit(AllowList(female), culture, style, true);
                }

                if (GUILayout.Button("Block", GUILayout.Width(60)))
                {
                    Edit(AllowList(female), culture, style, false);
                    Edit(BlockList(female), culture, style, true);
                }

                if (GUILayout.Button("Clear", GUILayout.Width(60)))
                {
                    Edit(AllowList(female), culture, style, false);
                    Edit(BlockList(female), culture, style, false);
                }
            }

            GUILayout.EndHorizontal();
            GUILayout.EndVertical();
        }

        private static void DrawBeard(ConfigEntryBase entryBase)
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
        }

        /// <summary>The rig culture's skin and hair colors.</summary>
        public static bool RigColors(out Vector3 skin, out Vector3 hair)
        {
            skin = new Vector3(0.9f, 0.8f, 0.7f);
            hair = new Vector3(0.5f, 0.35f, 0.2f);
            string key = RigCultureKey;
            if (key == AllCultures || !Cultures.Known(key))
            {
                return false;
            }

            VillagerLooks.CultureColors(Cultures.Get(key), out skin, out hair);
            return true;
        }
    }
}
