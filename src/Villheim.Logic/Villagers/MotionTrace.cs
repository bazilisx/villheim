using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using HarmonyLib;
using UnityEngine;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// 'vh trace [seconds]': records the nearest villager's body, steering and animation every physics step (50 a
    /// second) to BepInEx/Villheim/trace-*.csv, to find the cause of jitter and hops from data instead of video.
    ///
    /// Each row: time, position, body velocity, facing, look direction, move direction, walk/run, ground contact, the
    /// animator's speeds and state, whether the game counts it as attacking, what the villager is doing, and how many
    /// times this step something steered him (MoveTowards, StopMoving, SetLookDir, LookAt). Animator triggers and
    /// bools, jumps and sudden position jumps are written as events in between. A short summary goes to the console.
    /// </summary>
    internal static class MotionTrace
    {
        private static Villager _villager;
        private static float _until;
        private static StringBuilder _rows;
        private static string _path;
        private static Vector3 _lastPosition;
        private static float _lastYaw;
        private static bool _hasLast;
        private static int _moveTowards, _stopMoving, _setLookDir, _lookAt, _moveTo;
        private static readonly List<string> Events = new List<string>();

        // Summary counters.
        private static int _samples, _airborne, _snaps, _yawFlips, _speedFlips, _triggers, _lookJumps, _bobs;
        private static float _lastLookYaw;
        private static float _maxUp;
        private static float _lastSpeedSign;
        private static readonly Dictionary<string, int> TriggerCounts = new Dictionary<string, int>();
        private static string _lastActivity;
        private static int _activityChanges;

        public static bool Active => _villager != null;

        public static string Start(Player player, float seconds)
        {
            Villager nearest = null;
            float best = 30f;
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character is Villager villager && !villager.IsDead())
                {
                    float d = Vector3.Distance(villager.transform.position, player.transform.position);
                    if (d < best)
                    {
                        best = d;
                        nearest = villager;
                    }
                }
            }

            if (nearest == null)
            {
                return "Villheim: no villager within 30 m to trace.";
            }

            string folder = Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim");
            Directory.CreateDirectory(folder);
            _path = Path.Combine(folder, $"trace-{System.DateTime.Now:yyyyMMdd-HHmmss}.csv");
            _rows = new StringBuilder();
            _rows.AppendLine("t,frame,x,y,z,vx,vy,vz,speed,yaw,lookYaw,moveX,moveZ,moveMag,run,walk,ground,fwdSpeed,sideSpeed,state,transition,attack,owner," +
                             "moveTo,moveTowards,stop,setLook,lookAt,alerted,activity,event");
            Events.Clear();
            TriggerCounts.Clear();
            _samples = _airborne = _snaps = _yawFlips = _speedFlips = _triggers = _activityChanges = _lookJumps = _bobs = 0;
            _maxUp = 0f;
            _lastSpeedSign = 0f;
            _lastActivity = null;
            _hasLast = false;
            _villager = nearest;
            _until = Time.time + Mathf.Clamp(seconds, 2f, 120f);

            Rigidbody body = nearest.m_body;
            string bodyInfo = body != null
                ? $"interpolation {body.interpolation}, kinematic {body.isKinematic}, mass {body.mass:0.#}, drag {body.drag:0.##}"
                : "no rigidbody";
            Events.Add($"start: {nearest.VillagerName}; {bodyInfo}; turn {nearest.m_turnSpeed:0}/{nearest.m_runTurnSpeed:0}; " +
                       $"accel {nearest.m_acceleration:0.##}; moveMinAngle {(nearest.m_baseAI != null ? nearest.m_baseAI.m_moveMinAngle : 0f):0}; " +
                       $"groundTilt {nearest.m_groundTilt}");
            return $"Villheim: tracing {nearest.VillagerName} for {seconds:0} s. Stay near and watch; the file goes to {_path}.";
        }

        private static void Sample(Villager villager)
        {
            if (_rows == null)
            {
                return;
            }

            if (Time.time > _until || villager.IsDead())
            {
                Finish();
                return;
            }

            CultureInfo c = CultureInfo.InvariantCulture;
            Vector3 p = villager.transform.position;
            Vector3 v = villager.m_body != null ? villager.m_body.velocity : Vector3.zero;
            float yaw = villager.transform.eulerAngles.y;
            float lookYaw = villager.m_lookYaw.eulerAngles.y;
            Vector3 move = villager.m_moveDir;
            Animator animator = villager.m_animator;
            float fwd = 0f, side = 0f;
            string stateName = "";
            bool transition = false;
            if (animator != null)
            {
                fwd = SafeFloat(animator, "forward_speed");
                side = SafeFloat(animator, "sideway_speed");
                AnimatorStateInfo info = animator.GetCurrentAnimatorStateInfo(0);
                stateName = info.shortNameHash.ToString(c);
                transition = animator.IsInTransition(0);
            }

            string activity = VillagerBehaviour.Activity(villager) ?? "";
            bool alerted = villager.m_baseAI is MonsterAI ai && ai.IsAlerted();
            bool owner = villager.m_nview != null && villager.m_nview.IsOwner();

            string evt = string.Join(" | ", Events);
            Events.Clear();
            if (_hasLast)
            {
                float jump = Vector3.Distance(p, _lastPosition);
                if (jump > 0.5f)
                {
                    evt += (evt.Length > 0 ? " | " : "") + $"snap {jump:0.00} m";
                    _snaps++;
                }

                if (Mathf.Abs(Mathf.DeltaAngle(_lastLookYaw, lookYaw)) > 5f)
                {
                    _lookJumps++;
                }

                if (new Vector3(v.x, 0f, v.z).magnitude < 0.1f && Mathf.Abs(p.y - _lastPosition.y) > 0.02f)
                {
                    _bobs++;
                }

                float dyaw = Mathf.DeltaAngle(_lastYaw, yaw);
                if (Mathf.Abs(dyaw) > 8f)
                {
                    _yawFlips++;
                }
            }

            if (!villager.IsOnGround())
            {
                _airborne++;
            }

            _maxUp = Mathf.Max(_maxUp, v.y);
            float sign = Mathf.Abs(fwd) < 0.05f ? 0f : Mathf.Sign(fwd);
            if (sign != 0f && _lastSpeedSign != 0f && sign != _lastSpeedSign)
            {
                _speedFlips++;
            }

            if (sign != 0f)
            {
                _lastSpeedSign = sign;
            }

            if (activity != _lastActivity)
            {
                _activityChanges++;
                _lastActivity = activity;
            }

            _rows.Append(Time.time.ToString("0.000", c)).Append(',').Append(Time.frameCount).Append(',')
                .Append(p.x.ToString("0.000", c)).Append(',').Append(p.y.ToString("0.000", c)).Append(',').Append(p.z.ToString("0.000", c)).Append(',')
                .Append(v.x.ToString("0.00", c)).Append(',').Append(v.y.ToString("0.00", c)).Append(',').Append(v.z.ToString("0.00", c)).Append(',')
                .Append(new Vector3(v.x, 0f, v.z).magnitude.ToString("0.00", c)).Append(',')
                .Append(yaw.ToString("0.0", c)).Append(',').Append(lookYaw.ToString("0.0", c)).Append(',')
                .Append(move.x.ToString("0.00", c)).Append(',').Append(move.z.ToString("0.00", c)).Append(',').Append(move.magnitude.ToString("0.00", c)).Append(',')
                .Append(villager.m_run ? 1 : 0).Append(',').Append(villager.m_walk ? 1 : 0).Append(',').Append(villager.IsOnGround() ? 1 : 0).Append(',')
                .Append(fwd.ToString("0.00", c)).Append(',').Append(side.ToString("0.00", c)).Append(',').Append(stateName).Append(',')
                .Append(transition ? 1 : 0).Append(',').Append(villager.InAttack() ? 1 : 0).Append(',').Append(owner ? 1 : 0).Append(',')
                .Append(_moveTo).Append(',').Append(_moveTowards).Append(',').Append(_stopMoving).Append(',').Append(_setLookDir).Append(',').Append(_lookAt).Append(',')
                .Append(alerted ? 1 : 0).Append(',').Append(Quote(activity)).Append(',').Append(Quote(evt)).AppendLine();

            _moveTo = _moveTowards = _stopMoving = _setLookDir = _lookAt = 0;
            _lastPosition = p;
            _lastYaw = yaw;
            _lastLookYaw = lookYaw;
            _hasLast = true;
            _samples++;
        }

        private static void Finish()
        {
            Villager villager = _villager;
            _villager = null;
            if (_rows == null)
            {
                return;
            }

            var triggers = new List<string>();
            foreach (KeyValuePair<string, int> t in TriggerCounts)
            {
                triggers.Add($"{t.Key} x{t.Value}");
            }

            string summary = $"Villheim trace of {(villager != null ? villager.VillagerName : "?")}: {_samples} steps, " +
                             $"off the ground {_airborne}, highest upward speed {_maxUp:0.00} m/s, position jumps {_snaps}, " +
                             $"turns over 8 degrees in one step {_yawFlips}, look jumps over 5 degrees {_lookJumps}, height bobs while still {_bobs}, " +
                             $"leg direction reversals {_speedFlips}, " +
                             $"activity changes {_activityChanges}, animator triggers {_triggers} ({string.Join(", ", triggers)}).";
            try
            {
                File.WriteAllText(_path, "# " + summary + "\n" + _rows);
                VillheimPlugin.Log.LogInfo(summary + $" Written to {_path}.");
                Console.instance?.Print(summary);
                Console.instance?.Print($"Trace written to {_path}");
            }
            catch (System.Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Trace could not be written: {e.Message}");
            }

            _rows = null;
        }

        private static void Event(Character character, string text)
        {
            if (_villager != null && character == _villager)
            {
                Events.Add(text);
            }
        }

        private static float SafeFloat(Animator animator, string name)
        {
            foreach (AnimatorControllerParameter parameter in animator.parameters)
            {
                if (parameter.name == name && parameter.type == AnimatorControllerParameterType.Float)
                {
                    return animator.GetFloat(name);
                }
            }

            return 0f;
        }

        private static string Quote(string text) => text.Length == 0 ? "" : "\"" + text.Replace("\"", "'") + "\"";

        private static bool IsTraced(Component component) => _villager != null && component != null && component.gameObject == _villager.gameObject;

        [HarmonyPatch(typeof(Humanoid), nameof(Humanoid.CustomFixedUpdate))]
        internal static class FixedUpdatePatch
        {
            private static void Postfix(Character __instance)
            {
                if (_villager != null && __instance == _villager)
                {
                    Sample(_villager);
                }
            }
        }

        [HarmonyPatch(typeof(ZSyncAnimation), nameof(ZSyncAnimation.SetTrigger), typeof(string))]
        internal static class TriggerPatch
        {
            private static void Prefix(ZSyncAnimation __instance, string name)
            {
                if (IsTraced(__instance))
                {
                    _triggers++;
                    TriggerCounts.TryGetValue(name, out int n);
                    TriggerCounts[name] = n + 1;
                    Events.Add("trigger " + name);
                }
            }
        }

        [HarmonyPatch(typeof(ZSyncAnimation), nameof(ZSyncAnimation.SetBool), typeof(string), typeof(bool))]
        internal static class BoolPatch
        {
            private static void Prefix(ZSyncAnimation __instance, string name, bool value)
            {
                if (IsTraced(__instance))
                {
                    Events.Add($"bool {name}={value}");
                }
            }
        }

        [HarmonyPatch(typeof(Character), nameof(Character.Jump), typeof(bool))]
        internal static class JumpPatch
        {
            private static void Prefix(Character __instance) => Event(__instance, "jump");
        }

        [HarmonyPatch(typeof(Character), nameof(Character.SetLookDir), typeof(Vector3), typeof(float))]
        internal static class SetLookDirPatch
        {
            private static void Prefix(Character __instance)
            {
                if (_villager != null && __instance == _villager)
                {
                    _setLookDir++;
                }
            }
        }

        [HarmonyPatch(typeof(BaseAI), nameof(BaseAI.MoveTowards), typeof(Vector3), typeof(bool))]
        internal static class MoveTowardsPatch
        {
            private static void Prefix(BaseAI __instance)
            {
                if (IsTraced(__instance))
                {
                    _moveTowards++;
                }
            }
        }

        [HarmonyPatch(typeof(BaseAI), nameof(BaseAI.MoveTo), typeof(float), typeof(Vector3), typeof(float), typeof(bool))]
        internal static class MoveToPatch
        {
            private static void Prefix(BaseAI __instance)
            {
                if (IsTraced(__instance))
                {
                    _moveTo++;
                }
            }
        }

        [HarmonyPatch(typeof(BaseAI), nameof(BaseAI.StopMoving), new System.Type[0])]
        internal static class StopMovingPatch
        {
            private static void Prefix(BaseAI __instance)
            {
                if (IsTraced(__instance))
                {
                    _stopMoving++;
                }
            }
        }

        [HarmonyPatch(typeof(BaseAI), nameof(BaseAI.LookAt), typeof(Vector3))]
        internal static class LookAtPatch
        {
            private static void Prefix(BaseAI __instance)
            {
                if (IsTraced(__instance))
                {
                    _lookAt++;
                }
            }
        }
    }
}
