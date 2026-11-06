namespace Villheim
{
    /// <summary>
    /// Monster AI for villagers. Its settings are applied by the logic assembly (so they can be tuned live);
    /// the only fixed rule here is that villagers forgive a player once things calm down.
    /// </summary>
    public class VillagerAI : MonsterAI
    {
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
