using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// 'vh tidy': takes away what Villheim's commands built near the player (vh preview, vh gen, vh place), and with
    /// 'villages' also every village whose hearth is in range (its buildings, villagers and hearth). Pieces players
    /// built, world locations, and the gallery and slotting board are never touched; the gallery and the board have
    /// their own 'gallery clear' and 'slot clear'. Levelled ground stays as it is.
    /// </summary>
    internal static class Tidy
    {
        public static string Run(string[] args, Vector3 at)
        {
            float radius = 40f;
            bool yes = false, villages = false, untagged = false;
            foreach (string word in args)
            {
                string w = word.ToLowerInvariant();
                if (w == "yes") yes = true;
                else if (w == "villages" || w == "all") villages = true;
                else if (w == "untagged" || w == "old") untagged = true;
                else if (float.TryParse(w, out float r)) radius = Mathf.Clamp(r, 5f, 300f);
                else if (w == "help") return Help;
            }

            List<VillageHearth> hearths = villages
                ? VillageHearth.All.Where(h => h != null && h.IsValid && Vector3.Distance(h.transform.position, at) <= radius).ToList()
                : new List<VillageHearth>();
            var ids = new HashSet<int>(hearths.Select(h => h.VillageId).Where(id => id != 0));

            var doomed = new List<ZNetView>();
            int built = 0, village = 0, old = 0;
            foreach (ZNetView view in Object.FindObjectsByType<ZNetView>(FindObjectsSortMode.None))
            {
                if (view == null || !view.IsValid())
                {
                    continue;
                }

                ZDO zdo = view.GetZDO();
                if (zdo.GetInt(Gallery.KeyGallery) != 0 || view.GetComponent<Player>() != null)
                {
                    continue;
                }

                // A village's buildings and people go with it even when they stand beyond the radius.
                bool ofVillage = ids.Count > 0 && (ids.Contains(zdo.GetInt(Keys.BuiltBy)) ||
                                                   (view.TryGetComponent(out Villager v) && ids.Contains(v.VillageId)));
                if (ofVillage)
                {
                    doomed.Add(view);
                    village++;
                    continue;
                }

                if (Vector3.Distance(view.transform.position, at) > radius)
                {
                    continue;
                }

                if (zdo.GetInt(DesignSpawner.KeySpawned) != 0)
                {
                    doomed.Add(view);
                    built++;
                }
                else if (untagged && zdo.GetInt(Keys.BuiltBy) == 0 && view.TryGetComponent(out Piece piece) && piece.GetCreator() == 0 &&
                         view.GetComponent<VillageHearth>() == null)
                {
                    // Built by a command before pieces were marked: no creator, no village. World locations also
                    // have no creator, so this is only for ground you know held nothing else.
                    doomed.Add(view);
                    old++;
                }
            }

            string what = $"{built} pieces built by commands" +
                          (villages ? $", {hearths.Count} village(s) with {village} buildings and villagers" : "") +
                          (untagged ? $", {old} unmarked pieces with no builder" : "");
            if (!yes)
            {
                return $"Villheim: within {radius:0} m there are {what}. Run the same command with 'yes' to remove them. " +
                       "Player-built pieces, the gallery and the board stay.";
            }

            foreach (ZNetView view in doomed)
            {
                if (view != null && view.IsValid())
                {
                    view.ClaimOwnership();
                    ZNetScene.instance.Destroy(view.gameObject);
                }
            }

            foreach (VillageHearth hearth in hearths)
            {
                if (hearth != null && hearth.IsValid)
                {
                    hearth.NView.ClaimOwnership();
                    ZNetScene.instance.Destroy(hearth.gameObject);
                }
            }

            return $"Villheim: removed {what}. Levelled ground stays as it is.";
        }

        public const string Help =
            "tidy [radius] [villages] [untagged] [yes]: remove what vh preview, vh gen and vh place built within radius (default 40 m). " +
            "'villages' also removes every village whose hearth is in range, with all its buildings and villagers. " +
            "'untagged' also removes pieces with no builder (from commands before this build; world ruins have no builder too, so use it only on clear ground). " +
            "Without 'yes' it only counts. Player-built pieces, the gallery and the slotting board are never touched.";
    }
}
