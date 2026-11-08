using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Villages and villagers on the map, drawn in a pale ghostly blue so they stand apart from the player's own pins.
    ///
    /// - Village pins: when a player comes within 70 m of a village's hearth, his map gets a pin there with the village's
    ///   name: the campfire icon for a camp, the house icon from a hamlet up, following the village as it grows. They
    ///   can't be deleted, and a village pin whose hearth is gone (a cleared village) is taken off when the player is near.
    /// - Villager dots: while the player is inside a village, each villager is a small dot with his name and, in smaller
    ///   letters below, what he is doing in a word or two. The dots move with the villagers every frame, like player
    ///   markers, go away when the player leaves (or the villagers do), and are never saved.
    ///
    /// Everything runs from the map's own update (a Harmony postfix), so it keeps working with no villagers about.
    /// Villheim's pins are known by their colour tag, so they are recognised again after a reload.
    /// </summary>
    internal static class MapPins
    {
        private const float DiscoverWithin = 70f;
        private const string Ghost = "<color=#D2E9F0>";
        private const float VillagePinScale = 0.85f;
        private const float VillagerPinScale = 0.55f;

        private static bool _removingOurOwn;
        private static readonly Dictionary<Villager, (Minimap.PinData Pin, string Label)> VillagerPins =
            new Dictionary<Villager, (Minimap.PinData, string)>();
        private static float _next;

        public static bool IsOurs(Minimap.PinData pin) => pin?.m_name != null && pin.m_name.StartsWith(Ghost);

        private static string VillageLabel(string name) => $"{Ghost}{name}</color>";

        private static string VillagerLabel(Villager villager) =>
            $"{Ghost}<size=75%>{villager.VillagerName}</size>\n<size=55%><color=#A9CCD6>{ShortTask(villager)}</color></size></color>";

        /// <summary>Every frame from the map: keep pins in place and sized; every few seconds, add and remove.</summary>
        private static void Tick(Minimap map)
        {
            Player player = Player.m_localPlayer;
            if (player == null)
            {
                return;
            }

            // Dots follow their villagers every frame, and our pins are drawn smaller.
            foreach (KeyValuePair<Villager, (Minimap.PinData Pin, string Label)> entry in VillagerPins)
            {
                if (entry.Key != null && entry.Value.Pin != null)
                {
                    entry.Value.Pin.m_pos = entry.Key.transform.position;
                }
            }

            foreach (Minimap.PinData pin in map.m_pins)
            {
                if (IsOurs(pin) && pin.m_uiElement != null)
                {
                    float scale = pin.m_save ? VillagePinScale : VillagerPinScale;
                    if (Mathf.Abs(pin.m_uiElement.localScale.x - scale) > 0.01f)
                    {
                        pin.m_uiElement.localScale = Vector3.one * scale;
                    }
                }
            }

            if (Time.time < _next)
            {
                return;
            }

            _next = Time.time + 2f;
            Vector3 me = player.transform.position;
            UpdateVillagePins(map, me);
            UpdateVillagerPins(map, me);
        }

        private static void UpdateVillagePins(Minimap map, Vector3 me)
        {
            foreach (VillageHearth hearth in VillageHearth.All)
            {
                if (hearth == null || !hearth.IsValid || Vector3.Distance(hearth.transform.position, me) > DiscoverWithin)
                {
                    continue;
                }

                var state = new VillageState(hearth.Zdo);
                if (state.Initialized && !string.IsNullOrEmpty(state.Name))
                {
                    Minimap.PinType type = VillageBrain.TierIndex(state.Plots.Count) == 0 ? Minimap.PinType.Icon0 : Minimap.PinType.Icon1;
                    // A pin from before the ghostly colour (plain name, same spot) is replaced, not doubled.
                    foreach (Minimap.PinData legacy in map.m_pins.Where(p => p.m_name == state.Name && Utils.DistanceXZ(p.m_pos, hearth.transform.position) < 6f).ToList())
                    {
                        Remove(map, legacy);
                    }

                    Ensure(map, hearth.transform.position, VillageLabel(state.Name), type);
                }
            }

            // A village pin near the player whose hearth is gone (the village was cleared): taken off.
            foreach (Minimap.PinData pin in map.m_pins.Where(p => IsOurs(p) && p.m_save).ToList())
            {
                if (Utils.DistanceXZ(pin.m_pos, me) < DiscoverWithin &&
                    !VillageHearth.All.Any(h => h != null && h.IsValid && Utils.DistanceXZ(h.transform.position, pin.m_pos) < 8f))
                {
                    Remove(map, pin);
                }
            }
        }

        private static void Ensure(Minimap map, Vector3 position, string label, Minimap.PinType type)
        {
            Minimap.PinData ours = map.m_pins.FirstOrDefault(p => IsOurs(p) && p.m_save && Utils.DistanceXZ(p.m_pos, position) < 6f);
            if (ours != null && ours.m_type == type && ours.m_name == label)
            {
                return;
            }

            if (ours != null)
            {
                Remove(map, ours);
            }

            AddPin(map, position, type, label, true);
        }

        /// <summary>Keeps villager dots while the player is in a village; clears them otherwise.</summary>
        private static void UpdateVillagerPins(Minimap map, Vector3 me)
        {
            VillageHearth home = VillageHearth.All.FirstOrDefault(h => h != null && h.IsValid &&
                                                                       Utils.DistanceXZ(h.transform.position, me) < VillheimConfig.VillageRadius.Value + 10f);
            foreach (Villager gone in VillagerPins.Keys.Where(v => v == null || v.IsDead() || home == null || v.VillageId != home.VillageId).ToList())
            {
                Remove(map, VillagerPins[gone].Pin);
                VillagerPins.Remove(gone);
            }

            // Dots left from an earlier logic build or a cleared village.
            var current = new HashSet<Minimap.PinData>(VillagerPins.Values.Select(v => v.Pin));
            foreach (Minimap.PinData stale in map.m_pins.Where(p => IsOurs(p) && !p.m_save && !current.Contains(p)).ToList())
            {
                Remove(map, stale);
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

                string label = VillagerLabel(villager);
                if (VillagerPins.TryGetValue(villager, out var existing))
                {
                    if (existing.Label == label)
                    {
                        continue;
                    }

                    Remove(map, existing.Pin);
                }

                Minimap.PinData pin = AddPin(map, villager.transform.position, Minimap.PinType.Icon3, label, false);
                if (pin != null)
                {
                    VillagerPins[villager] = (pin, label);
                }
            }
        }

        private static void Remove(Minimap map, Minimap.PinData pin)
        {
            if (pin == null)
            {
                return;
            }

            _removingOurOwn = true;
            try
            {
                map.RemovePin(pin);
            }
            finally
            {
                _removingOurOwn = false;
            }
        }

        /// <summary>What the villager is doing, in a word or two, for the map (see Villagers.Status).</summary>
        private static string ShortTask(Villager villager) =>
            Villagers.Sleep.IsAsleep(villager) ? "sleeping" : Villagers.Status.Short(villager);

        private static System.Reflection.MethodInfo _addPin;

        /// <summary>
        /// Minimap.AddPin, called by reflection: its last parameter's type lives in a platform assembly the build
        /// doesn't reference, so its default is passed as is.
        /// </summary>
        internal static Minimap.PinData AddPin(Minimap map, Vector3 position, Minimap.PinType type, string name, bool save)
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

            return _addPin.Invoke(map, args) as Minimap.PinData;
        }

        [HarmonyLib.HarmonyPatch(typeof(Minimap), nameof(Minimap.Update))]
        internal static class MapUpdatePatch
        {
            private static void Postfix(Minimap __instance)
            {
                Tick(__instance);
            }
        }

        /// <summary>The player can't delete a village's pin or a villager's dot (right-click, or the remove tool).</summary>
        [HarmonyLib.HarmonyPatch(typeof(Minimap), nameof(Minimap.RemovePin), typeof(Minimap.PinData))]
        internal static class KeepPinPatch
        {
            private static bool Prefix(Minimap.PinData pin)
            {
                return _removingOurOwn || !IsOurs(pin);
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
                if (closest != null && IsOurs(closest))
                {
                    __result = false;
                    return false;
                }

                return true;
            }
        }
    }
}
