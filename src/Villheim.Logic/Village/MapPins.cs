using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Villages on the map. When a player comes within 70 m of a village's hearth, his map gets a pin there with the
    /// village's name: the campfire icon for a camp, the house icon once it has grown into a hamlet or more. The pin
    /// follows the village as it grows. Only pins the village made itself are ever changed; a player's own pins nearby
    /// are left alone. Each player's map is his own, so each discovers villages for himself. Village pins can't be
    /// deleted from the map.
    ///
    /// While the player is inside a village, each of its villagers shows on the map as a dot with his name and what he
    /// is doing in a word or two (harvesting, building, cooking, relaxing...). They go when the player leaves, and are
    /// never saved, so the map doesn't fill with dots.
    /// </summary>
    internal static class MapPins
    {
        /// <summary>Pins this mod put on the map; they can't be removed by the player.</summary>
        private static readonly HashSet<Minimap.PinData> Protected = new HashSet<Minimap.PinData>();
        private static bool _removingOurOwn;
        private static readonly Dictionary<Villager, (Minimap.PinData Pin, string Label)> VillagerPins =
            new Dictionary<Villager, (Minimap.PinData, string)>();
        private static float _nextVillagers;
        private const float DiscoverWithin = 70f;
        private static float _next;

        public static void Update()
        {
            if (Time.time < _next || Minimap.instance == null || Player.m_localPlayer == null)
            {
                return;
            }

            _next = Time.time + 3f;
            Vector3 me = Player.m_localPlayer.transform.position;
            UpdateVillagerPins(me);
            foreach (VillageHearth hearth in VillageHearth.All)
            {
                if (hearth == null || !hearth.IsValid || Vector3.Distance(hearth.transform.position, me) > DiscoverWithin)
                {
                    continue;
                }

                var state = new VillageState(hearth.Zdo);
                if (!state.Initialized || string.IsNullOrEmpty(state.Name))
                {
                    continue;
                }

                Minimap.PinType type = VillageBrain.TierIndex(state.Plots.Count) == 0 ? Minimap.PinType.Icon0 : Minimap.PinType.Icon1;
                Ensure(hearth.transform.position, state.Name, type);
            }
        }

        private static void Ensure(Vector3 position, string name, Minimap.PinType type)
        {
            Minimap.PinData ours = null;
            foreach (Minimap.PinData pin in Minimap.instance.m_pins)
            {
                if (pin != null && pin.m_name == name && Utils.DistanceXZ(pin.m_pos, position) < 6f)
                {
                    ours = pin;
                    break;
                }
            }

            if (ours != null && ours.m_type == type)
            {
                return;
            }

            if (ours != null)
            {
                RemoveOurs(ours);
            }

            Minimap.PinData added = AddPin(position, type, name, true);
            if (added != null)
            {
                Protected.Add(added);
            }
        }

        private static void RemoveOurs(Minimap.PinData pin)
        {
            _removingOurOwn = true;
            try
            {
                Minimap.instance.RemovePin(pin);
            }
            finally
            {
                _removingOurOwn = false;
                Protected.Remove(pin);
            }
        }

        /// <summary>A village pin, known by its name standing on a hearth (survives a logic reload).</summary>
        private static bool IsVillagePin(Minimap.PinData pin)
        {
            if (pin == null)
            {
                return false;
            }

            if (Protected.Contains(pin))
            {
                return true;
            }

            foreach (VillageHearth hearth in VillageHearth.All)
            {
                if (hearth != null && hearth.IsValid && pin.m_name == hearth.VillageName && Utils.DistanceXZ(pin.m_pos, hearth.transform.position) < 6f)
                {
                    return true;
                }
            }

            return false;
        }

        // ---------------------------------------------------------------- villagers on the map

        /// <summary>Keeps villager dots on the map while the player is in a village, and moves them along.</summary>
        public static void UpdateVillagerPins(Vector3 me)
        {
            VillageHearth home = VillageHearth.All.FirstOrDefault(h => h != null && h.IsValid &&
                                                                       Utils.DistanceXZ(h.transform.position, me) < VillheimConfig.VillageRadius.Value + 10f);
            foreach (Villager gone in VillagerPins.Keys.Where(v => v == null || v.IsDead() || home == null || v.VillageId != home.VillageId).ToList())
            {
                RemoveOurs(VillagerPins[gone].Pin);
                VillagerPins.Remove(gone);
            }

            if (home == null)
            {
                return;
            }

            foreach (Villager villager in Character.GetAllCharacters().OfType<Villager>())
            {
                if (villager.IsDead() || villager.VillageId != home.VillageId)
                {
                    continue;
                }

                string label = $"{villager.VillagerName}\n{ShortTask(villager)}";
                if (VillagerPins.TryGetValue(villager, out var current))
                {
                    if (current.Label == label)
                    {
                        current.Pin.m_pos = villager.transform.position;
                        continue;
                    }

                    RemoveOurs(current.Pin);
                }

                Minimap.PinData pin = AddPin(villager.transform.position, Minimap.PinType.Icon3, label, false);
                if (pin != null)
                {
                    Protected.Add(pin);
                    VillagerPins[villager] = (pin, label);
                }
            }
        }

        /// <summary>Moves a villager's dot with him every frame (cheap: just the position).</summary>
        public static void Follow(Villager villager)
        {
            if (VillagerPins.TryGetValue(villager, out var current) && current.Pin != null)
            {
                current.Pin.m_pos = villager.transform.position;
            }
        }

        /// <summary>What the villager is doing, in a word or two, for the map.</summary>
        private static string ShortTask(Villager villager)
        {
            if (Villagers.Sleep.IsAsleep(villager)) return "sleeping";
            string a = (Villagers.VillagerBehaviour.Activity(villager) ?? "").ToLowerInvariant();
            if (a.Contains("watch")) return "on watch";
            if (a.Contains("hunt") || a.Contains("butcher") || a.Contains("meat to")) return "hunting";
            if (a.Contains("farm") || a.Contains("harvest") || a.Contains("animals")) return "farming";
            if (a.Contains("forag") || a.Contains("berries")) return "foraging";
            if (a.Contains("fell") || a.Contains("splitting") || a.Contains("rock") || a.Contains("gathering") || a.Contains("picking"))
                return "harvesting";
            if (a.Contains("carrying")) return "hauling";
            if (a.Contains("fence")) return "fencing";
            if (a.Contains("repair") || a.Contains("putting back")) return "repairing";
            if (a.Contains("taking down") || a == "building" || a.Contains("rebuilding") || a.Contains("making")) return "building";
            if (a.Contains("path")) return "laying paths";
            if (a.Contains("cook") || a.Contains("fetching") || a.Contains("roasting")) return "cooking";
            if (a.Contains("hearth")) return "tending fire";
            if (a.Contains("busy at")) return "crafting";
            if (Villagers.Roles.BackgroundOf(villager) == Villagers.Roles.Background.Protector && villager.GetComponent<VillagerAI>()?.GetTargetCreature() != null)
                return "defending";
            return "relaxing";
        }

        private static System.Reflection.MethodInfo _addPin;

        /// <summary>
        /// Minimap.AddPin, called by reflection: its last parameter's type lives in a platform assembly the build
        /// doesn't reference, so its default is passed as is.
        /// </summary>
        private static Minimap.PinData AddPin(Vector3 position, Minimap.PinType type, string name, bool save)
        {
            _addPin = _addPin ?? HarmonyLib.AccessTools.Method(typeof(Minimap), "AddPin");
            if (_addPin == null)
            {
                return null;
            }

            System.Reflection.ParameterInfo[] parameters = _addPin.GetParameters();
            var args = new object[parameters.Length];
            object[] given = { position, type, name, save, false };
            for (int i = 0; i < parameters.Length; i++)
            {
                args[i] = i < given.Length ? given[i] : (parameters[i].HasDefaultValue ? parameters[i].DefaultValue : null);
                if (args[i] == null && parameters[i].ParameterType.IsValueType)
                {
                    args[i] = System.Activator.CreateInstance(parameters[i].ParameterType);
                }
            }

            return _addPin.Invoke(Minimap.instance, args) as Minimap.PinData;
        }

        /// <summary>The player can't delete a village's pin or a villager's dot (right-click, or the remove tool).</summary>
        [HarmonyLib.HarmonyPatch(typeof(Minimap), nameof(Minimap.RemovePin), typeof(Minimap.PinData))]
        internal static class KeepPinPatch
        {
            private static bool Prefix(Minimap.PinData pin)
            {
                return _removingOurOwn || !IsVillagePin(pin);
            }
        }

        [HarmonyLib.HarmonyPatch(typeof(Minimap), nameof(Minimap.RemovePin), typeof(Vector3), typeof(float))]
        internal static class KeepPinNearPatch
        {
            private static bool Prefix(Minimap __instance, Vector3 pos, float radius, ref bool __result)
            {
                if (_removingOurOwn)
                {
                    return true;
                }

                Minimap.PinData closest = __instance.GetClosestPin(pos, radius, false);
                if (closest != null && IsVillagePin(closest))
                {
                    __result = false;
                    return false;
                }

                return true;
            }
        }
    }
}
