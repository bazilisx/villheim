using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// The healer's trade (D-075), first version. A healer looks after the village's hurt: the most hurt villager under
    /// TendBelow of his health (out of a fight, awake) gets a visit. The healer walks to him, kneels beside him for a
    /// few seconds and he gets TendShare of his health back on top of his own slow healing (Recovery) and what he eats
    /// (Healing). Each villager is tended at most once every two minutes. With nobody hurt, the healer gathers herbs
    /// (Foraging takes dandelions and thistles for him as well as food).
    ///
    /// The healer uses the best remedy in the chests, one per visit (D-078): a healing mead, else a herb or healing food
    /// from the list in Remedies (thistle, honey, mushrooms, dandelion, berries, magecaps, jotun puffs and so on), each
    /// giving back more than hands alone.
    ///
    /// Not yet: sickness (the game has none for villagers), salves or potions made by the healer, tending players.
    /// </summary>
    internal static class Tending
    {
        private const float TendBelow = 0.8f;
        private const float TendShare = 0.25f;
        private const float KneelSeconds = 6f;
        private const float Again = 120f;

        private sealed class State
        {
            public Villager Patient;
            public float GiveUpAt;
            public float KneelSince;
            public float NextLook;
            public float LastRun;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();
        private static readonly Dictionary<ZDOID, float> TendedAt = new Dictionary<ZDOID, float>();

        private static void Log(string message)
        {
            if (LogicConfig.IsOn(LogicConfig.DebugLog))
            {
                VillheimPlugin.Log.LogInfo("[tending] " + message);
            }
        }

        public static string Describe(Villager villager) =>
            States.TryGetValue(villager, out State state) && state.Patient != null && Time.time - state.LastRun < 1f
                ? (state.KneelSince > 0f ? "tending " + state.Patient.VillagerName : "going to " + state.Patient.VillagerName)
                : null;

        private static bool NeedsCare(Villager patient) =>
            patient != null && !patient.IsDead() && patient.GetHealth() < patient.GetMaxHealth() * TendBelow &&
            Status.Current(patient) != Status.Doer.Fight && !Sleep.IsAsleep(patient) && !Leaving.IsLeaving(patient);

        /// <summary>True while the healer goes to someone hurt or tends him.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            State state = States.GetOrCreateValue(villager);
            if (state.Patient != null && Time.time - state.LastRun > 5f)
            {
                state.Patient = null;
            }

            state.LastRun = Time.time;
            if (state.Patient == null && !Begin(villager, state))
            {
                return false;
            }

            Villager patient = state.Patient;
            if (!NeedsCare(patient))
            {
                state.Patient = null;
                return false;
            }

            float distance = Vector3.Distance(villager.transform.position, patient.transform.position);
            if (state.KneelSince <= 0f)
            {
                WalkResult step = Walker.For(villager).Go(villager, ai, dt, patient.transform.position, 1.2f);
                if (step == WalkResult.Walking && Time.time < state.GiveUpAt)
                {
                    return true;
                }

                if (distance > 3f)
                {
                    Log($"{villager.VillagerName} can't get to {patient.VillagerName} ({step}).");
                    TendedAt[patient.GetZDOID()] = Time.time;
                    state.Patient = null;
                    return false;
                }

                state.KneelSince = Time.time;
            }
            else if (distance > 3f)
            {
                // The patient walked off: after him again.
                state.KneelSince = 0f;
                state.GiveUpAt = Time.time + 30f;
                Walker.For(villager).Reset();
                return true;
            }

            ai.StopMoving();
            ai.LookAt(patient.GetEyePoint());
            if (villager.GetRightItem() != null)
            {
                HandItems.PutAway(villager);
            }

            Poses.Hold(villager, Poses.Kneel);
            if (Time.time - state.KneelSince < KneelSeconds)
            {
                return true;
            }

            // A remedy from the chests if there is one (D-078): a healing potion does most, a herb or a healing food
            // more than hands alone. One is used up.
            VillageHearth home = VillageHearth.Find(villager.VillageId);
            float share = TendShare;
            string used = home != null && home.IsValid ? TakeRemedy(home, out share) : null;
            if (used == null)
            {
                share = TendShare;
            }

            float amount = patient.GetMaxHealth() * share;
            patient.Heal(amount, true);
            TendedAt[patient.GetZDOID()] = Time.time;
            Moods.Think(patient, "chat");
            Log($"{villager.VillagerName} tended {patient.VillagerName} (+{amount:0} health{(used != null ? ", with " + used : "")}).");
            state.Patient = null;
            return false;
        }

        /// <summary>
        /// D-078: what a healer may use, best first, with the share of health it gives back. Healing meads first, then
        /// the herbs and healing foods Tyler named.
        /// </summary>
        private static readonly (string Item, float Share)[] Remedies =
        {
            ("MeadHealthMajor", 0.9f), ("MeadHealthMedium", 0.7f), ("MeadHealthMinor", 0.55f), ("MeadHealthLingering", 0.6f),
            ("MushroomJotunPuffs", 0.45f), ("MushroomMagecap", 0.45f), ("Cloudberry", 0.4f), ("Vineberry", 0.4f),
            ("Fiddleheadfern", 0.4f), ("MushroomSmokePuff", 0.4f), ("ElderBark", 0.4f), ("Acorn", 0.35f),
            ("MushroomYellow", 0.4f), ("Honey", 0.4f), ("Thistle", 0.4f), ("Dandelion", 0.35f),
            ("Pukeberries", 0.3f), ("Blueberries", 0.35f), ("Raspberry", 0.35f), ("Mushroom", 0.35f),
            ("Resin", 0.3f), ("GreydwarfEye", 0.3f),
        };

        /// <summary>Takes the best remedy the village's chests hold and gives its name, or null when there is none.</summary>
        private static string TakeRemedy(VillageHearth hearth, out float share)
        {
            share = TendShare;
            foreach ((string item, float gives) in Remedies)
            {
                string shared = Village.Materials.SharedName(item);
                if (shared == null)
                {
                    continue;
                }

                foreach (Container chest in Healing.Chests(hearth))
                {
                    Inventory inventory = chest != null ? chest.GetInventory() : null;
                    if (inventory != null && inventory.CountItems(shared) > 0)
                    {
                        inventory.RemoveItem(shared, 1);
                        share = gives;
                        return item;
                    }
                }
            }

            return null;
        }

        private static bool Begin(Villager villager, State state)
        {
            if (Roles.TradeOf(villager) != Roles.Trade.Healer || Time.time < state.NextLook)
            {
                return false;
            }

            state.NextLook = Time.time + Random.Range(4f, 8f);
            Villager patient = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => v != villager && v.VillageId == villager.VillageId && !Wanderers.IsWanderer(v) && NeedsCare(v) &&
                            (!TendedAt.TryGetValue(v.GetZDOID(), out float at) || Time.time - at > Again) &&
                            Vector3.Distance(v.transform.position, villager.transform.position) < 60f)
                .OrderBy(v => v.GetHealth() / Mathf.Max(1f, v.GetMaxHealth()))
                .FirstOrDefault();
            if (patient == null)
            {
                return false;
            }

            state.Patient = patient;
            state.KneelSince = 0f;
            state.GiveUpAt = Time.time + 45f;
            Walker.For(villager).Reset();
            Log($"{villager.VillagerName} goes to tend {patient.VillagerName} " +
                $"({patient.GetHealth() / Mathf.Max(1f, patient.GetMaxHealth()) * 100f:0}% health).");
            return true;
        }
    }
}
