using System.Collections.Generic;
using UnityEngine;
using Villheim.Logic.Villagers;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The Shaper Tool's plot mode (key 9, D-090 to D-093, answered 2026-11-10): choose where the nearest village puts
    /// its next building, as in Millénaire.
    ///
    /// Aim at the ground: the pending building's outline is drawn there, green when it fits and red when it does not,
    /// with the reason at the top left; a short line from the outline toward the hearth shows the door side, and a
    /// yellow ring round the hearth shows the ground kept clear (D-091). Left click chooses the spot; the village breaks
    /// ground there next (PlotPick). A spot must pass the same tests as the village's own search (D-092), and only a
    /// player the village counts as a friend may choose (D-093; devcommands on counts, for testing).
    /// </summary>
    internal static class PlotTool
    {
        private const int OutlinePoints = 48;
        private const int RingPoints = 64;

        private static GameObject _root;
        private static LineRenderer _outline, _door, _ring;
        private static Vector3 _lastAim = Vector3.positiveInfinity;
        private static float _nextJudge;
        private static bool _fits;
        private static string _why = "";
        private static string _shown = "";
        private static PlotPick.Pick _pick;
        private static VillageHearth _hearth;

        public static void Update(Player player)
        {
            if (!Aim(out Vector3 at))
            {
                Hide();
                return;
            }

            VillageHearth hearth = VillageHearth.Closest(at, 250f);
            if (hearth == null || !hearth.IsValid)
            {
                Hide();
                Show("Plot: no village within 250 m of where you aim.");
                return;
            }

            if (Time.time >= _nextJudge || hearth != _hearth || Utils.DistanceXZ(at, _lastAim) > 0.75f)
            {
                _nextJudge = Time.time + 0.3f;
                _lastAim = at;
                _hearth = hearth;
                var state = new VillageState(hearth.Zdo);
                _fits = PlotPick.Judge(hearth, state, at, out _pick, out Foot foot, out _why);
                if (_pick == null)
                {
                    Hide();
                    Show($"Plot ({state.Name}): {_why}.");
                    return;
                }

                Draw(foot, hearth.transform.position, _fits);
                string size = $"{foot.HalfX * 2f:0} x {foot.HalfZ * 2f:0} m";
                Show($"Plot ({state.Name}): a {VillageBrain.RoleName(_pick.Role)} ({size}) " +
                     (_fits ? $"fits here{(_why.Length > 0 ? ", " + _why : "")}. Click to choose it." : $"does not fit: {_why}."));
            }
        }

        public static void Click(Player player)
        {
            if (_hearth == null || !_hearth.IsValid || _pick == null)
            {
                Say(player, "Aim at open ground near a village with a building planned.");
                return;
            }

            if (!MayChoose(_hearth, player, out string refusal))
            {
                Say(player, refusal);
                return;
            }

            if (!_fits)
            {
                Say(player, $"Not here: {_why}.");
                return;
            }

            string result = PlotPick.Choose(_hearth, _pick);
            Say(player, result);
        }

        /// <summary>D-093: a friend of the village (or anyone with devcommands on, for testing).</summary>
        private static bool MayChoose(VillageHearth hearth, Player player, out string refusal)
        {
            refusal = null;
            if (Terminal.m_cheat)
            {
                return true;
            }

            if (Grudges.Unwelcome(hearth, player, out _))
            {
                refusal = $"{hearth.VillageName} does not want your help.";
                return false;
            }

            int standing = Standing.Of(hearth, player);
            if (standing < Villagers.Social.FriendAt)
            {
                refusal = $"{hearth.VillageName} does not know you well enough to let you choose (standing {standing}, a friend from {Villagers.Social.FriendAt}).";
                return false;
            }

            return true;
        }

        /// <summary>When the logic unloads: the lines go with it, so a reload never leaves an old outline standing.</summary>
        public static void Unload()
        {
            if (_root != null)
            {
                Object.Destroy(_root);
                _root = null;
            }
        }

        public static void Hide()
        {
            if (_root != null)
            {
                _root.SetActive(false);
            }

            _lastAim = Vector3.positiveInfinity;
            _shown = "";
        }

        private static bool Aim(out Vector3 at)
        {
            at = Vector3.zero;
            if (GameCamera.instance == null)
            {
                return false;
            }

            Transform cam = GameCamera.instance.transform;
            if (!Physics.Raycast(cam.position, cam.forward, out RaycastHit hit, 150f, LayerMask.GetMask("terrain"), QueryTriggerInteraction.Ignore))
            {
                return false;
            }

            at = hit.point;
            return true;
        }

        private static void Draw(Foot foot, Vector3 hearth, bool fits)
        {
            Make();
            _root.SetActive(true);
            Color color = fits ? new Color(0.3f, 1f, 0.35f, 0.9f) : new Color(1f, 0.25f, 0.2f, 0.9f);

            // The outline, laid on the ground.
            var corners = new[]
            {
                new Vector3(-foot.HalfX, 0f, -foot.HalfZ), new Vector3(foot.HalfX, 0f, -foot.HalfZ),
                new Vector3(foot.HalfX, 0f, foot.HalfZ), new Vector3(-foot.HalfX, 0f, foot.HalfZ),
            };
            Quaternion turn = foot.Rotation;
            Vector3 middle = foot.CenterAt(0f);
            int per = OutlinePoints / 4;
            for (int side = 0; side < 4; side++)
            {
                Vector3 a = corners[side], b = corners[(side + 1) % 4];
                for (int i = 0; i < per; i++)
                {
                    Vector3 p = middle + turn * Vector3.Lerp(a, b, i / (float)per);
                    _outline.SetPosition(side * per + i, OnGround(p));
                }
            }

            _outline.startColor = _outline.endColor = color;

            // The door side: the village turns every building's door toward the hearth.
            Vector3 toward = (hearth - middle).Horizontal();
            toward = toward.sqrMagnitude > 0.01f ? toward.normalized : Vector3.forward;
            Vector3 local = Quaternion.Inverse(turn) * toward;
            float reach = Mathf.Min(Mathf.Abs(local.x) > 0.01f ? foot.HalfX / Mathf.Abs(local.x) : float.MaxValue,
                                    Mathf.Abs(local.z) > 0.01f ? foot.HalfZ / Mathf.Abs(local.z) : float.MaxValue);
            Vector3 door = middle + toward * reach;
            _door.SetPosition(0, OnGround(door));
            _door.SetPosition(1, OnGround(door + toward * 2.5f));
            _door.startColor = _door.endColor = new Color(1f, 1f, 1f, 0.95f);

            // The hearth's kept circle.
            float keep = PlotFinder.HearthKeep;
            for (int i = 0; i < RingPoints; i++)
            {
                float t = i * Mathf.PI * 2f / RingPoints;
                _ring.SetPosition(i, OnGround(hearth + new Vector3(Mathf.Cos(t), 0f, Mathf.Sin(t)) * keep));
            }

            _ring.startColor = _ring.endColor = new Color(1f, 0.85f, 0.2f, 0.8f);
        }

        private static Vector3 OnGround(Vector3 p)
        {
            float y = ZoneSystem.instance != null && ZoneSystem.instance.GetGroundHeight(p, out float h) ? h : p.y;
            return new Vector3(p.x, y + 0.15f, p.z);
        }

        private static void Make()
        {
            if (_root != null)
            {
                return;
            }

            _root = new GameObject("VillheimPlotTool");
            Object.DontDestroyOnLoad(_root);
            _outline = Line("outline", OutlinePoints, true, 0.12f);
            _door = Line("door", 2, false, 0.25f);
            _ring = Line("hearth", RingPoints, true, 0.08f);
        }

        private static LineRenderer Line(string name, int points, bool loop, float width)
        {
            var go = new GameObject(name);
            go.transform.SetParent(_root.transform, false);
            LineRenderer line = go.AddComponent<LineRenderer>();
            line.loop = loop;
            line.useWorldSpace = true;
            line.positionCount = points;
            line.widthMultiplier = width;
            line.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            line.receiveShadows = false;
            Shader shader = Shader.Find("Sprites/Default");
            if (shader != null)
            {
                line.material = new Material(shader);
            }

            return line;
        }

        private static void Show(string text)
        {
            if (text == _shown)
            {
                return;
            }

            _shown = text;
            MessageHud.instance?.ShowMessage(MessageHud.MessageType.TopLeft, text);
        }

        private static void Say(Player player, string text) => player?.Message(MessageHud.MessageType.Center, text);
    }
}
