using HarmonyLib;
using Villheim.Village;

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
                __result = $"{hearth.VillageName} hearth\n<color=#b0b0b0>{hearth.Summary()}</color>";
            }
        }

        [HarmonyPostfix]
        [HarmonyPatch(nameof(Fireplace.GetHoverName))]
        private static void GetHoverName(Fireplace __instance, ref string __result)
        {
            if (__instance.TryGetComponent(out VillageHearth hearth))
            {
                __result = $"{hearth.VillageName} hearth";
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

            if (!hold && user == Player.m_localPlayer)
            {
                user.Message(MessageHud.MessageType.Center, hearth.Summary());
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
