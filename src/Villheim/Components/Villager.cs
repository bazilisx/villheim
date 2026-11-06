namespace Villheim
{
    /// <summary>
    /// A villager: the vanilla humanoid on the player model. Behaviour (looks, routine, dialogue)
    /// comes from the logic assembly.
    /// </summary>
    public class Villager : Humanoid, Interactable
    {
        /// <summary>Whether this client has dressed the villager since it last became the owner.</summary>
        public bool LooksApplied { get; set; }

        /// <summary>Countdown used by the logic for the day/night routine.</summary>
        public float ScheduleTimer { get; set; }

        public ZNetView NView => m_nview;
        public bool IsValidVillager => m_nview != null && m_nview.IsValid();
        public ZDO Zdo => IsValidVillager ? m_nview.GetZDO() : null;
        public int VillageId => IsValidVillager ? m_nview.GetZDO().GetInt(Keys.VillagerVillage) : 0;
        public string VillagerName => IsValidVillager ? m_nview.GetZDO().GetString(Keys.VillagerName, "Villager") : "Villager";
        public string VillageName => IsValidVillager ? m_nview.GetZDO().GetString(Keys.VillagerVillageName, "") : "";

        public override void Start()
        {
            base.Start();
            if (IsValidVillager)
            {
                m_name = VillagerName;
            }
        }

        public override void CustomFixedUpdate(float fixedDeltaTime)
        {
            base.CustomFixedUpdate(fixedDeltaTime);
            if (!IsValidVillager || !m_nview.IsOwner())
            {
                // Equipment of NPC humanoids is not saved, so a new owner has to dress the villager again.
                LooksApplied = false;
                return;
            }

            LogicHost.Call(logic => logic.VillagerUpdate(this, fixedDeltaTime));
        }

        public override string GetHoverName()
        {
            return VillagerName;
        }

        public override string GetHoverText()
        {
            return LogicHost.Get(logic => logic.VillagerHoverText(this), VillagerName);
        }

        public bool Interact(Humanoid user, bool hold, bool alt)
        {
            return !hold && LogicHost.Get(logic => logic.VillagerInteract(this, user), false);
        }

        public bool UseItem(Humanoid user, ItemDrop.ItemData item)
        {
            return false;
        }
    }
}
