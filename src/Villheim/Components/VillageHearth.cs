using System.Collections.Generic;
using UnityEngine;

namespace Villheim
{
    /// <summary>
    /// Sits on the village hearth. It keeps a registry of loaded villages and calls into the logic
    /// assembly every few seconds; all village rules live there so they can be hot reloaded.
    /// </summary>
    public class VillageHearth : MonoBehaviour
    {
        private const float TickInterval = 5f;

        private static readonly Dictionary<int, VillageHearth> Loaded = new Dictionary<int, VillageHearth>();

        private int _registeredId;

        public ZNetView NView { get; private set; }

        /// <summary>True while the logic is building something for this village.</summary>
        public bool Busy { get; set; }

        /// <summary>Failed attempts to find room for the next building. Runtime only.</summary>
        public int PlotAttempts { get; set; }

        public bool IsValid => NView != null && NView.IsValid();
        public ZDO Zdo => IsValid ? NView.GetZDO() : null;
        public int VillageId => IsValid ? NView.GetZDO().GetInt(Keys.VillageId) : 0;
        public string VillageName => IsValid ? NView.GetZDO().GetString(Keys.Name, "Village") : "Village";

        public static IEnumerable<VillageHearth> All
        {
            get
            {
                foreach (VillageHearth hearth in Loaded.Values)
                {
                    if (hearth)
                    {
                        yield return hearth;
                    }
                }
            }
        }

        public static VillageHearth Find(int villageId)
        {
            return villageId != 0 && Loaded.TryGetValue(villageId, out VillageHearth hearth) && hearth ? hearth : null;
        }

        public static VillageHearth Closest(Vector3 point, float maxDistance)
        {
            VillageHearth best = null;
            float bestDistance = maxDistance;
            foreach (VillageHearth hearth in All)
            {
                float distance = Vector3.Distance(point, hearth.transform.position);
                if (distance < bestDistance)
                {
                    best = hearth;
                    bestDistance = distance;
                }
            }

            return best;
        }

        private void Awake()
        {
            NView = GetComponent<ZNetView>();
            if (NView == null)
            {
                enabled = false;
                return;
            }

            InvokeRepeating(nameof(Tick), Random.Range(3f, 6f), TickInterval);
        }

        private void OnDestroy()
        {
            Unregister();
        }

        private void Tick()
        {
            if (!IsValid)
            {
                return;
            }

            Register();
            LogicHost.Call(logic => logic.HearthTick(this));
        }

        /// <summary>Adds this hearth to the registry once its village has an id. Safe to call often.</summary>
        public void Register()
        {
            int id = VillageId;
            if (id != 0 && id != _registeredId)
            {
                Unregister();
                _registeredId = id;
                Loaded[id] = this;
            }
        }

        private void Unregister()
        {
            if (_registeredId != 0 && Loaded.TryGetValue(_registeredId, out VillageHearth hearth) && hearth == this)
            {
                Loaded.Remove(_registeredId);
            }

            _registeredId = 0;
        }
    }
}
