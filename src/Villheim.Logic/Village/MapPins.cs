using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Villages on the map. When a player comes within 70 m of a village's hearth, his map gets a pin there with the
    /// village's name: the campfire icon for a camp, the house icon once it has grown into a hamlet or more. The pin
    /// follows the village as it grows. Only pins the village made itself are ever changed; a player's own pins nearby
    /// are left alone. Each player's map is his own, so each discovers villages for himself.
    /// </summary>
    internal static class MapPins
    {
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
                Minimap.instance.RemovePin(ours);
            }

            AddPin(position, type, name);
        }

        private static System.Reflection.MethodInfo _addPin;

        /// <summary>
        /// Minimap.AddPin, called by reflection: its last parameter's type lives in a platform assembly the build
        /// doesn't reference, so its default is passed as is.
        /// </summary>
        private static void AddPin(Vector3 position, Minimap.PinType type, string name)
        {
            _addPin = _addPin ?? HarmonyLib.AccessTools.Method(typeof(Minimap), "AddPin");
            if (_addPin == null)
            {
                return;
            }

            System.Reflection.ParameterInfo[] parameters = _addPin.GetParameters();
            var args = new object[parameters.Length];
            object[] given = { position, type, name, true, false };
            for (int i = 0; i < parameters.Length; i++)
            {
                args[i] = i < given.Length ? given[i] : (parameters[i].HasDefaultValue ? parameters[i].DefaultValue : null);
                if (args[i] == null && parameters[i].ParameterType.IsValueType)
                {
                    args[i] = System.Activator.CreateInstance(parameters[i].ParameterType);
                }
            }

            _addPin.Invoke(Minimap.instance, args);
        }
    }
}
