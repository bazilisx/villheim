using Jotunn.Entities;
using Jotunn.Managers;
using UnityEngine;

namespace Villheim.Prefabs
{
    /// <summary>
    /// The village hearth is the vanilla campfire ("fire_pit") with endless fuel and the
    /// <see cref="VillageHearth"/> brain attached. It stores the whole village state in its ZDO.
    /// </summary>
    public static class HearthPrefab
    {
        public const string Name = VillheimPlugin.Prefix + "Hearth";
        private const string BasePrefab = "fire_pit";

        public static GameObject Prefab { get; private set; }

        public static void Create()
        {
            if (Prefab != null)
            {
                return;
            }

            GameObject prefab = PrefabManager.Instance.CreateClonedPrefab(Name, BasePrefab);
            if (prefab == null)
            {
                VillheimPlugin.Log.LogError($"Could not clone '{BasePrefab}', villages are disabled.");
                return;
            }

            if (prefab.TryGetComponent(out Fireplace fireplace))
            {
                fireplace.m_infiniteFuel = true;
            }

            if (prefab.TryGetComponent(out Piece piece))
            {
                piece.m_name = "Village hearth";
                piece.m_canBeRemoved = false;
            }

            // The hearth holds the village state, so make it very hard to destroy by accident.
            if (prefab.TryGetComponent(out WearNTear wear))
            {
                wear.m_health = 100000f;
                wear.m_noRoofWear = false;
                wear.m_noSupportWear = false;
            }

            if (prefab.TryGetComponent(out ZNetView nview))
            {
                nview.m_persistent = true;
            }

            prefab.AddComponent<VillageHearth>();

            PrefabManager.Instance.AddPrefab(new CustomPrefab(prefab, false));
            Prefab = prefab;
        }
    }
}
