using System.Collections.Generic;
using System.Globalization;
using System.Text;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>One building a village has raised.</summary>
    internal sealed class Plot
    {
        public string Design;
        public Vector3 Position;
        public float Yaw;
        public float Radius;

        /// <summary>Hub, House, Workshop or Farm. Empty for plots built before roles existed (treated as homes).</summary>
        public string Role = "";
    }

    /// <summary>
    /// Village data stored on the hearth's ZDO, so it is saved with the world and shared in multiplayer.
    /// </summary>
    internal sealed class VillageState
    {

        // Added after 0.1.0. Defined here (not in the core) so the logic can add state without a game restart.
        private static readonly int KeyWood = "villheim_wood".GetStableHashCode();
        private static readonly int KeyLastSeen = "villheim_last_seen".GetStableHashCode();
        private static readonly int KeyAxis = "villheim_axis".GetStableHashCode();
        private static readonly int KeyWaiting = "villheim_waiting".GetStableHashCode();
        private static readonly int KeyStock = "villheim_stock".GetStableHashCode();

        private readonly ZDO _zdo;
        private string _plotsRaw;
        private List<Plot> _plots = new List<Plot>();

        public VillageState(ZDO zdo)
        {
            _zdo = zdo;
        }

        public bool Initialized
        {
            get => _zdo.GetBool(Keys.Initialized);
            set => _zdo.Set(Keys.Initialized, value);
        }

        public int Id
        {
            get => _zdo.GetInt(Keys.VillageId);
            set => _zdo.Set(Keys.VillageId, value);
        }

        public int Seed
        {
            get => _zdo.GetInt(Keys.Seed);
            set => _zdo.Set(Keys.Seed, value);
        }

        public string Name
        {
            get => _zdo.GetString(Keys.Name, "Village");
            set => _zdo.Set(Keys.Name, value);
        }

        public Heightmap.Biome Biome
        {
            get => (Heightmap.Biome)_zdo.GetInt(Keys.Biome, (int)Heightmap.Biome.Meadows);
            set => _zdo.Set(Keys.Biome, (int)value);
        }

        /// <summary>World time (seconds) the growth clock last advanced to.</summary>
        public double LastGrowth
        {
            get => _zdo.GetLong(Keys.LastGrowth) / 10.0;
            set => _zdo.Set(Keys.LastGrowth, (long)(value * 10.0));
        }

        public double LastArrival
        {
            get => _zdo.GetLong(Keys.LastArrival) / 10.0;
            set => _zdo.Set(Keys.LastArrival, (long)(value * 10.0));
        }

        /// <summary>How many villagers have ever arrived, used for the initial arrivals and for name seeds.</summary>
        public int Arrivals
        {
            get => _zdo.GetInt(Keys.Arrivals);
            set => _zdo.Set(Keys.Arrivals, value);
        }

        /// <summary>Wood in the village stock (shorthand for the "Wood" material).</summary>
        public int Wood
        {
            get => Get(Materials.Wood);
            set => Set(Materials.Wood, value);
        }

        /// <summary>Amount of a building material (item prefab name such as Wood or Stone) in the village stock.</summary>
        public int Get(string material)
        {
            return ReadStock().TryGetValue(material, out int amount) ? amount : 0;
        }

        public void Set(string material, int amount)
        {
            Dictionary<string, int> stock = ReadStock();
            stock[material] = Mathf.Max(0, amount);
            WriteStock(stock);
        }

        public void Add(string material, int amount)
        {
            Set(material, Get(material) + amount);
        }

        public Dictionary<string, int> Stock => ReadStock();

        /// <summary>"120 wood, 30 stone" for summaries.</summary>
        public string StockText()
        {
            var parts = new List<string>();
            foreach (KeyValuePair<string, int> entry in ReadStock())
            {
                if (entry.Value > 0)
                {
                    parts.Add($"{entry.Value} {Materials.Label(entry.Key)}");
                }
            }

            return parts.Count > 0 ? string.Join(", ", parts) : "no materials";
        }

        private Dictionary<string, int> ReadStock()
        {
            var stock = new Dictionary<string, int>();
            string raw = _zdo.GetString(KeyStock, "");
            foreach (string entry in raw.Split(';'))
            {
                int colon = entry.IndexOf(':');
                if (colon > 0 && int.TryParse(entry.Substring(colon + 1), out int amount))
                {
                    stock[entry.Substring(0, colon)] = amount;
                }
            }

            // Villages from before the material stock kept their wood in its own key.
            int legacyWood = _zdo.GetInt(KeyWood);
            if (legacyWood > 0)
            {
                stock.TryGetValue(Materials.Wood, out int wood);
                stock[Materials.Wood] = wood + legacyWood;
                _zdo.Set(KeyWood, 0);
                WriteStock(stock);
            }

            return stock;
        }

        private void WriteStock(Dictionary<string, int> stock)
        {
            var sb = new StringBuilder();
            foreach (KeyValuePair<string, int> entry in stock)
            {
                if (sb.Length > 0)
                {
                    sb.Append(';');
                }

                sb.Append(entry.Key).Append(':').Append(entry.Value.ToString(CultureInfo.InvariantCulture));
            }

            _zdo.Set(KeyStock, sb.ToString());
        }

        /// <summary>World time of the last tick, to tell how long the village sat unloaded.</summary>
        public double LastSeen
        {
            get => _zdo.GetLong(KeyLastSeen) / 10.0;
            set => _zdo.Set(KeyLastSeen, (long)(value * 10.0));
        }

        /// <summary>Yaw of the village grid. Taken from the hearth when the village is founded.</summary>
        public float Axis
        {
            get => _zdo.GetFloat(KeyAxis);
            set => _zdo.Set(KeyAxis, value);
        }

        /// <summary>What the village is waiting on, shown in the summary. Empty when nothing.</summary>
        public string Waiting
        {
            get => _zdo.GetString(KeyWaiting, "");
            set => _zdo.Set(KeyWaiting, value ?? "");
        }

        public IReadOnlyList<Plot> Plots
        {
            get
            {
                string raw = _zdo.GetString(Keys.Plots, "");
                if (raw != _plotsRaw)
                {
                    _plotsRaw = raw;
                    _plots = Parse(raw);
                }

                return _plots;
            }
        }

        public void AddPlot(Plot plot)
        {
            var plots = new List<Plot>(Plots) { plot };
            _zdo.Set(Keys.Plots, Serialize(plots));
        }

        private static string Serialize(List<Plot> plots)
        {
            var sb = new StringBuilder();
            foreach (Plot plot in plots)
            {
                if (sb.Length > 0)
                {
                    sb.Append(';');
                }

                sb.Append(plot.Design).Append('|')
                    .Append(F(plot.Position.x)).Append('|')
                    .Append(F(plot.Position.y)).Append('|')
                    .Append(F(plot.Position.z)).Append('|')
                    .Append(F(plot.Yaw)).Append('|')
                    .Append(F(plot.Radius)).Append('|')
                    .Append(plot.Role ?? "");
            }

            return sb.ToString();
        }

        private static List<Plot> Parse(string raw)
        {
            var plots = new List<Plot>();
            if (string.IsNullOrEmpty(raw))
            {
                return plots;
            }

            foreach (string entry in raw.Split(';'))
            {
                string[] parts = entry.Split('|');
                if (parts.Length < 6)
                {
                    continue;
                }

                plots.Add(new Plot
                {
                    Design = parts[0],
                    Position = new Vector3(P(parts[1]), P(parts[2]), P(parts[3])),
                    Yaw = P(parts[4]),
                    Radius = P(parts[5]),
                    Role = parts.Length > 6 ? parts[6] : "",
                });
            }

            return plots;
        }

        private static string F(float value) => value.ToString("0.###", CultureInfo.InvariantCulture);

        private static float P(string value) =>
            float.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out float result) ? result : 0f;
    }
}
