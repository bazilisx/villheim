using HarmonyLib;

namespace Villheim
{
    /// <summary>
    /// The hearth is a vanilla campfire underneath. Show village information instead of fuel, and do not let
    /// players feed it (it burns forever).
    /// </summary>
    [HarmonyPatch(typeof(Fireplace))]
    internal static class FireplacePatches
    {
        [HarmonyPostfix]
        [HarmonyPatch(nameof(Fireplace.GetHoverText))]
        private static void GetHoverText(Fireplace __instance, ref string __result)
        {
            if (__instance.TryGetComponent(out VillageHearth hearth))
            {
                string fallback = __result;
                __result = LogicHost.Get(logic => logic.HearthHoverText(hearth), fallback);
            }
        }

        [HarmonyPostfix]
        [HarmonyPatch(nameof(Fireplace.GetHoverName))]
        private static void GetHoverName(Fireplace __instance, ref string __result)
        {
            if (__instance.TryGetComponent(out VillageHearth hearth))
            {
                string fallback = __result;
                __result = LogicHost.Get(logic => logic.HearthHoverName(hearth), fallback);
            }
        }

        [HarmonyPrefix]
        [HarmonyPatch(nameof(Fireplace.Interact))]
        private static bool Interact(Fireplace __instance, Humanoid user, bool hold, ref bool __result)
        {
            if (!__instance.TryGetComponent(out VillageHearth hearth))
            {
                return true;
            }

            if (!hold)
            {
                LogicHost.Call(logic => logic.HearthInteract(hearth, user));
            }

            __result = false;
            return false;
        }

        [HarmonyPrefix]
        [HarmonyPatch(nameof(Fireplace.UseItem))]
        private static bool UseItem(Fireplace __instance, ref bool __result)
        {
            if (!__instance.GetComponent<VillageHearth>())
            {
                return true;
            }

            __result = false;
            return false;
        }
    }
}
