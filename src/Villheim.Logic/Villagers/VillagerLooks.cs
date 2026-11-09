using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using Villheim.Logic.Village;
using Villheim.Prefabs;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Dresses a villager with vanilla hair, beards, armor and tools. The look comes from a fixed seed, so each
    /// villager keeps the same face and style; the gear tier comes from the size of the village, so armor and tools
    /// improve as the village grows. Black Forest villages start one tier higher.
    /// Skin, hair colour, the styles given more often, beards and some extra clothes follow the villager's culture
    /// (Village/Cultures.cs), with a spread inside each village.
    /// Villagers have no drop table and their ragdoll does not drop items, so killing them yields nothing.
    /// </summary>
    internal static class VillagerLooks
    {
        /// <summary>The tools every villager carries. They hold the one for the job at hand.</summary>
        public enum Tool
        {
            Axe,
            Pickaxe,
            Hammer,
            Hoe,
        }

        private readonly struct WeightedItem
        {
            public readonly string Item;
            public readonly float Weight;

            public WeightedItem(string item, float weight)
            {
                Item = item;
                Weight = weight;
            }
        }

        private static readonly Color SkinLight = new Color32(0xFF, 0xFF, 0xFF, 0xFF);
        private static readonly Color SkinDark = new Color32(0x4C, 0x4C, 0x4C, 0xFF);
        private static readonly Color HairLight = new Color32(0xFF, 0xED, 0xB4, 0xFF);
        private static readonly Color HairDark = new Color32(0xFF, 0x7C, 0x47, 0xFF);

        private const int MaxTier = 4;

        // Index = gear tier (0 rags .. 4 bronze).
        private static readonly WeightedItem[][] Chests =
        {
            new[] { new WeightedItem("ArmorRagsChest", 1f) },
            new[] { new WeightedItem("ArmorRagsChest", 1f), new WeightedItem("ArmorLeatherChest", 2f) },
            new[] { new WeightedItem("ArmorLeatherChest", 3f), new WeightedItem("ArmorTrollLeatherChest", 1f) },
            new[] { new WeightedItem("ArmorLeatherChest", 1f), new WeightedItem("ArmorTrollLeatherChest", 3f) },
            new[] { new WeightedItem("ArmorTrollLeatherChest", 2f), new WeightedItem("ArmorBronzeChest", 2f) },
        };

        private static readonly WeightedItem[][] Legs =
        {
            new[] { new WeightedItem("ArmorRagsLegs", 1f) },
            new[] { new WeightedItem("ArmorRagsLegs", 1f), new WeightedItem("ArmorLeatherLegs", 2f) },
            new[] { new WeightedItem("ArmorLeatherLegs", 3f), new WeightedItem("ArmorTrollLeatherLegs", 1f) },
            new[] { new WeightedItem("ArmorLeatherLegs", 1f), new WeightedItem("ArmorTrollLeatherLegs", 3f) },
            new[] { new WeightedItem("ArmorTrollLeatherLegs", 2f), new WeightedItem("ArmorBronzeLegs", 2f) },
        };

        private static readonly WeightedItem[][] Helmets =
        {
            new[] { new WeightedItem("", 1f) },
            new[] { new WeightedItem("", 4f), new WeightedItem("HelmetLeather", 1f) },
            new[] { new WeightedItem("", 2f), new WeightedItem("HelmetLeather", 2f) },
            new[] { new WeightedItem("", 2f), new WeightedItem("HelmetLeather", 1f), new WeightedItem("HelmetTrollLeather", 2f) },
            new[] { new WeightedItem("", 1f), new WeightedItem("HelmetTrollLeather", 2f), new WeightedItem("HelmetBronze", 2f) },
        };

        private static readonly WeightedItem[][] Capes =
        {
            new[] { new WeightedItem("", 1f) },
            new[] { new WeightedItem("", 3f), new WeightedItem("CapeDeerHide", 1f) },
            new[] { new WeightedItem("", 1f), new WeightedItem("CapeDeerHide", 2f) },
            new[] { new WeightedItem("", 1f), new WeightedItem("CapeDeerHide", 1f), new WeightedItem("CapeTrollHide", 2f) },
            new[] { new WeightedItem("CapeDeerHide", 1f), new WeightedItem("CapeTrollHide", 2f) },
        };

        // Villagers get tools that can cut and break what their biome offers (birch and oak need more than a stone
        // axe), even before players have them.
        // Bronze from the start: birch and oak (fine wood) need a bronze axe, and a village should be able to cut every
        // tree around it (Tyler, 2026-11-06), even in the Meadows.
        private static readonly string[] Axes = { "AxeBronze", "AxeBronze", "AxeBronze", "AxeBronze", "AxeBronze" };
        private static readonly string[] Pickaxes = { "PickaxeAntler", "PickaxeAntler", "PickaxeBronze", "PickaxeBronze", "PickaxeBronze" };

        private static readonly WeightedItem[] OtherTools =
        {
            new WeightedItem("Hammer", 2f),
            new WeightedItem("Hoe", 2f),
            new WeightedItem("Club", 1f),
            new WeightedItem("Torch", 1f),
            new WeightedItem("FishingRod", 0.5f),
            new WeightedItem("", 1f),
        };

        /// <summary>Villager trades by seed: one in four builds (hammer), one in four mines (pickaxe), the rest cut wood (axe).</summary>
        public static bool IsBuilder(int seed) => (seed & 0x7fffffff) % 4 == 0;

        public static bool IsMiner(int seed) => (seed & 0x7fffffff) % 4 == 1;

        public static bool IsWoodcutter(int seed) => !IsBuilder(seed) && !IsMiner(seed);

        public static int GearTier(int villageTier, Heightmap.Biome biome)
        {
            if (!VillheimConfig.GearImprovesWithVillage.Value)
            {
                villageTier = 0;
            }

            int tier = villageTier + (biome == Heightmap.Biome.BlackForest ? 1 : 0);
            return Mathf.Clamp(tier, 0, MaxTier);
        }

        public static void Apply(Villager villager, int seed, int gearTier)
        {
            VisEquipment vis = villager.m_visEquipment ? villager.m_visEquipment : villager.GetComponent<VisEquipment>();
            if (vis == null || ObjectDB.instance == null)
            {
                return;
            }

            // The face and style use their own random stream, so a gear change never changes the person. The ranges
            // come from the villager's culture (Cultures/cultures.txt): a Persian village runs darker in skin and hair
            // than a Gaelic one, and now and then (LooksOutlierChance) anyone may have any skin tone the game gives.
            Cultures.Culture culture = Cultures.Get(Cultures.OfVillager(villager));
            var looks = new System.Random(seed);
            bool female = looks.Next(2) == 1;
            vis.SetModel(female ? 1 : 0);

            float outlier = LogicConfig.LooksOutlierChance != null ? LogicConfig.LooksOutlierChance.Value : 0.1f;
            Vector2 skinRange = looks.NextDouble() < outlier ? new Vector2(0.25f, 1f) : culture.Skin;
            float skinAt = Mathf.Clamp(Mathf.Lerp(skinRange.x, skinRange.y, (float)looks.NextDouble()), 0.25f, 1f);
            Color skin = Color.Lerp(SkinLight, SkinDark, skinAt);
            vis.SetSkinColor(new Vector3(skin.r, skin.g, skin.b));

            float red = Mathf.Lerp(culture.HairRed.x, culture.HairRed.y, (float)looks.NextDouble());
            float shade = Mathf.Clamp(Mathf.Lerp(culture.HairShade.x, culture.HairShade.y, (float)looks.NextDouble()), 0.05f, 1f);
            Color hair = Color.Lerp(HairLight, HairDark, red) * shade;
            vis.SetHairColor(new Vector3(hair.r, hair.g, hair.b));

            // The culture's allowed and blocked styles (HairReview) apply to everyone of that culture.
            List<string> styles = HairReview.ForAdult(culture.Key, female, HairStyles(female));
            string hairItem = styles.Count > 0 ? PickStyle(looks, styles, culture.HairPrefer) : FirstExisting($"Hair{looks.Next(1, 21)}", "Hair1");
            if (Childhood.IsChild(villager))
            {
                // A child's style must also be on his culture's list for children (HairReview), drawn from his own
                // random stream, so the grown villager's looks stay the same.
                List<string> young = HairReview.ForChild(culture.Key, female, styles);
                if (young.Count > 0)
                {
                    hairItem = PickStyle(new System.Random(seed ^ 0x6b1d5), young, culture.HairPrefer);
                }
            }

            villager.m_hairItem = hairItem;
            vis.SetHairItem(Hash(hairItem));

            List<string> beards = BeardStyles();
            string beard = female || looks.NextDouble() >= culture.Beard ? ""
                : beards.Count > 0 ? PickStyle(looks, beards, culture.BeardPrefer) : FirstExisting($"Beard{looks.Next(1, 11)}", "Beard1");
            if (Childhood.IsChild(villager) && (LogicConfig.ChildNoBeard == null || LogicConfig.ChildNoBeard.Value))
            {
                // No beard on a child (T-28); the random draw above still runs, so the grown man's beard is the same.
                beard = "";
            }

            villager.m_beardItem = beard;
            vis.SetBeardItem(Hash(beard));

            villager.UnequipAllItems();
            villager.GetInventory()?.RemoveAll();

            int tier = Mathf.Clamp(gearTier, 0, MaxTier);
            var gear = new System.Random(unchecked(seed * 17 + tier * 7919));
            Equip(villager, Pick(gear, WithCulture(Chests[tier], culture, "chest", tier, female)));
            Equip(villager, Pick(gear, WithCulture(Legs[tier], culture, "legs", tier, female)));
            Equip(villager, Pick(gear, WithCulture(Helmets[tier], culture, "helmet", tier, female)));
            Equip(villager, Pick(gear, WithCulture(Capes[tier], culture, "cape", tier, female)));

            // Everyone carries all three tools and starts out holding the one of their trade.
            string axe = Axes[tier];
            string pickaxe = Pickaxes[tier];
            Carry(villager, axe);
            Carry(villager, pickaxe);
            Carry(villager, "Hammer");
            Hold(villager, IsBuilder(seed) ? Tool.Hammer : IsMiner(seed) ? Tool.Pickaxe : Tool.Axe);
        }

        /// <summary>Puts the tool in the villager's hand, if it isn't there already. Returns false if they don't carry one.</summary>
        public static bool Hold(Humanoid villager, Tool tool)
        {
            ItemDrop.ItemData current = villager.GetRightItem();
            if (current != null && IsTool(current, tool))
            {
                return true;
            }

            Inventory inventory = villager.GetInventory();
            if (inventory == null)
            {
                return false;
            }

            foreach (ItemDrop.ItemData item in inventory.GetAllItems())
            {
                if (IsTool(item, tool))
                {
                    return villager.EquipItem(item, false) && IsHolding(villager, tool);
                }
            }

            // The tool went missing (it has happened with the axe). Villagers always carry their three tools, so a
            // new one is handed over rather than leave him punching at trees and buildings.
            string name = ToolPrefab(villager, tool);
            GameObject prefab = name != null && ObjectDB.instance ? ObjectDB.instance.GetItemPrefab(name) : null;
            ItemDrop.ItemData given = prefab != null ? villager.PickupPrefab(prefab, 0, false) : null;
            if (given == null)
            {
                VillheimPlugin.Debug($"{villager.GetHoverName()} has no {tool} and none could be given " +
                                     $"(inventory {inventory.GetAllItems().Count} items, {inventory.GetEmptySlots()} free).");
                return false;
            }

            VillheimPlugin.Debug($"{villager.GetHoverName()} had lost the {tool.ToString().ToLowerInvariant()}; a new one was given.");
            return villager.EquipItem(given, false) && IsHolding(villager, tool);
        }

        public static bool IsHolding(Humanoid villager, Tool tool)
        {
            ItemDrop.ItemData current = villager.GetRightItem();
            return current != null && IsTool(current, tool);
        }

        /// <summary>The prefab of the tool this villager should carry, by the gear tier of his village.</summary>
        private static string ToolPrefab(Humanoid villager, Tool tool)
        {
            if (tool == Tool.Hammer || tool == Tool.Hoe)
            {
                return tool.ToString();
            }

            int tier = 0;
            if (villager is Villager v && v.Zdo != null)
            {
                VillageHearth hearth = VillageHearth.Find(v.VillageId);
                if (hearth != null && hearth.IsValid)
                {
                    var state = new Village.VillageState(hearth.Zdo);
                    tier = GearTier(Village.VillageBrain.TierIndex(state.Plots.Count), state.Biome);
                }
            }

            tier = Mathf.Clamp(tier, 0, MaxTier);
            return tool == Tool.Axe ? Axes[tier] : Pickaxes[tier];
        }

        private static bool IsTool(ItemDrop.ItemData item, Tool tool)
        {
            if (item?.m_shared == null)
            {
                return false;
            }

            switch (tool)
            {
                case Tool.Axe:
                    return item.m_shared.m_skillType == Skills.SkillType.Axes;
                case Tool.Pickaxe:
                    return item.m_shared.m_skillType == Skills.SkillType.Pickaxes;
                case Tool.Hoe:
                    return item.m_dropPrefab != null
                        ? item.m_dropPrefab.name == "Hoe"
                        : item.m_shared.m_name == "$item_hoe";
                default:
                    return item.m_dropPrefab != null
                        ? item.m_dropPrefab.name == "Hammer"
                        : item.m_shared.m_name == "$item_hammer";
            }
        }

        /// <summary>Adds an item to the inventory without equipping it.</summary>
        private static void Carry(Humanoid humanoid, string itemName)
        {
            GameObject prefab = string.IsNullOrEmpty(itemName) ? null : ObjectDB.instance.GetItemPrefab(itemName);
            if (prefab != null)
            {
                humanoid.PickupPrefab(prefab, 0, false);
            }
        }

        private static void Equip(Humanoid humanoid, string itemName)
        {
            if (string.IsNullOrEmpty(itemName))
            {
                return;
            }

            GameObject prefab = ObjectDB.instance.GetItemPrefab(itemName);
            if (prefab == null)
            {
                return;
            }

            ItemDrop.ItemData item = humanoid.PickupPrefab(prefab, 0, false);
            if (item != null)
            {
                humanoid.EquipItem(item, false);
            }
        }

        /// <summary>
        /// The tier's clothes plus the culture's own (Cultures/cultures.txt): a linen cape in a Plains village, a
        /// tunic or dress elsewhere. Items the game does not have are left out, so the tier's own always remain.
        /// </summary>
        private static WeightedItem[] WithCulture(WeightedItem[] tierItems, Cultures.Culture culture, string slot, int tier, bool female)
        {
            if (!culture.Clothes.TryGetValue(slot, out List<Cultures.Wear> extra) || extra.Count == 0)
            {
                return tierItems;
            }

            var items = new List<WeightedItem>(tierItems);
            foreach (Cultures.Wear wear in extra)
            {
                if (tier < wear.MinTier || (wear.Sex == 1 && female) || (wear.Sex == 2 && !female))
                {
                    continue;
                }

                List<string> prefabs = Expand(wear.Prefab);
                foreach (string prefab in prefabs)
                {
                    items.Add(new WeightedItem(prefab, wear.Weight / prefabs.Count));
                }
            }

            return items.ToArray();
        }

        private static readonly Dictionary<string, List<string>> Expanded = new Dictionary<string, List<string>>();

        /// <summary>"ArmorTunic*" to every item whose prefab name starts so; a plain name to itself if the game has it.</summary>
        private static List<string> Expand(string pattern)
        {
            if (Expanded.TryGetValue(pattern, out List<string> cached))
            {
                return cached;
            }

            var list = new List<string>();
            if (pattern.EndsWith("*"))
            {
                string prefix = pattern.Substring(0, pattern.Length - 1);
                list.AddRange(ObjectDB.instance.m_items.Where(i => i != null && i.name.StartsWith(prefix) && i.GetComponent<ItemDrop>() != null)
                    .Select(i => i.name).OrderBy(n => n, System.StringComparer.Ordinal));
            }
            else if (ObjectDB.instance.GetItemPrefab(pattern) != null)
            {
                list.Add(pattern);
            }

            if (list.Count == 0)
            {
                VillheimPlugin.Debug($"Culture clothes: no item '{pattern}' in this game; left out.");
            }

            Expanded[pattern] = list;
            return list;
        }

        /// <summary>A style, with the ones whose shown name holds one of the culture's words given more often.</summary>
        private static string PickStyle(System.Random rng, List<string> prefabs, Dictionary<string, float> prefer)
        {
            if (prefer == null || prefer.Count == 0)
            {
                return prefabs[rng.Next(prefabs.Count)];
            }

            var weights = new float[prefabs.Count];
            float total = 0f;
            for (int i = 0; i < prefabs.Count; i++)
            {
                ShownNames.TryGetValue(prefabs[i], out string shown);
                float weight = 1f;
                foreach (KeyValuePair<string, float> word in prefer)
                {
                    if (shown != null && shown.Contains(word.Key))
                    {
                        weight = Mathf.Max(weight, word.Value);
                    }
                }

                weights[i] = weight;
                total += weight;
            }

            double roll = rng.NextDouble() * total;
            for (int i = 0; i < prefabs.Count; i++)
            {
                roll -= weights[i];
                if (roll <= 0)
                {
                    return prefabs[i];
                }
            }

            return prefabs[prefabs.Count - 1];
        }

        /// <summary>Prefab name to the style's name as the game shows it, plain (for the culture's style words).</summary>
        private static readonly Dictionary<string, string> ShownNames = new Dictionary<string, string>();

        private static List<string> _beards;

        /// <summary>Every beard the game has (Beard1, Beard2...), less "no beard". Worked out once.</summary>
        private static List<string> BeardStyles()
        {
            if (_beards != null && _beards.Count > 0)
            {
                return _beards;
            }

            _beards = new List<string>();
            foreach (GameObject item in ObjectDB.instance.m_items)
            {
                if (item == null || !item.name.StartsWith("Beard") || item.name == "BeardNone")
                {
                    continue;
                }

                string shown = Shown(item);
                if (shown.Length == 0 || shown == "nobeard" || shown == "none")
                {
                    continue;
                }

                ShownNames[item.name] = shown;
                _beards.Add(item.name);
            }

            _beards.Sort(System.StringComparer.Ordinal);
            return _beards;
        }

        private static string Shown(GameObject item)
        {
            string token = item.GetComponent<ItemDrop>()?.m_itemData?.m_shared?.m_name;
            string shown = token != null && Localization.instance != null ? Localization.instance.Localize(token) : token;
            return Plain(shown);
        }

        // Hair styles never given, by the name the game shows for them (Tyler, 2026-11-06). Bald is never given either.
        // Compared with spaces, hyphens and punctuation taken out, so "Old One-Eye" matches "old one eye".
        private static readonly HashSet<string> NotForWomen = new HashSet<string>
        {
            Plain("old one eye"), Plain("parted"), Plain("short"), Plain("short curls"), Plain("side swept"), Plain("speed demon"),
        };

        private static readonly HashSet<string> NotForMen = new HashSet<string>
        {
            Plain("old one eye"), Plain("matronly"), Plain("side swept"), Plain("speed demon"),
        };

        private static string Plain(string text) =>
            new string((text ?? "").ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());

        private static readonly Dictionary<bool, List<string>> Styles = new Dictionary<bool, List<string>>();

        /// <summary>Every hair style grown villagers of this sex may have (for children's hair and the tuning rig).</summary>
        internal static List<string> HairList(bool female) => HairStyles(female);

        /// <summary>Every hair the game has, none left out, in the game's own order (Hair2 before Hair10), for the rig.</summary>
        internal static List<string> AllHair() =>
            ObjectDB.instance == null ? new List<string>()
                : ObjectDB.instance.m_items.Where(i => i != null && i.name.StartsWith("Hair") && i.name != "HairNone")
                    .Select(i => i.name).Distinct().OrderBy(n => n.Length).ThenBy(n => n, System.StringComparer.Ordinal).ToList();

        /// <summary>"none" and every beard the game has, for the rig.</summary>
        internal static List<string> AllBeards() =>
            ObjectDB.instance == null ? new List<string> { "none" }
                : new[] { "none" }.Concat(ObjectDB.instance.m_items.Where(i => i != null && i.name.StartsWith("Beard") && i.name != "BeardNone")
                    .Select(i => i.name).Distinct().OrderBy(n => n.Length).ThenBy(n => n, System.StringComparer.Ordinal)).ToList();

        /// <summary>A hair or beard style's name as the game shows it ("Braided 2"), or the prefab name.</summary>
        internal static string ShownName(string prefab)
        {
            GameObject item = ObjectDB.instance != null && !string.IsNullOrEmpty(prefab) ? ObjectDB.instance.GetItemPrefab(prefab) : null;
            string token = item != null ? item.GetComponent<ItemDrop>()?.m_itemData?.m_shared?.m_name : null;
            return token != null && Localization.instance != null ? Localization.instance.Localize(token) : prefab ?? "";
        }

        /// <summary>The middle of a culture's skin and hair color ranges, for the rig.</summary>
        internal static void CultureColors(Cultures.Culture culture, out Vector3 skin, out Vector3 hair)
        {
            Color s = Color.Lerp(SkinLight, SkinDark, Mathf.Clamp((culture.Skin.x + culture.Skin.y) / 2f, 0.25f, 1f));
            Color h = Color.Lerp(HairLight, HairDark, (culture.HairRed.x + culture.HairRed.y) / 2f) *
                      Mathf.Clamp((culture.HairShade.x + culture.HairShade.y) / 2f, 0.05f, 1f);
            skin = new Vector3(s.r, s.g, s.b);
            hair = new Vector3(h.r, h.g, h.b);
        }

        /// <summary>
        /// The hair prefabs a villager may get: every hair the game has (Hair1, Hair2...), less the ones left out for
        /// women or men, judged by the style's name as the game shows it. Worked out once per model.
        /// </summary>
        private static List<string> HairStyles(bool female)
        {
            if (Styles.TryGetValue(female, out List<string> cached) && cached.Count > 0)
            {
                return cached;
            }

            var list = new List<string>();
            HashSet<string> excluded = female ? NotForWomen : NotForMen;
            foreach (GameObject item in ObjectDB.instance.m_items)
            {
                if (item == null || !item.name.StartsWith("Hair") || item.name == "HairNone")
                {
                    continue;
                }

                ItemDrop drop = item.GetComponent<ItemDrop>();
                string token = drop?.m_itemData?.m_shared?.m_name;
                string shown = token != null && Localization.instance != null ? Localization.instance.Localize(token) : token;
                shown = Plain(shown);
                if (shown.Length == 0 || shown == "nohair" || shown == "none" || shown == "bald" || excluded.Contains(shown))
                {
                    continue;
                }

                ShownNames[item.name] = shown;
                list.Add(item.name);
            }

            list.Sort(System.StringComparer.Ordinal);
            Styles[female] = list;
            VillheimPlugin.Debug($"Villager hair for {(female ? "women" : "men")}: {string.Join(", ", list)}.");
            return list;
        }

        private static int Hash(string itemName)
        {
            return string.IsNullOrEmpty(itemName) ? 0 : itemName.GetStableHashCode();
        }

        private static string FirstExisting(string preferred, string fallback)
        {
            return ObjectDB.instance.GetItemPrefab(preferred) != null ? preferred : fallback;
        }

        private static string Pick(System.Random rng, WeightedItem[] options)
        {
            float total = 0f;
            foreach (WeightedItem option in options)
            {
                total += option.Weight;
            }

            double roll = rng.NextDouble() * total;
            foreach (WeightedItem option in options)
            {
                roll -= option.Weight;
                if (roll <= 0)
                {
                    return option.Item;
                }
            }

            return options[options.Length - 1].Item;
        }
    }
}
