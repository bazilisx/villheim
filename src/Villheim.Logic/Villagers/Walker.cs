using System.Runtime.CompilerServices;
using UnityEngine;

namespace Villheim.Logic.Villagers
{
    internal enum WalkResult
    {
        Walking,
        Arrived,
        Stuck,
    }

    /// <summary>
    /// How villagers get from A to B. The game's pathfinding does the routing; this adds the parts that keep a
    /// villager from twitching or standing stuck:
    ///
    /// - A goal only counts as new when it moves more than a metre, so a wobbling target doesn't restart the walk.
    /// - Arriving uses two distances. A villager arrives at the stop distance and only sets off again once the goal is
    ///   well past it, so he doesn't flip between walking and standing at the edge.
    /// - A villager who hasn't moved half a metre in 3 seconds jumps and plans a new path. After 5 seconds he steps to
    ///   one side (never off a ledge or into water). After a few tries he reports that he is stuck.
    /// </summary>
    internal sealed class Walker
    {
        private const float NewGoalDistance = 1f;
        private const float LeaveSlack = 0.6f;
        private const float RunAbove = 10f;
        private const float MovedEnough = 0.5f;
        private const float HopAfter = 3f;
        private const float SidestepAfter = 5f;
        private const float SidestepSeconds = 0.6f;
        private const int MaxSidesteps = 3;

        private static readonly ConditionalWeakTable<Villager, Walker> Walkers = new ConditionalWeakTable<Villager, Walker>();

        private Vector3 _goal;
        private bool _hasGoal;
        private bool _arrived;
        private Vector3 _lastPosition;
        private float _lastMoved;
        private bool _hopped;
        private int _sidesteps;
        private float _sidestepUntil;
        private Vector3 _sidestep;
        private int _side = 1;

        public static Walker For(Villager villager) => Walkers.GetOrCreateValue(villager);

        public bool IsArrived => _arrived;

        public void Reset()
        {
            _hasGoal = false;
            _arrived = false;
            _sidesteps = 0;
            _sidestepUntil = 0f;
        }

        public WalkResult Go(Villager villager, VillagerAI ai, float dt, Vector3 point, float stop)
        {
            Vector3 position = villager.transform.position;
            if (!_hasGoal || Utils.DistanceXZ(point, _goal) > NewGoalDistance)
            {
                _goal = point;
                _hasGoal = true;
                _arrived = false;
                _hopped = false;
                _sidesteps = 0;
                _sidestepUntil = 0f;
                _lastPosition = position;
                _lastMoved = Time.time;
            }

            float distance = Utils.DistanceXZ(position, _goal);
            _arrived = _arrived ? distance <= stop + LeaveSlack : distance <= stop;
            if (_arrived)
            {
                ai.StopMoving();
                return WalkResult.Arrived;
            }

            if (Time.time < _sidestepUntil)
            {
                ai.MoveTowards(_sidestep, false);
                return WalkResult.Walking;
            }

            bool run = distance > RunAbove;
            if (ai.MoveTo(dt, _goal, stop, run) && distance <= stop + 1.5f)
            {
                // The path ends close enough to the goal (a tree trunk or wall is in the way of the last step).
                _arrived = true;
                return WalkResult.Arrived;
            }

            if (Utils.DistanceXZ(position, _lastPosition) > MovedEnough)
            {
                _lastPosition = position;
                _lastMoved = Time.time;
                _hopped = false;
                return WalkResult.Walking;
            }

            float still = Time.time - _lastMoved;
            if (still > HopAfter && !_hopped)
            {
                _hopped = true;
                villager.Jump();
                ai.m_lastFindPathTime = -1000f;
            }
            else if (still > SidestepAfter)
            {
                if (_sidesteps >= MaxSidesteps)
                {
                    return WalkResult.Stuck;
                }

                _sidesteps++;
                _lastMoved = Time.time;
                _hopped = false;
                ai.m_lastFindPathTime = -1000f;

                Vector3 toGoal = _goal - position;
                toGoal.y = 0f;
                Vector3 right = Vector3.Cross(Vector3.up, toGoal.sqrMagnitude > 0.01f ? toGoal.normalized : villager.transform.forward);
                int side = SafeStep(position, right * _side) ? _side : SafeStep(position, -right * _side) ? -_side : 0;
                _side = -_side;
                if (side != 0)
                {
                    _sidestep = right * side;
                    _sidestepUntil = Time.time + SidestepSeconds;
                    ai.MoveTowards(_sidestep, false);
                }
            }

            return WalkResult.Walking;
        }

        /// <summary>A step this way stays on dry ground without a big drop.</summary>
        private static bool SafeStep(Vector3 from, Vector3 direction)
        {
            Vector3 to = from + direction.normalized * 1.2f;
            if (!ZoneSystem.instance.GetGroundHeight(to, out float height))
            {
                return false;
            }

            return height > ZoneSystem.instance.m_waterLevel - 0.3f && Mathf.Abs(height - from.y) < 1.2f;
        }
    }
}
