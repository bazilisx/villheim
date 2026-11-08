using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Expectations that rise with the village (proposal 2, after RimWorld's expectations and MineColonies' food
    /// factor). A new camp is content with little; a grown village grumbles unless it has what a village of its size
    /// should have.
    ///
    /// - A standing mood bonus by stage (ExpectationBonus, 18, 12, 6 and 0 for camp, hamlet, village and town).
    /// - Food variety: the distinct foods the village ate in the last three days against the stage (a camp wants one,
    ///   a town four). Each one short is -2.5; each one over +1 (at most +2).
    /// - From stage 2 a longhouse (-4 without), from stage 3 seats for half the village (-2) and a fence of at least
    ///   eight pieces (-3).
    /// - Worked out per village once a minute. Tags expect:short, expect:short:food/hall/seats/fence, expect:met.
    /// </summary>
    internal static class Expectations
    {
        private sealed class View
        {
            public float Term;
            public float Next;
            public readonly List<string> Short = new List<string>();
        }

        private static readonly Dictionary<int, View> Views = new Dictionary<int, View>();
        private static readonly Dictionary<int, List<(string Food, int Day)>> Eaten = new Dictionary<int, List<(string, int)>>();

        private static bool On => Living.On(LogicConfig.Expectations);

        /// <summary>From Healing: a villager ate this food.</summary>
        public static void Ate(Villager villager, string food)
        {
            if (villager == null || villager.VillageId == 0)
            {
                return;
            }

            if (!Eaten.TryGetValue(villager.VillageId, out List<(string Food, int Day)> list))
            {
                Eaten[villager.VillageId] = list = new List<(string, int)>();
            }

            int today = Living.Today;
            list.RemoveAll(e => e.Day < today - 2 || e.Food == food);
            list.Add((food, today));
        }

        public static int Variety(int villageId)
        {
            int today = Living.Today;
            return Eaten.TryGetValue(villageId, out List<(string Food, int Day)> list)
                ? list.Where(e => e.Day >= today - 2).Select(e => e.Food).Distinct().Count()
                : 0;
        }

        public static float Term(Villager villager)
        {
            View view = Get(villager.VillageId);
            return view != null ? view.Term : 0f;
        }

        private static View Get(int villageId)
        {
            if (!On || villageId == 0)
            {
                return null;
            }

            if (!Views.TryGetValue(villageId, out View view))
            {
                Views[villageId] = view = new View();
            }

            if (Time.time >= view.Next)
            {
                view.Next = Time.time + 60f;
                Compute(villageId, view);
            }

            return view;
        }

        private static float Bonus(int stage)
        {
            string[] parts = (LogicConfig.ExpectationBonus != null ? LogicConfig.ExpectationBonus.Value : "18,12,6,0").Split(',');
            int index = Mathf.Clamp(stage - 1, 0, parts.Length - 1);
            return float.TryParse(parts[index].Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out float value) ? value : 0f;
        }

        private static void Compute(int villageId, View view)
        {
            view.Short.Clear();
            VillageHearth hearth = VillageHearth.Find(villageId);
            if (hearth == null || !hearth.IsValid)
            {
                view.Term = 0f;
                return;
            }

            var state = new VillageState(hearth.Zdo);
            int stage = Living.Stage(state);
            float term = Bonus(stage);

            int variety = Variety(villageId);
            if (variety < stage)
            {
                term -= (stage - variety) * 2.5f;
                view.Short.Add("food");
            }
            else
            {
                term += Mathf.Min(2, variety - stage);
            }

            if (stage >= 2 && !state.Plots.Any(p => Growth.RoleOf(p) == Role.Hub))
            {
                term -= 4f;
                view.Short.Add("hall");
            }

            if (stage >= 3)
            {
                CountPieces(hearth, out int chairs, out int fence);
                int people = VillageBrain.CountVillagers(villageId);
                if (chairs * 2 < people)
                {
                    term -= 2f;
                    view.Short.Add("seats");
                }

                if (fence < 8)
                {
                    term -= 3f;
                    view.Short.Add("fence");
                }
            }

            view.Term = term;
        }

        private static void CountPieces(VillageHearth hearth, out int chairs, out int fence)
        {
            var seen = new HashSet<GameObject>();
            chairs = 0;
            fence = 0;
            float radius = VillheimConfig.VillageRadius.Value + 10f;
            foreach (Collider collider in Physics.OverlapSphere(hearth.transform.position, radius, LayerMask.GetMask("piece", "piece_nonsolid")))
            {
                Piece piece = collider.GetComponentInParent<Piece>();
                if (piece == null || !seen.Add(piece.gameObject))
                {
                    continue;
                }

                if (piece.GetComponent<Chair>() != null)
                {
                    chairs++;
                }
                else if (Palisade.IsFencePiece(Utils.GetPrefabName(piece.gameObject)))
                {
                    fence++;
                }
            }
        }

        public static IEnumerable<string> Tags(Villager villager)
        {
            View view = Get(villager.VillageId);
            if (view == null)
            {
                yield break;
            }

            if (view.Short.Count == 0)
            {
                yield return "expect:met";
                yield break;
            }

            yield return "expect:short";
            foreach (string what in view.Short)
            {
                yield return "expect:short:" + what;
            }
        }

        public static string Describe(int villageId)
        {
            View view = Get(villageId);
            return view == null
                ? "expectations off"
                : $"expectations {view.Term:+0.0;-0.0} ({Variety(villageId)} foods in three days; short of: " +
                  $"{(view.Short.Count > 0 ? string.Join(", ", view.Short) : "nothing")})";
        }
    }
}
