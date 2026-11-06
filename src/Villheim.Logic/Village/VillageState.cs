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

        /// <summary>Wood in the village stock.</summary>
        public int Wood
        {
            get => _zdo.GetInt(KeyWood);
            set => _zdo.Set(KeyWood, Mathf.Max(0, value));
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
