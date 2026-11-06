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
    /// - A villager who hasn't moved for a second looks for a closed door between him and the goal. He walks up to
    ///   it, opens it, steps through and closes it behind him.
    /// - A player standing right in the way is waited for, not pushed. After a few seconds he steps around them.
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
        private const float DoorAfter = 1f;
        private const float DoorSearch = 4f;
        private const float DoorStandOff = 1f;
        private const float DoorPassDistance = 1.6f;
        private const float DoorApproachSeconds = 5f;
        private const float DoorPassSeconds = 3f;
        private const float CloseDoorBeyond = 2.2f;
        private const float PersonalSpace = 1.1f;
        private const float WaitForPlayer = 3f;

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

        private Door _door;
        private bool _doorPassing;
        private Vector3 _doorNear;
        private Vector3 _doorFar;
        private float _doorUntil;
        private bool _doorTried;
        private Door _closeBehind;
        private float _closeBy;
        private float _nextClosePush;
        private float _waitingSince = -1f;

        public static Walker For(Villager villager) => Walkers.GetOrCreateValue(villager);

        public bool IsArrived => _arrived;

        public void Reset()
        {
            _hasGoal = false;
            _arrived = false;
            _sidesteps = 0;
            _sidestepUntil = 0f;
            _door = null;
            _doorTried = false;
            _waitingSince = -1f;
        }

        public WalkResult Go(Villager villager, VillagerAI ai, float dt, Vector3 point, float stop)
        {
            Vector3 position = villager.transform.position;
            CloseDoorBehind(position);
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
                _door = null;
                _doorTried = false;
            }

            float distance = Utils.DistanceXZ(position, _goal);
            _arrived = _arrived ? distance <= stop + LeaveSlack : distance <= stop;
            if (_arrived)
            {
                ai.StopMoving();
                return WalkResult.Arrived;
            }

            if (_door != null)
            {
                return GoThroughDoor(villager, ai, dt);
            }

            if (Time.time < _sidestepUntil)
            {
                ai.MoveTowards(_sidestep, false);
                return WalkResult.Walking;
            }

            Player blocking = PlayerInTheWay(villager, _goal);
            if (blocking != null)
            {
                // Wait for them rather than push. If they stay put, step around them.
                if (_waitingSince < 0f)
                {
                    _waitingSince = Time.time;
                }

                _lastPosition = position;
                _lastMoved = Time.time;
                if (Time.time - _waitingSince < WaitForPlayer)
                {
                    ai.StopMoving();
                    return WalkResult.Walking;
                }

                _waitingSince = -1f;
                Vector3 right = Vector3.Cross(Vector3.up, Flat(_goal - position));
                Vector3 away = Vector3.Dot(right, blocking.transform.position - position) > 0f ? -right : right;
                if (SafeStep(position, away))
                {
                    _sidestep = away;
                    _sidestepUntil = Time.time + SidestepSeconds * 2f;
                    ai.MoveTowards(_sidestep, false);
                    return WalkResult.Walking;
                }
            }
            else
            {
                _waitingSince = -1f;
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
            if (still > DoorAfter && !_doorTried)
            {
                _doorTried = true;
                if (FindDoor(position, _goal))
                {
                    VillheimPlugin.Debug($"{villager.VillagerName} goes through a door.");
                    return WalkResult.Walking;
                }
            }

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

        /// <summary>
        /// Looks for a door, close by, with the villager on one side and the goal on the other. Open doors count
        /// too: the path may not know yet that they are open.
        /// </summary>
        private bool FindDoor(Vector3 position, Vector3 goal)
        {
            Door best = null;
            float bestDistance = float.MaxValue;
            foreach (Collider collider in Physics.OverlapSphere(position, DoorSearch))
            {
                Door door = collider.GetComponentInParent<Door>();
                if (door == null || door == best || door.m_keyItem != null || door.m_nview == null || !door.m_nview.IsValid())
                {
                    continue;
                }

                Vector3 normal = Flat(door.transform.forward);
                float mySide = Vector3.Dot(position - door.transform.position, normal);
                float goalSide = Vector3.Dot(goal - door.transform.position, normal);
                if (Mathf.Sign(mySide) == Mathf.Sign(goalSide))
                {
                    continue;
                }

                float distance = Utils.DistanceXZ(position, door.transform.position);
                if (distance < bestDistance)
                {
                    best = door;
                    bestDistance = distance;
                }
            }

            if (best == null)
            {
                return false;
            }

            Vector3 doorNormal = Flat(best.transform.forward);
            Vector3 center = DoorCenter(best);
            float side = Mathf.Sign(Vector3.Dot(position - center, doorNormal));
            _door = best;
            _doorPassing = false;
            _doorNear = center + doorNormal * side * DoorStandOff;
            _doorFar = center - doorNormal * side * DoorPassDistance;
            _doorUntil = Time.time + DoorApproachSeconds;
            return true;
        }

        /// <summary>Walks up to the door, opens it, steps through, and leaves it to be closed behind him.</summary>
        private WalkResult GoThroughDoor(Villager villager, VillagerAI ai, float dt)
        {
            Vector3 position = villager.transform.position;
            if (_door == null || !_door.m_nview || !_door.m_nview.IsValid())
            {
                _door = null;
                return WalkResult.Walking;
            }

            if (!_doorPassing)
            {
                bool there = Utils.DistanceXZ(position, _doorNear) < 0.7f;
                if (!there && Time.time < _doorUntil)
                {
                    if (ai.MoveTo(dt, _doorNear, 0.4f, false) && Utils.DistanceXZ(position, _doorNear) > 1.2f)
                    {
                        // No path to the door: head straight for it.
                        ai.MoveTowards(Flat(_doorNear - position), false);
                    }

                    return WalkResult.Walking;
                }

                if (DoorState(_door) == 0)
                {
                    _door.Open(Flat(position - _door.transform.position));
                }

                _doorPassing = true;
                _doorUntil = Time.time + DoorPassSeconds;
            }

            Vector3 toFar = Flat(_doorFar - position);
            bool through = Utils.DistanceXZ(position, _doorFar) < 0.6f ||
                           Vector3.Dot(position - _door.transform.position, Flat(_doorFar - _door.transform.position)) > 1f;
            if (!through && Time.time < _doorUntil)
            {
                ai.MoveTowards(toFar, false);
                return WalkResult.Walking;
            }

            // Through (or as far as he gets). Close it once he is clear of it, and find the way from here.
            _closeBehind = _door;
            _closeBy = Time.time + 6f;
            _door = null;
            _doorTried = false;
            _lastPosition = position;
            _lastMoved = Time.time;
            _hopped = false;
            ai.m_lastFindPathTime = -1000f;
            return WalkResult.Walking;
        }

        private void CloseDoorBehind(Vector3 position)
        {
            if (_closeBehind == null)
            {
                return;
            }

            if (!_closeBehind.m_nview || !_closeBehind.m_nview.IsValid())
            {
                _closeBehind = null;
                return;
            }

            if (Utils.DistanceXZ(position, _closeBehind.transform.position) < CloseDoorBeyond && Time.time < _closeBy)
            {
                return;
            }

            // A door still swinging ignores a push, so try again once a second for a few seconds.
            if (DoorState(_closeBehind) == 0 || Time.time > _closeBy + 4f)
            {
                _closeBehind = null;
            }
            else if (Time.time >= _nextClosePush)
            {
                _nextClosePush = Time.time + 1f;
                _closeBehind.Open(Flat(position - _closeBehind.transform.position));
            }
        }

        /// <summary>
        /// The middle of the doorway at floor height. A door's own position can be at the hinge, so a closed door
        /// uses the middle of its colliders instead.
        /// </summary>
        private static Vector3 DoorCenter(Door door)
        {
            Vector3 root = door.transform.position;
            if (DoorState(door) != 0)
            {
                return root;
            }

            Bounds? total = null;
            foreach (Collider collider in door.GetComponentsInChildren<Collider>())
            {
                if (collider == null || collider.isTrigger || !collider.enabled)
                {
                    continue;
                }

                if (total.HasValue)
                {
                    Bounds grown = total.Value;
                    grown.Encapsulate(collider.bounds);
                    total = grown;
                }
                else
                {
                    total = collider.bounds;
                }
            }

            return total.HasValue ? new Vector3(total.Value.center.x, root.y, total.Value.center.z) : root;
        }

        private static int DoorState(Door door)
        {
            return door.m_nview.GetZDO().GetInt(ZDOVars.s_state);
        }

        /// <summary>A player standing within arm's length, roughly where the villager is heading, or null.</summary>
        private static Player PlayerInTheWay(Villager villager, Vector3 goal)
        {
            Vector3 position = villager.transform.position;
            Vector3 heading = Flat(goal - position);
            foreach (Player player in Player.GetAllPlayers())
            {
                Vector3 toPlayer = player.transform.position - position;
                toPlayer.y = 0f;
                if (toPlayer.magnitude < PersonalSpace && Vector3.Dot(toPlayer.normalized, heading) > 0.3f &&
                    Utils.DistanceXZ(player.transform.position, goal) > 0.3f)
                {
                    return player;
                }
            }

            return null;
        }

        private static Vector3 Flat(Vector3 vector)
        {
            vector.y = 0f;
            return vector.sqrMagnitude > 0.0001f ? vector.normalized : Vector3.forward;
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
