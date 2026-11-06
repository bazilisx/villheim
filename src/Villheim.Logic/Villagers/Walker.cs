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
    /// - A goal only counts as new when it moves more than a metre, so a wobbling target doesn't restart the walk, and
    ///   the game's own path cache is left to work. A fresh path is asked for only after a hop, sidestep or door.
    /// - Arriving uses two distances. A villager arrives at the stop distance (never under 0.8 m) and only sets off
    ///   again once the goal is half a metre past it, so he doesn't flip between walking and standing at the edge.
    ///   A path that ends early counts as arriving only within 2 m of the stop distance.
    /// - Villagers walk, at the player's own walking pace, to and from what they do. They only run when it matters (a
    ///   carer getting indoors in a fight, a hunter after game): callers ask for it.
    /// - A villager who hasn't moved for a second looks for a closed door between him and the goal. He walks up to
    ///   it, opens it, steps through and closes it behind him.
    /// - A villager who hasn't moved half a metre in 3 seconds jumps and plans a new path. After 5 seconds he steps to
    ///   one side for half a second (never off a ledge or into water). After two tries he reports that he is stuck.
    ///   Within 3 m of the goal nothing counts as stuck: jostling at the goal is normal.
    /// </summary>
    internal sealed class Walker
    {
        private const float NewGoalDistance = 1f;
        private const float MinStop = 0.8f;
        private const float LeaveSlack = 0.5f;
        private const float PathEndSlack = 2f;
        private const float MovedEnough = 0.5f;
        private const float NotStuckNearGoal = 3f;
        private const float HopAfter = 3f;
        private const float SidestepAfter = 5f;
        private const float SidestepSeconds = 0.5f;
        private const int MaxSidesteps = 2;
        private const float DoorAfter = 1f;
        private const float DoorSearch = 4f;
        private const float DoorStandOff = 1.2f;
        private const float DoorPassDistance = 1.5f;
        private const float DoorApproachSeconds = 6f;
        private const float DoorPassSeconds = 3f;
        private const float CloseDoorBeyond = 2f;

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
        }

        public WalkResult Go(Villager villager, VillagerAI ai, float dt, Vector3 point, float stop, bool run = false)
        {
            Vector3 position = villager.transform.position;
            villager.SetWalk(!run);
            CloseDoorBehind(position);
            stop = Mathf.Max(stop, MinStop);
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

            if (ai.MoveTo(dt, _goal, stop, run) && distance <= stop + PathEndSlack && !WallBetween(position, _goal))
            {
                // The path ends close enough to the goal (a tree trunk or wall is in the way of the last step).
                _arrived = true;
                ai.StopMoving();
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

            if (distance < NotStuckNearGoal && !WallBetween(position, _goal))
            {
                // Jostling near the goal is normal: no hops or sidesteps for it.
                return WalkResult.Walking;
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

                Vector3 right = Vector3.Cross(Vector3.up, Flat(_goal - position));
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

        /// <summary>A building piece stands between the two points at knee height.</summary>
        private static bool WallBetween(Vector3 from, Vector3 to)
        {
            if (PieceMask == 0)
            {
                PieceMask = LayerMask.GetMask("piece", "piece_nonsolid");
            }

            Vector3 a = from + Vector3.up * 0.4f;
            Vector3 b = to + Vector3.up * 0.4f;
            return Physics.Linecast(a, b, out RaycastHit hit, PieceMask, QueryTriggerInteraction.Ignore) &&
                   Vector3.Distance(hit.point, b) > 0.5f;
        }

        private static int PieceMask;

        /// <summary>Closes a door he came through, once he is clear of it. Called every tick, walking or not.</summary>
        public void Tick(Villager villager)
        {
            CloseDoorBehind(villager.transform.position);
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

            // Never close it on someone standing in the doorway.
            if (SomeoneInDoorway(_closeBehind) && Time.time < _closeBy + 4f)
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

        private static bool SomeoneInDoorway(Door door)
        {
            Vector3 center = DoorCenter(door);
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character != null && Utils.DistanceXZ(character.transform.position, center) < 1f &&
                    Mathf.Abs(character.transform.position.y - center.y) < 2f)
                {
                    return true;
                }
            }

            return false;
        }

        private static int DoorState(Door door)
        {
            return door.m_nview.GetZDO().GetInt(ZDOVars.s_state);
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
