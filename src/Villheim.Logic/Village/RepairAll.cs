namespace Villheim.Logic.Village
{
    /// <summary>
    /// 'vh repair': every item in the player's inventory that wears down (tools, weapons, armour, equipped or not) is set
    /// back to full durability (ItemData.m_durability = GetMaxDurability()), as a workbench repair leaves it.
    /// </summary>
    internal static class RepairAll
    {
        public static string Run()
        {
            Player player = Player.m_localPlayer;
            if (player == null)
            {
                return "Villheim: 'vh repair' needs you in the world.";
            }

            int repaired = 0;
            foreach (ItemDrop.ItemData item in player.GetInventory().GetAllItems())
            {
                if (item.m_shared.m_useDurability && item.m_durability < item.GetMaxDurability())
                {
                    item.m_durability = item.GetMaxDurability();
                    repaired++;
                }
            }

            return repaired > 0 ? $"Villheim: repaired {repaired} items." : "Villheim: nothing in your inventory needed repairing.";
        }
    }
}
