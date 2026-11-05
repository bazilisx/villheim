namespace Villheim.Villagers
{
    /// <summary>
    /// Monster AI tuned to behave like a peaceful villager: wanders near its patrol point, never hunts players,
    /// fights monsters, and calms down after being provoked.
    /// </summary>
    public class VillagerAI : MonsterAI
    {
        public static void Configure(VillagerAI ai)
        {
            ai.m_viewRange = 20f;
            ai.m_viewAngle = 90f;
            ai.m_hearRange = 15f;
            ai.m_mistVision = false;
            ai.m_pathAgentType = Pathfinding.AgentType.Humanoid;
            ai.m_moveMinAngle = 90f;
            ai.m_smoothMovement = true;
            ai.m_serpentMovement = false;
            ai.m_jumpInterval = 0f;
            ai.m_randomCircleInterval = 3f;
            ai.m_randomMoveInterval = 12f;
            ai.m_randomMoveRange = 10f;
            ai.m_randomFly = false;

            ai.m_avoidFire = true;
            ai.m_afraidOfFire = false;
            ai.m_avoidWater = true;
            ai.m_avoidLava = true;
            ai.m_skipLavaTargets = true;
            ai.m_avoidLavaFlee = true;

            // Neutral until a player hits them, like the Dvergr.
            ai.m_aggravatable = true;
            ai.m_passiveAggresive = false;
            ai.m_spawnMessage = "";
            ai.m_deathMessage = "";
            ai.m_alertedMessage = "";

            ai.m_fleeRange = 25f;
            ai.m_fleeAngle = 45f;
            ai.m_fleeInterval = 10f;

            ai.m_alertRange = 15f;
            ai.m_fleeIfHurtWhenTargetCantBeReached = true;
            ai.m_fleeUnreachableSinceAttacking = 30f;
            ai.m_fleeUnreachableSinceHurt = 20f;
            ai.m_fleeIfNotAlerted = false;
            ai.m_fleeIfLowHealth = 0.25f;
            ai.m_fleeTimeSinceHurt = 10f;
            ai.m_fleeInLava = true;
            ai.m_circulateWhileCharging = true;
            ai.m_enableHuntPlayer = false;
            ai.m_attackPlayerObjects = false;
            ai.m_privateAreaTriggerTreshold = 50;
            ai.m_interceptTimeMax = 2f;
            ai.m_interceptTimeMin = 0f;
            ai.m_maxChaseDistance = 20f;
            ai.m_minAttackInterval = 0f;
            ai.m_circleTargetInterval = 5f;
            ai.m_circleTargetDuration = 2f;
            ai.m_circleTargetDistance = 2f;
        }

        public override void SetAlerted(bool alert)
        {
            base.SetAlerted(alert);
            if (!alert && IsAggravated())
            {
                // Forgive the player once things calm down.
                SetAggravated(false, AggravatedReason.Damage);
            }
        }
    }
}
