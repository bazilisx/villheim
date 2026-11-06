using UnityEngine;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Dresses a villager with vanilla hair, beards, clothes and tools, chosen from a fixed seed so
    /// each villager always looks the same.
    /// </summary>
    internal static class VillagerLooks
    {
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

        private static readonly WeightedItem[] Chests =
        {
            new WeightedItem("ArmorRagsChest", 5f),
            new WeightedItem("ArmorLeatherChest", 3f),
            new WeightedItem("ArmorTrollLeatherChest", 0.5f),
            new WeightedItem("", 1f)
        };

        private static readonly WeightedItem[] Legs =
        {
            new WeightedItem("ArmorRagsLegs", 5f),
            new WeightedItem("ArmorLeatherLegs", 3f),
            new WeightedItem("ArmorTrollLeatherLegs", 0.5f)
        };

        private static readonly WeightedItem[] Helmets =
        {
            new WeightedItem("", 8f),
            new WeightedItem("HelmetLeather", 1.5f),
            new WeightedItem("HelmetTrollLeather", 0.3f)
        };

        private static readonly WeightedItem[] Capes =
        {
            new WeightedItem("", 6f),
            new WeightedItem("CapeDeerHide", 2f),
            new WeightedItem("CapeTrollHide", 0.4f)
        };

        private static readonly WeightedItem[] Tools =
        {
            new WeightedItem("", 4f),
            new WeightedItem("Hammer", 1.5f),
            new WeightedItem("Hoe", 1f),
            new WeightedItem("AxeStone", 1.5f),
            new WeightedItem("AxeFlint", 1f),
            new WeightedItem("Club", 1f),
            new WeightedItem("Torch", 0.5f),
            new WeightedItem("FishingRod", 0.3f)
        };

        public static void Apply(Villager villager, int seed)
        {
            VisEquipment vis = villager.m_visEquipment ? villager.m_visEquipment : villager.GetComponent<VisEquipment>();
            if (vis == null || ObjectDB.instance == null)
            {
                return;
            }

            var rng = new System.Random(seed);
            bool female = rng.Next(2) == 1;
            vis.SetModel(female ? 1 : 0);

            Color skin = Color.Lerp(SkinLight, SkinDark, (float)rng.NextDouble() * 0.85f);
            vis.SetSkinColor(new Vector3(skin.r, skin.g, skin.b));

            Color hair = Color.Lerp(HairLight, HairDark, (float)rng.NextDouble()) *
                         Mathf.Lerp(0.1f, 1f, (float)rng.NextDouble());
            vis.SetHairColor(new Vector3(hair.r, hair.g, hair.b));

            string hairItem = FirstExisting($"Hair{rng.Next(1, 21)}", "Hair1");
            villager.m_hairItem = hairItem;
            vis.SetHairItem(Hash(hairItem));

            string beard = female || rng.Next(5) == 0 ? "" : FirstExisting($"Beard{rng.Next(1, 11)}", "Beard1");
            villager.m_beardItem = beard;
            vis.SetBeardItem(Hash(beard));

            villager.UnequipAllItems();
            villager.GetInventory()?.RemoveAll();

            Equip(villager, Pick(rng, Chests));
            Equip(villager, Pick(rng, Legs));
            Equip(villager, Pick(rng, Helmets));
            Equip(villager, Pick(rng, Capes));
            Equip(villager, Pick(rng, Tools));
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
