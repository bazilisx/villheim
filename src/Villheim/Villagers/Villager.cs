using UnityEngine;
using Villheim.Village;

namespace Villheim.Villagers
{
    /// <summary>
    /// A villager: the vanilla humanoid with a name, a home village and a simple day/night routine.
    /// </summary>
    public class Villager : Humanoid, Interactable
    {
        public static readonly int KeyVillageId = "villheim_village".GetStableHashCode();
        public static readonly int KeyVillageName = "villheim_village_name".GetStableHashCode();
        public static readonly int KeyName = "villheim_name".GetStableHashCode();
        public static readonly int KeySeed = "villheim_seed".GetStableHashCode();
        public static readonly int KeyHome = "villheim_home".GetStableHashCode();
        public static readonly int KeyHearth = "villheim_hearth".GetStableHashCode();

        private const float ScheduleInterval = 15f;
        private const float NightRadius = 6f;

        private bool _looksApplied;
        private float _scheduleTimer;

        public int VillageId => m_nview != null && m_nview.IsValid() ? m_nview.GetZDO().GetInt(KeyVillageId) : 0;

        public string VillagerName => m_nview != null && m_nview.IsValid()
            ? m_nview.GetZDO().GetString(KeyName, "Villager")
            : "Villager";

        public string VillageName => m_nview != null && m_nview.IsValid()
            ? m_nview.GetZDO().GetString(KeyVillageName, "")
            : "";

        /// <summary>
        /// Called by the hearth right after spawning, while this client owns the new villager.
        /// </summary>
        public void Setup(int villageId, string villageName, Vector3 hearth, Vector3 home, int seed, string name)
        {
            ZDO zdo = m_nview.GetZDO();
            zdo.Set(KeyVillageId, villageId);
            zdo.Set(KeyVillageName, villageName);
            zdo.Set(KeyHearth, hearth);
            zdo.Set(KeyHome, home);
            zdo.Set(KeySeed, seed);
            zdo.Set(KeyName, name);
            m_name = name;
            _looksApplied = false;
        }

        public override void Start()
        {
            base.Start();
            if (m_nview != null && m_nview.IsValid())
            {
                m_name = VillagerName;
            }
        }

        public override void CustomFixedUpdate(float fixedDeltaTime)
        {
            base.CustomFixedUpdate(fixedDeltaTime);
            if (m_nview == null || !m_nview.IsValid() || !m_nview.IsOwner())
            {
                _looksApplied = false;
                return;
            }

            // Equipment of NPC humanoids is not saved, so whoever owns the villager re-dresses it.
            // The look comes from a stored seed, so it is the same every time.
            if (!_looksApplied)
            {
                _looksApplied = true;
                VillagerLooks.Apply(this, m_nview.GetZDO().GetInt(KeySeed));
            }

            _scheduleTimer -= fixedDeltaTime;
            if (_scheduleTimer <= 0f)
            {
                _scheduleTimer = ScheduleInterval + Random.Range(0f, 5f);
                UpdateSchedule();
            }
        }

        /// <summary>
        /// By day villagers wander around their home building, at night they stay near the hearth.
        /// </summary>
        private void UpdateSchedule()
        {
            if (!(m_baseAI is MonsterAI ai) || ai.IsAlerted())
            {
                return;
            }

            ZDO zdo = m_nview.GetZDO();
            Vector3 hearth = zdo.GetVec3(KeyHearth, transform.position);
            Vector3 home = zdo.GetVec3(KeyHome, hearth);

            bool night = VillheimConfig.VillagersGatherAtNight.Value && EnvMan.IsNight();
            Vector3 target = night ? hearth + Random.insideUnitSphere.Horizontal() * NightRadius : home;
            ai.SetPatrolPoint(target);
        }

        public override string GetHoverName()
        {
            return VillagerName;
        }

        public override string GetHoverText()
        {
            string village = VillageName;
            string text = VillagerName;
            if (!string.IsNullOrEmpty(village))
            {
                text += $"\n<color=#b0b0b0>of {village}</color>";
            }

            text += "\n[<color=yellow><b>$KEY_Use</b></color>] Talk";
            return Localization.instance.Localize(text);
        }

        public bool Interact(Humanoid user, bool hold, bool alt)
        {
            if (hold || !(user is Player player) || player != Player.m_localPlayer)
            {
                return false;
            }

            VillageHearth hearth = VillageHearth.Find(VillageId);
            string line = VillagerTalk.InteractLine(hearth);
            Chat.instance?.SetNpcText(gameObject, Vector3.up * 2.2f, 20f, 6f, "", line, false);
            if (hearth != null)
            {
                player.Message(MessageHud.MessageType.TopLeft, hearth.Summary());
            }

            return true;
        }

        public bool UseItem(Humanoid user, ItemDrop.ItemData item)
        {
            return false;
        }
    }
}
