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
    }
}
