using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Prefabs;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Villagers are echoes, so they die as the game's ghosts do (D-051): no body falls, nothing turns solid, no blood.
    /// Their death and hit effects are taken from the game's own Ghost (then the Wraith) with any ragdoll left out,
    /// so a dying villager plays the ghost's vanishing effect and is gone at once (Character.OnDeath removes him after
    /// the effects). The player's death effect, with its ragdoll, was used before. GhostDeath turns it off.
    /// </summary>
    internal static class GhostDeath
    {
        private static readonly string[] Sources = { "Ghost", "Wraith" };

        private static EffectList _death;
        private static EffectList _hit;
        private static bool _searched;

        private static bool On => LogicConfig.IsOn(LogicConfig.GhostDeath);

        private static void Find()
        {
            if (_searched || ZNetScene.instance == null)
            {
                return;
            }

            _searched = true;
            foreach (string name in Sources)
            {
                Character ghost = ZNetScene.instance.GetPrefab(name)?.GetComponent<Character>();
                if (ghost == null)
                {
                    continue;
                }

                EffectList death = WithoutRagdoll(ghost.m_deathEffects);
                if (death.m_effectPrefabs.Length == 0)
                {
                    continue;
                }

                _death = death;
                _hit = WithoutRagdoll(ghost.m_hitEffects);
                VillheimPlugin.Debug($"Villagers die as the {name} does: {string.Join(", ", _death.m_effectPrefabs.Select(e => e.m_prefab.name))}.");
                return;
            }

            VillheimPlugin.Log.LogWarning("Villheim: no ghost death effect found; villagers keep the player's death effect.");
        }

        private static EffectList WithoutRagdoll(EffectList source)
        {
            var kept = new List<EffectList.EffectData>();
            foreach (EffectList.EffectData data in source?.m_effectPrefabs ?? new EffectList.EffectData[0])
            {
                if (data?.m_prefab != null && data.m_prefab.GetComponent<Ragdoll>() == null)
                {
                    kept.Add(data);
                }
            }

            return new EffectList { m_effectPrefabs = kept.ToArray() };
        }

        /// <summary>Gives the villager (and the villager prefab) the ghost's death and hit effects.</summary>
        public static void Apply(Villager villager)
        {
            if (!On || villager == null)
            {
                return;
            }

            Find();
            if (_death == null || villager.m_deathEffects == _death)
            {
                return;
            }

            villager.m_deathEffects = _death;
            villager.m_hitEffects = _hit;
            villager.m_critHitEffects = _hit;
            villager.m_backstabHitEffects = _hit;

            Villager prefab = VillagerPrefab.Prefab != null ? VillagerPrefab.Prefab.GetComponent<Villager>() : null;
            if (prefab != null && prefab != villager && prefab.m_deathEffects != _death)
            {
                Apply(prefab);
            }
        }
    }
}
