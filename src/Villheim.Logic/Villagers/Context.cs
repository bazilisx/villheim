using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// What a villager can see around him, as dialogue tags and fill-ins: where he stands (at the forge, the fire, the
    /// chest, the shore, indoors, the edge of the village), the sky (storm, mist, snow, dawn, dusk), which bosses are
    /// down in the world, animals and enemies in sight, and the player in front of him (hurt, wet, cold, armed, what he
    /// wears, a boss trophy in his pack, a heavy load, sneaking).
    ///
    /// Ideas from Stardew Valley (lines tied to a place), Skyrim (greetings that notice the player's gear and health)
    /// and Gothic (a drawn weapon is noticed). The code is our own. Worked out at most every three seconds per
    /// villager, since a villager's surroundings change slowly.
    /// </summary>
    internal static class Context
    {
        private sealed class Cache
        {
            public float At = -100f;
            public readonly List<string> Tags = new List<string>();
            public string Beast;
            public string Place;
        }

        private static readonly ConditionalWeakTable<Villager, Cache> Caches = new ConditionalWeakTable<Villager, Cache>();

        // Global keys of the bosses, strongest last, and how villagers name them.
        private static readonly (string Key, string Tag, string Name)[] Bosses =
        {
            ("defeated_eikthyr", "eikthyr", "the great stag"), ("defeated_gdking", "elder", "the Elder"),
            ("defeated_bonemass", "bonemass", "Bonemass"), ("defeated_dragon", "moder", "Moder"),
            ("defeated_goblinking", "yagluth", "Yagluth"), ("defeated_queen", "queen", "the Queen under the mist"),
            ("defeated_fader", "fader", "Fader"),
        };

        private static readonly Dictionary<string, string> Trophies = new Dictionary<string, string>
        {
            ["TrophyEikthyr"] = "eikthyr", ["TrophyTheElder"] = "elder", ["TrophyBonemass"] = "bonemass",
            ["TrophyDragonQueen"] = "moder", ["TrophyGoblinKing"] = "yagluth", ["TrophySeekerQueen"] = "queen",
            ["TrophyFader"] = "fader",
        };

        // Creature names ($enemy_x) to the word villagers use.
        private static readonly Dictionary<string, string> Creatures = new Dictionary<string, string>
        {
            ["deer"] = "deer", ["boar"] = "boar", ["boarpiggy"] = "boar", ["neck"] = "neck", ["greyling"] = "greyling",
            ["greydwarf"] = "greydwarf", ["greydwarfbrute"] = "greydwarf", ["greydwarfshaman"] = "greydwarf",
            ["troll"] = "troll", ["skeleton"] = "skeleton", ["skeletonpoison"] = "skeleton", ["ghost"] = "ghost",
            ["wolf"] = "wolf", ["wolfcub"] = "wolf", ["bjorn"] = "bear", ["unbjorn"] = "bear", ["draugr"] = "draugr",
            ["draugrelite"] = "draugr", ["blob"] = "blob", ["leech"] = "leech", ["surtling"] = "surtling",
            ["drake"] = "drake", ["fenring"] = "fenring", ["lox"] = "lox", ["fuling"] = "goblin", ["goblin"] = "goblin",
            ["deathsquito"] = "deathsquito", ["hare"] = "hare", ["chicken"] = "chicken", ["hen"] = "chicken",
            ["serpent"] = "serpent", ["seagal"] = "gull", ["crow"] = "crow", ["eikthyr"] = "great stag",
        };

        private static readonly HashSet<string> Animals = new HashSet<string> { "deer", "boar", "neck", "hare", "chicken", "lox", "gull", "crow" };

        public static IEnumerable<string> Tags(Villager villager)
        {
            Cache cache = Caches.GetOrCreateValue(villager);
            if (Time.time - cache.At > 3f)
            {
                cache.At = Time.time;
                cache.Tags.Clear();
                Work(villager, cache);
            }

            return cache.Tags;
        }

        /// <summary>The animal or creature this villager last saw close by ("deer", "troll"...), for {beast}.</summary>
        public static string Beast(Villager villager) => Caches.TryGetValue(villager, out Cache c) ? c.Beast : null;

        /// <summary>Where this villager stands, in a few words ("by the forge"), for {place}.</summary>
        public static string Place(Villager villager) => Caches.TryGetValue(villager, out Cache c) && c.Place != null ? c.Place : "here";

        private static void Work(Villager villager, Cache cache)
        {
            List<string> tags = cache.Tags;
            Vector3 at = villager.transform.position;
            Places(villager, at, cache);
            Sky(tags);
            BossTags(tags);
            Sightings(villager, at, cache);
            PlayerTags(villager, at, tags);
        }

        // ---------------------------------------------------------------- places

        private static void Places(Villager villager, Vector3 at, Cache cache)
        {
            List<string> tags = cache.Tags;
            cache.Place = null;
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth != null && hearth.IsValid)
            {
                float fromHearth = Utils.DistanceXZ(at, hearth.transform.position);
                float radius = VillheimConfig.VillageRadius != null ? VillheimConfig.VillageRadius.Value : 60f;
                if (fromHearth < 6f) { tags.Add("at:hearth"); cache.Place = "by the hearth"; }
                if (fromHearth > radius * 0.7f) { tags.Add("at:edge"); cache.Place = cache.Place ?? "out at the edge of the village"; }
                if (fromHearth > radius * 1.2f) tags.Add("at:outside");
                Container chest = VillageChest.Find(hearth);
                if (chest != null && Vector3.Distance(chest.transform.position, at) < 4f) { tags.Add("at:chest"); cache.Place = cache.Place ?? "by the chest"; }
            }

            if (villager.Zdo != null && Vector3.Distance(villager.Zdo.GetVec3(Keys.VillagerHome, Vector3.zero), at) < 8f)
            {
                tags.Add("at:home");
            }

            CraftingStation station = Nearest<CraftingStation>(at, 5f);
            if (station != null)
            {
                string name = (station.m_name ?? "").ToLowerInvariant();
                string kind = name.Contains("forge") ? "forge" : name.Contains("workbench") ? "workbench" :
                    name.Contains("cauldron") ? "cauldron" : name.Contains("stonecutter") ? "stonecutter" : "station";
                tags.Add("at:" + kind);
                if (kind != "station") tags.Add("at:station");
                cache.Place = cache.Place ?? (kind == "station" ? "at the bench" : "by the " + kind);
            }

            if (Nearest<Fireplace>(at, 4f) != null && !tags.Contains("at:hearth"))
            {
                tags.Add("at:fire");
                cache.Place = cache.Place ?? "by the fire";
            }

            if (Cover.IsUnderRoof(at + Vector3.up))
            {
                tags.Add("indoors");
                cache.Place = cache.Place ?? "in here";
            }
            else
            {
                tags.Add("outdoors");
            }

            if (NearWater(at))
            {
                tags.Add("at:shore");
                cache.Place = cache.Place ?? "down by the water";
            }
        }

        private static T Nearest<T>(Vector3 at, float within) where T : Component
        {
            foreach (Collider collider in Physics.OverlapSphere(at, within))
            {
                T found = collider.GetComponentInParent<T>();
                if (found != null)
                {
                    return found;
                }
            }

            return null;
        }

        private static bool NearWater(Vector3 at)
        {
            if (ZoneSystem.instance == null)
            {
                return false;
            }

            float water = ZoneSystem.instance.m_waterLevel;
            for (int i = 0; i < 8; i++)
            {
                Vector3 p = at + Quaternion.Euler(0f, i * 45f, 0f) * Vector3.forward * 10f;
                if (ZoneSystem.instance.GetGroundHeight(p) < water - 0.3f)
                {
                    return true;
                }
            }

            return false;
        }

        // ---------------------------------------------------------------- sky and world

        private static void Sky(List<string> tags)
        {
            float hour = EnvMan.instance != null ? EnvMan.instance.GetDayFraction() * 24f : 12f;
            if (hour >= 5f && hour < 7.5f) tags.Add("dawn");
            if (hour >= 11f && hour < 14f) tags.Add("midday");
            if (hour >= 17.5f && hour < 20f) tags.Add("dusk");
            if (hour < 4f) tags.Add("latenight");

            string env = EnvMan.instance?.GetCurrentEnvironment()?.m_name?.ToLowerInvariant() ?? "";
            if (env.Contains("thunder")) tags.Add("weather:storm");
            else if (env.Contains("snow")) tags.Add("weather:snow");
            else if (env.Contains("rain")) tags.Add("weather:rain");
            else if (env.Contains("mist") || env.Contains("fog")) tags.Add("weather:mist");
            else if (env.Contains("clear") || env.Length == 0) tags.Add("weather:clear");
            else tags.Add("weather:other");

            int day = EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;
            if (day < 15) tags.Add("world:young");
            if (day > 100) tags.Add("world:old");
        }

        private static void BossTags(List<string> tags)
        {
            if (ZoneSystem.instance == null)
            {
                return;
            }

            bool any = false;
            foreach (var boss in Bosses)
            {
                if (ZoneSystem.instance.GetGlobalKey(boss.Key))
                {
                    tags.Add("boss:" + boss.Tag);
                    any = true;
                }
            }

            if (!any) tags.Add("bosses:none");
        }

        /// <summary>The strongest boss felled in this world, as villagers name it, or null.</summary>
        public static string LastBoss()
        {
            if (ZoneSystem.instance == null)
            {
                return null;
            }

            return Bosses.Where(b => ZoneSystem.instance.GetGlobalKey(b.Key)).Select(b => b.Name).LastOrDefault();
        }

        // ---------------------------------------------------------------- creatures

        /// <summary>The word villagers use for a creature ("troll", "deer"), or null for people.</summary>
        public static string CreatureWord(Character character)
        {
            if (character == null || character is Player || character is Villager)
            {
                return null;
            }

            string name = (character.m_name ?? "").ToLowerInvariant().Replace("$enemy_", "").Replace("$", "");
            if (Creatures.TryGetValue(name, out string word))
            {
                return word;
            }

            string prefab = character.gameObject.name.Replace("(Clone)", "").Trim().ToLowerInvariant();
            return Creatures.TryGetValue(prefab, out word) ? word : null;
        }

        private static void Sightings(Villager villager, Vector3 at, Cache cache)
        {
            cache.Beast = null;
            float best = 40f;
            Character nearestEnemy = null;
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character == null || character.IsDead() || character is Player || character is Villager)
                {
                    continue;
                }

                float distance = Vector3.Distance(character.transform.position, at);
                if (distance > 40f)
                {
                    continue;
                }

                string word = CreatureWord(character);
                if (word == null)
                {
                    continue;
                }

                if (character.IsTamed())
                {
                    cache.Tags.Add("beast:tame");
                    cache.Tags.Add("tame:" + word);
                    continue;
                }

                if (Animals.Contains(word))
                {
                    cache.Tags.Add("beast:" + word);
                    cache.Tags.Add("beast:any");
                }
                else if (BaseAI.IsEnemy(villager, character))
                {
                    cache.Tags.Add("enemy:" + word);
                    cache.Tags.Add("enemy:seen");
                    if (distance < best)
                    {
                        best = distance;
                        nearestEnemy = character;
                    }
                }

                if (cache.Beast == null || nearestEnemy == character)
                {
                    cache.Beast = word;
                }
            }

            if (nearestEnemy != null)
            {
                string feared = Personality.Fear(villager).ToLowerInvariant();
                string word = CreatureWord(nearestEnemy);
                if (word != null && feared.Contains(word.TrimEnd('s')))
                {
                    cache.Tags.Add("fearnear");
                }
            }
        }

        // ---------------------------------------------------------------- the player

        private static void PlayerTags(Villager villager, Vector3 at, List<string> tags)
        {
            Player player = Player.m_localPlayer;
            if (player == null || player.IsDead())
            {
                return;
            }

            float distance = Vector3.Distance(player.transform.position, at);
            if (distance > 15f)
            {
                return;
            }

            tags.Add("player:here");
            if (distance < 8f) tags.Add("player:near");
            float health = player.GetHealthPercentage();
            if (health < 0.3f) tags.Add("player:badlyhurt");
            else if (health < 0.6f) tags.Add("player:hurt");
            else if (health > 0.95f) tags.Add("player:healthy");

            SEMan se = player.GetSEMan();
            if (se != null)
            {
                if (se.HaveStatusEffect("Wet".GetStableHashCode())) tags.Add("player:wet");
                if (se.HaveStatusEffect("Freezing".GetStableHashCode())) tags.Add("player:freezing");
                else if (se.HaveStatusEffect("Cold".GetStableHashCode())) tags.Add("player:cold");
                if (se.HaveStatusEffect("Rested".GetStableHashCode())) tags.Add("player:rested");
                if (se.HaveStatusEffect("Poison".GetStableHashCode())) tags.Add("player:poisoned");
                if (se.HaveStatusEffect("Burning".GetStableHashCode())) tags.Add("player:burning");
            }

            if (player.IsCrouching()) tags.Add("player:sneaking");
            if (player.InEmote()) tags.Add("player:emote");
            if (player.GetInventory() != null && player.GetInventory().GetTotalWeight() > 260f) tags.Add("player:heavy");

            ItemDrop.ItemData right = player.GetRightItem();
            string weapon = WeaponWord(right);
            if (weapon != null)
            {
                tags.Add("player:holding:" + weapon);
                if (weapon != "torch" && weapon != "hammer" && weapon != "hoe" && weapon != "cultivator" && weapon != "pickaxe")
                {
                    tags.Add("player:armed");
                }
            }

            tags.Add("player:gear:" + GearWord(player));
            if (player.m_shoulderItem != null) tags.Add("player:cape");

            foreach (ItemDrop.ItemData item in player.GetInventory()?.GetAllItems() ?? new List<ItemDrop.ItemData>())
            {
                string prefab = item.m_dropPrefab != null ? item.m_dropPrefab.name : "";
                if (Trophies.TryGetValue(prefab, out string boss))
                {
                    tags.Add("player:trophy:" + boss);
                    tags.Add("player:trophy");
                }
                else if (prefab.StartsWith("Trophy"))
                {
                    tags.Add("player:trophies");
                }

                if ((prefab == "Wood" || prefab == "Stone" || prefab == "FineWood" || prefab == "RoundLog") && item.m_stack >= 20)
                {
                    tags.Add("player:carrying:" + prefab.ToLowerInvariant());
                    tags.Add("player:carrying:materials");
                }

                if (item.m_shared.m_food > 0f && item.m_stack >= 10)
                {
                    tags.Add("player:carrying:food");
                }
            }

            foreach ((Skills.SkillType skill, string word) in SkillWords)
            {
                if (player.GetSkillLevel(skill) >= 50f)
                {
                    tags.Add("player:skilled:" + word);
                }
            }
        }

        private static readonly (Skills.SkillType, string)[] SkillWords =
        {
            (Skills.SkillType.WoodCutting, "woodcutting"), (Skills.SkillType.Pickaxes, "mining"), (Skills.SkillType.Bows, "bows"),
            (Skills.SkillType.Swords, "swords"), (Skills.SkillType.Axes, "axes"), (Skills.SkillType.Spears, "spears"),
            (Skills.SkillType.Run, "running"), (Skills.SkillType.Swim, "swimming"), (Skills.SkillType.Sneak, "sneaking"),
            (Skills.SkillType.Blocking, "blocking"), (Skills.SkillType.Clubs, "clubs"),
        };

        /// <summary>The kind of thing the player has in his hand ("axe", "bow", "torch"...), or null.</summary>
        public static string WeaponWord(ItemDrop.ItemData item)
        {
            if (item?.m_shared == null)
            {
                return null;
            }

            string name = (item.m_shared.m_name ?? "").ToLowerInvariant();
            if (name.Contains("torch")) return "torch";
            if (name.Contains("hammer") && item.m_shared.m_skillType != Skills.SkillType.Clubs) return "hammer";
            if (name.Contains("hoe")) return "hoe";
            if (name.Contains("cultivator")) return "cultivator";
            switch (item.m_shared.m_skillType)
            {
                case Skills.SkillType.Axes: return "axe";
                case Skills.SkillType.Swords: return "sword";
                case Skills.SkillType.Clubs: return "club";
                case Skills.SkillType.Spears: return "spear";
                case Skills.SkillType.Polearms: return "atgeir";
                case Skills.SkillType.Knives: return "knife";
                case Skills.SkillType.Bows: return "bow";
                case Skills.SkillType.Pickaxes: return "pickaxe";
                case Skills.SkillType.Crossbows: return "crossbow";
                case Skills.SkillType.ElementalMagic:
                case Skills.SkillType.BloodMagic: return "staff";
                default: return item.IsWeapon() ? "weapon" : null;
            }
        }

        /// <summary>What the player wears on his chest, as one word: none, rags, leather, troll, bronze, iron, wolf, padded, fine.</summary>
        public static string GearWord(Player player)
        {
            string chest = player.m_chestItem?.m_shared?.m_name?.ToLowerInvariant();
            if (string.IsNullOrEmpty(chest)) return "none";
            if (chest.Contains("rags")) return "rags";
            if (chest.Contains("trollleather")) return "troll";
            if (chest.Contains("leather")) return "leather";
            if (chest.Contains("bronze")) return "bronze";
            if (chest.Contains("iron")) return "iron";
            if (chest.Contains("wolf")) return "wolf";
            if (chest.Contains("pcuirass") || chest.Contains("padded")) return "padded";
            return "fine";
        }

        private static readonly Dictionary<string, string> GearNames = new Dictionary<string, string>
        {
            ["none"] = "bare chest", ["rags"] = "rag tunic", ["leather"] = "leathers", ["troll"] = "troll hide",
            ["bronze"] = "bronze", ["iron"] = "iron mail", ["wolf"] = "wolf fur", ["padded"] = "padded mail", ["fine"] = "fine gear",
        };

        public static string GearName(Player player) => GearNames.TryGetValue(GearWord(player), out string n) ? n : "gear";

        /// <summary>The ordering of gear words, for "better than last time".</summary>
        public static int GearRank(string word)
        {
            switch (word)
            {
                case "none": return 0;
                case "rags": return 1;
                case "leather": return 2;
                case "troll": return 3;
                case "bronze": return 4;
                case "iron": return 5;
                case "wolf": return 6;
                case "padded": return 7;
                default: return 8;
            }
        }
    }
}
