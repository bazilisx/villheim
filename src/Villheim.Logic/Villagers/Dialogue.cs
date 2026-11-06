using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// What villagers say about what is going on: what they are doing, what they want and what the village needs.
    ///
    /// Every line belongs to a topic with a condition on the moment (the villager's work, health, trade and role, the
    /// village's needs, the building going up, the time of day, the weather). When a villager speaks, the topics whose
    /// conditions hold are gathered and one line is picked, weighted by how specific the topic is. Lines can name the
    /// material, building, food or village with {material}, {building}, {food}, {village} and {name}.
    ///
    /// Villagers speak when you talk to them, and now and then on their own while you are close by.
    /// </summary>
    internal static class Dialogue
    {
        internal sealed class Moment
        {
            public Villager Villager;
            public VillageHearth Hearth;
            public VillageState State;
            public VillageNeeds Needs;
            public string Doing;
            public float Health;
            public Roles.Trade Trade;
            public Roles.Background Background;
            public string Material;
            public string Building;
            public float Hour;
        }

        private sealed class Topic
        {
            public Func<Moment, bool> When;
            public float Weight;
            public string[] Lines;
        }

        private sealed class Spoken
        {
            public float Next;
            public string Last;
        }

        private const float SelfTalkRange = 14f;

        private static readonly ConditionalWeakTable<Villager, Spoken> SpokenStates = new ConditionalWeakTable<Villager, Spoken>();

        private static bool Doing(Moment m, string word) => m.Doing != null && m.Doing.IndexOf(word, StringComparison.OrdinalIgnoreCase) >= 0;

        private static readonly Topic[] Topics =
        {
            // ---- what they are doing
            new Topic { Weight = 3f, When = m => Doing(m, "felling") || Doing(m, "splitting"), Lines = new[]
            {
                "This one will fall away from the houses. Stand back.",
                "Good straight trunk. The builder will be pleased.",
                "A few more swings and it's down.",
                "We need the {material}. The trees have plenty.",
            } },
            new Topic { Weight = 3f, When = m => Doing(m, "rock"), Lines = new[]
            {
                "Stone for the {building}. My arms will feel it tonight.",
                "This rock has been here longer than any of us.",
                "Mind the chips. They fly.",
            } },
            new Topic { Weight = 3f, When = m => Doing(m, "building"), Lines = new[]
            {
                "One piece at a time. That's how a house goes up.",
                "Hand me that beam. No, the other one.",
                "The {building} is coming along.",
                "Floor first, then the walls. Then we argue about the roof.",
            } },
            new Topic { Weight = 3f, When = m => Doing(m, "carrying") || Doing(m, "gathering"), Lines = new[]
            {
                "This goes in the chest by the hearth.",
                "Heavier than it looks.",
                "Every bit of {material} counts.",
            } },
            new Topic { Weight = 3f, When = m => Doing(m, "cook") || Doing(m, "fire"), Lines = new[]
            {
                "Smells good, doesn't it? Wait your turn.",
                "Off the fire before it burns. That's the whole trick.",
                "A full belly heals faster than any herb.",
            } },
            new Topic { Weight = 2f, When = m => Doing(m, "watch"), Lines = new[]
            {
                "Quiet out there. I don't trust quiet.",
                "I keep an eye on the tree line. Greydwarfs like to creep.",
                "If anything comes, I'll see it first.",
            } },
            new Topic { Weight = 2f, When = m => Doing(m, "make"), Lines = new[]
            {
                "Every village needs a {building}. Ours will be a good one.",
                "A little of the chest's wood for something we can all use.",
            } },

            // ---- what they want and need
            new Topic { Weight = 2.5f, When = m => m.Material != null && m.Doing == null, Lines = new[]
            {
                "We're short of {material}. If you have some, the chest is by the hearth.",
                "The {building} is waiting on {material}.",
                "Bring {material} to the chest and you'll have friends here.",
            } },
            new Topic { Weight = 2.5f, When = m => m.Health < 0.5f, Lines = new[]
            {
                "I took a bad knock. I need something to eat.",
                "I'm hurt. A hot meal would set me right.",
            } },
            new Topic { Weight = 2f, When = m => m.Health < 0.95f && m.Health >= 0.5f, Lines = new[]
            {
                "Just a scratch. I'll eat something later.",
                "Still sore from the last fight.",
            } },
            new Topic { Weight = 1.5f, When = m => m.Needs != null && m.Needs.Missing.Count == 0 && !ConstructionSite.IsActive(m.Hearth.Zdo), Lines = new[]
            {
                "The chest is full for now. A good day.",
                "Nothing to haul today. I might sit by the fire.",
            } },
            new Topic { Weight = 1.5f, When = m => m.Building != null, Lines = new[]
            {
                "We're building a {building}. Come back and see it finished.",
                "Once the {building} is done, there's room for more of us.",
            } },
            new Topic { Weight = 1f, When = m => m.Hearth != null && Beds.Free(m.Hearth) > 0, Lines = new[]
            {
                "There's a free bed. Someone new will turn up soon, you'll see.",
            } },

            // ---- trades and roles
            new Topic { Weight = 1.2f, When = m => m.Trade == Roles.Trade.Carpenter, Lines = new[]
            {
                "I'm the one who builds around here. Mind the hammer.",
                "A good joint holds a roof for a lifetime.",
            } },
            new Topic { Weight = 1.2f, When = m => m.Trade == Roles.Trade.Woodcutter, Lines = new[]
            {
                "Wood is what we need most. Always wood.",
                "I know every tree around {village}.",
            } },
            new Topic { Weight = 1.2f, When = m => m.Trade == Roles.Trade.Miner, Lines = new[]
            {
                "Stone doesn't burn. That's why I like it.",
                "Give me a pickaxe and a rock and I'm happy.",
            } },
            new Topic { Weight = 1.2f, When = m => m.Trade == Roles.Trade.Cook, Lines = new[]
            {
                "Bring me meat and I'll keep everyone fed.",
                "Someone has to keep the fire going.",
            } },
            new Topic { Weight = 0.8f, When = m => m.Background == Roles.Background.Protector, Lines = new[]
            {
                "If trouble comes, I'll be the first one out there.",
                "I sleep lightly. Someone has to.",
            } },
            new Topic { Weight = 0.8f, When = m => m.Background == Roles.Background.Carer, Lines = new[]
            {
                "Have you eaten today? You look thin.",
                "I like to keep the hearth warm for when everyone comes back.",
            } },

            // ---- time and weather
            new Topic { Weight = 1f, When = m => m.Hour >= 19f && m.Hour < 22f, Lines = new[]
            {
                "Almost time to sit by the fire.",
                "Long day. My bed is calling.",
            } },
            new Topic { Weight = 1f, When = m => m.Hour >= 5f && m.Hour < 8f, Lines = new[]
            {
                "Up with the sun. There's work to do.",
                "Cold morning. The fire helps.",
            } },
            new Topic { Weight = 1f, When = m => EnvMan.IsWet(), Lines = new[]
            {
                "Rain again. At least the roof holds.",
                "Wet wood, wet boots, wet everything.",
            } },
            new Topic { Weight = 0.8f, When = m => m.State != null && m.State.Plots.Count <= 1, Lines = new[]
            {
                "We've only just settled here.",
                "It's not much yet. Give us time.",
            } },
            new Topic { Weight = 0.8f, When = m => m.State != null && m.State.Plots.Count >= 4, Lines = new[]
            {
                "{village} is turning into a proper village.",
                "Remember when this was just a fire and two of us?",
            } },
        };

        /// <summary>A line for this villager right now, or null when nothing in particular comes to mind.</summary>
        public static string LineFor(Villager villager)
        {
            Moment moment = Read(villager);
            var options = Topics.Where(t => SafeWhen(t, moment)).ToList();
            if (options.Count == 0)
            {
                return null;
            }

            float roll = Random.value * options.Sum(t => t.Weight);
            Topic topic = options[options.Count - 1];
            foreach (Topic option in options)
            {
                roll -= option.Weight;
                if (roll <= 0f)
                {
                    topic = option;
                    break;
                }
            }

            Spoken spoken = SpokenStates.GetOrCreateValue(villager);
            string line = topic.Lines[Random.Range(0, topic.Lines.Length)];
            if (line == spoken.Last && topic.Lines.Length > 1)
            {
                line = topic.Lines[(Array.IndexOf(topic.Lines, line) + 1) % topic.Lines.Length];
            }

            spoken.Last = line;
            return Fill(line, moment);
        }

        /// <summary>Now and then, with a player close by, a villager says something about what he is doing.</summary>
        public static void Tick(Villager villager)
        {
            if (!VillheimConfig.VillagerChatter.Value || Sleep.IsAsleep(villager) || Player.m_localPlayer == null ||
                global::Chat.instance == null)
            {
                return;
            }

            Spoken spoken = SpokenStates.GetOrCreateValue(villager);
            if (Time.time < spoken.Next)
            {
                return;
            }

            spoken.Next = Time.time + Random.Range(45f, 110f);
            if (Vector3.Distance(Player.m_localPlayer.transform.position, villager.transform.position) > SelfTalkRange ||
                Random.value > 0.5f)
            {
                return;
            }

            string line = LineFor(villager);
            if (line != null)
            {
                global::Chat.instance.SetNpcText(villager.gameObject, Vector3.up * 2.2f, 20f, 5f, "", line, false);
            }
        }

        private static bool SafeWhen(Topic topic, Moment moment)
        {
            try
            {
                return topic.When(moment);
            }
            catch (Exception)
            {
                return false;
            }
        }

        private static Moment Read(Villager villager)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            var moment = new Moment
            {
                Villager = villager,
                Hearth = hearth != null && hearth.IsValid ? hearth : null,
                Doing = Healing.Describe(villager) ?? Chores.Describe(villager) ?? FreeTime.Describe(villager),
                Health = villager.GetHealth() / Mathf.Max(1f, villager.GetMaxHealth()),
                Trade = Roles.TradeOf(villager),
                Background = Roles.BackgroundOf(villager),
                Hour = EnvMan.instance != null ? EnvMan.instance.GetDayFraction() * 24f : 12f,
            };

            if (moment.Hearth != null)
            {
                moment.State = new VillageState(moment.Hearth.Zdo);
                moment.Needs = VillageNeeds.For(villager.VillageId);
                if (moment.Needs != null && moment.Needs.Missing.Count > 0)
                {
                    moment.Material = Materials.Label(moment.Needs.Missing.OrderByDescending(n => n.Value).First().Key);
                }

                ConstructionSite.Site site = ConstructionSite.Get(moment.Hearth.Zdo);
                if (site != null)
                {
                    moment.Building = VillageBrain.RoleName(site.Role);
                }
            }

            if (moment.Doing == null || moment.Doing == "idle")
            {
                moment.Doing = null;
            }

            return moment;
        }

        private static string Fill(string line, Moment m)
        {
            string building = m.Building ?? "next house";
            if (m.Doing != null && m.Doing.StartsWith("making a ", StringComparison.Ordinal))
            {
                building = m.Doing.Substring("making a ".Length);
            }

            return line.Replace("{material}", m.Material ?? "wood")
                .Replace("{building}", building)
                .Replace("{village}", m.State?.Name ?? "the village")
                .Replace("{name}", m.Villager.VillagerName);
        }
    }
}
