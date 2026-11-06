namespace Villheim
{
    /// <summary>
    /// Monster AI for villagers. Its settings are applied by the logic assembly (so they can be tuned live);
    /// the core only hands each AI update to the logic (for chores) and makes villagers forgive a player once
    /// things calm down.
    /// </summary>
    public class VillagerAI : MonsterAI
    {
        public override bool UpdateAI(float dt)
        {
            if (m_nview != null && m_nview.IsValid() && m_nview.IsOwner() && !IsAlerted() &&
                LogicHost.Get(logic => logic.VillagerUpdateAI(this, dt), false))
            {
                return true;
            }

            return base.UpdateAI(dt);
        }

        public override void SetAlerted(bool alert)
        {
            base.SetAlerted(alert);
            if (!alert && IsAggravated())
            {
                SetAggravated(false, AggravatedReason.Damage);
            }
        }
    }
}
