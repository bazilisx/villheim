using System.Collections.Generic;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Lines for the vanilla NpcTalk component (the one the Dvergr use) plus what villagers say when you talk to them.
    /// </summary>
    internal static class VillagerTalk
    {
        private static readonly List<string> Greets = new List<string>
        {
            "Hail, traveler.",
            "Well met.",
            "Welcome to our village.",
            "Another wanderer from the stones?",
            "Warm yourself by the fire, friend."
        };

        private static readonly List<string> Goodbyes = new List<string>
        {
            "Safe travels.",
            "Odin guide you.",
            "Come back when the mead is ready.",
            "Mind the trolls on the forest roads."
        };

        private static readonly List<string> RandomTalk = new List<string>
        {
            "The fire keeps the greylings away. Mostly.",
            "Good timber in the forest. Bad trolls, though.",
            "The ravens have been watching us all morning.",
            "We could use another roof before the rains.",
            "Boars got into the turnips again.",
            "My grandmother says the old stones still hum at night.",
            "Have you seen the deer herds to the south?",
            "One more house and this place starts to feel like home."
        };

        private static readonly List<string> Aggravated = new List<string>
        {
            "Have you lost your mind?",
            "Leave us be!",
            "To arms! We are attacked!"
        };

        private static readonly List<string> Interact = new List<string>
        {
            "We are few, but we are growing.",
            "The elders say the land was empty before the hearth was lit.",
            "If you have wood to spare, the builders will thank you.",
            "Stay a while. The fire is warm.",
            "Every new roof brings new faces."
        };

        public static void Configure(NpcTalk talk)
        {
            if (talk == null)
            {
                return;
            }

            bool chatter = VillheimConfig.VillagerChatter.Value;
            talk.enabled = chatter;
            talk.m_name = "Villager";
            talk.m_maxRange = 15f;
            // Only a villager you walk right up to says hello, and not again for a while.
            talk.m_greetRange = 3.5f;
            talk.m_byeRange = 10f;
            talk.m_offset = 2.2f;
            talk.m_minTalkInterval = 30f;
            talk.m_hideDialogDelay = 5f;
            talk.m_randomTalkInterval = 25f;

            // Talk about what is going on comes from Dialogue.Tick; the game's own random talk would repeat itself.
            talk.m_randomTalkChance = 0f;
            List<string> greets = Dialogue.Plain("greet");
            List<string> byes = Dialogue.Plain("bye");
            talk.m_randomTalk = new List<string>(RandomTalk);
            talk.m_randomTalkInFactionBase = new List<string>(RandomTalk);
            talk.m_randomGreets = greets.Count > 0 ? greets : new List<string>(Greets);
            talk.m_randomGoodbye = byes.Count > 0 ? byes : new List<string>(Goodbyes);
            talk.m_privateAreaAlarm = new List<string>(Aggravated);
            talk.m_aggravated = new List<string>(Aggravated);
            talk.m_randomTalkFX = talk.m_randomTalkFX ?? new EffectList();
            talk.m_randomGreetFX = talk.m_randomGreetFX ?? new EffectList();
            talk.m_randomGoodbyeFX = talk.m_randomGoodbyeFX ?? new EffectList();
        }

        public static string InteractLine(VillageHearth hearth)
        {
            if (hearth != null && hearth.IsValid && new VillageState(hearth.Zdo).Plots.Count <= 1 && Random.value < 0.5f)
            {
                return "We have only just settled here.";
            }

            return Interact[Random.Range(0, Interact.Count)];
        }

        /// <summary>
        /// The game's NpcTalk, for villagers, without its turning. Every frame it turned an NPC that stood still (under
        /// 0.5 m/s) to face the closest player within 15 m. Our own code turns the villager toward his work 20 times
        /// a second, so with a player nearby the two pulled him back and forth: that was the wobble seen at every
        /// standing job (a motion trace on 2026-11-06 showed the look direction flipping between the work and the
        /// player every frame). Greetings and goodbyes are kept; when a villager should look at a player, our own code
        /// (free time, greetings, reactions) does it.
        /// </summary>
        [HarmonyLib.HarmonyPatch(typeof(NpcTalk), nameof(NpcTalk.Update))]
        internal static class NoTurnPatch
        {
            private static bool Prefix(NpcTalk __instance)
            {
                if (!(__instance.m_character is Villager))
                {
                    return true;
                }

                if (__instance.m_monsterAI == null || __instance.m_nview == null || !__instance.m_nview.IsValid() ||
                    __instance.m_monsterAI.GetTargetCreature() != null || __instance.m_monsterAI.GetStaticTarget() != null)
                {
                    return false;
                }

                __instance.UpdateTarget();
                Player target = __instance.m_targetPlayer;
                if (target != null && __instance.m_seeTarget)
                {
                    float distance = Vector3.Distance(target.transform.position, __instance.transform.position);
                    if (!__instance.m_didGreet && distance < __instance.m_greetRange)
                    {
                        __instance.m_didGreet = true;
                        __instance.QueueSay(Picked(__instance, "greet") ?? __instance.m_randomGreets, "Greet", __instance.m_randomGreetFX);
                    }

                    if (__instance.m_didGreet && !__instance.m_didGoodbye && distance > __instance.m_byeRange)
                    {
                        __instance.m_didGoodbye = true;
                        __instance.QueueSay(Picked(__instance, "bye") ?? __instance.m_randomGoodbye, "Greet", __instance.m_randomGoodbyeFX);
                    }
                }

                __instance.UpdateSayQueue();
                return false;
            }

            /// <summary>
            /// With cultures on, a village villager's greeting or goodbye is picked like his other lines, so the
            /// culture's own (Dialogue/cultures.txt, "greet, people:slavic") come up alongside the plain ones.
            /// </summary>
            private static List<string> Picked(NpcTalk talk, string channel)
            {
                if (!(talk.m_character is Villager villager) || villager.VillageId == 0 || !Cultures.On)
                {
                    return null;
                }

                string line = Dialogue.LineFor(villager, channel);
                return line != null ? new List<string> { line } : null;
            }
        }
    }
}
