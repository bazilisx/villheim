using HarmonyLib;
using UnityEngine;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Villagers are not hurt by a falling tree or a rolling log. A felled trunk does its crush damage through
    /// ImpactEffect, which spares players only, so a woodcutter at the stump when his tree came down was hit like a
    /// greyling. Only tree and log bodies are affected; monsters, weapons and other impacts land as before.
    ///
    /// From ValheimVillages by myrcutio (CC0), Patches/VillagerTreeImpactPatch.cs; the villager test reads Villheim's
    /// own village key.
    /// </summary>
    [HarmonyPatch(typeof(ImpactEffect), nameof(ImpactEffect.OnCollisionEnter))]
    internal static class TreeImpact
    {
        private static bool Prefix(ImpactEffect __instance, Collision info)
        {
            if (info == null || info.contacts.Length == 0 ||
                (__instance.GetComponent<TreeLog>() == null && __instance.GetComponent<TreeBase>() == null))
            {
                return true;
            }

            GameObject hit = Projectile.FindHitObject(info.contacts[0].otherCollider);
            if (hit == null || hit.GetComponent<Character>() == null)
            {
                return true;
            }

            // Read from the ZDO: the log may belong to another peer than the one running the villager.
            ZDO zdo = hit.GetComponent<ZNetView>()?.GetZDO();
            return zdo == null || zdo.GetInt(Keys.VillagerVillage) == 0;
        }
    }
}
