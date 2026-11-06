using UnityEngine;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Dresses a villager with vanilla hair, beards, armor and tools. The look comes from a fixed seed, so each
    /// villager keeps the same face and style; the gear tier comes from the size of the village, so armor and tools
    /// improve as the village grows. Black Forest villages start one tier higher.
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
        private static readonly string[] Axes = { "AxeFlint", "AxeFlint", "AxeBronze", "AxeBronze", "AxeBronze" };
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

            // The face and style use their own random stream, so a gear change never changes the person.
            var looks = new System.Random(seed);
            bool female = looks.Next(2) == 1;
            vis.SetModel(female ? 1 : 0);

            Color skin = Color.Lerp(SkinLight, SkinDark, (float)looks.NextDouble() * 0.85f);
            vis.SetSkinColor(new Vector3(skin.r, skin.g, skin.b));

            Color hair = Color.Lerp(HairLight, HairDark, (float)looks.NextDouble()) *
                         Mathf.Lerp(0.1f, 1f, (float)looks.NextDouble());
            vis.SetHairColor(new Vector3(hair.r, hair.g, hair.b));

            string hairItem = FirstExisting($"Hair{looks.Next(1, 21)}", "Hair1");
            villager.m_hairItem = hairItem;
            vis.SetHairItem(Hash(hairItem));

            string beard = female || looks.Next(5) == 0 ? "" : FirstExisting($"Beard{looks.Next(1, 11)}", "Beard1");
            villager.m_beardItem = beard;
            vis.SetBeardItem(Hash(beard));

            villager.UnequipAllItems();
            villager.GetInventory()?.RemoveAll();

            int tier = Mathf.Clamp(gearTier, 0, MaxTier);
            var gear = new System.Random(unchecked(seed * 17 + tier * 7919));
            Equip(villager, Pick(gear, Chests[tier]));
            Equip(villager, Pick(gear, Legs[tier]));
            Equip(villager, Pick(gear, Helmets[tier]));
            Equip(villager, Pick(gear, Capes[tier]));

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
                    return villager.EquipItem(item, false);
                }
            }

            return false;
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
