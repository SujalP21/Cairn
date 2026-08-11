import { useMemo } from "react";
import HeatMap from "@uiw/react-heat-map";

/**
 * Contribution heat map.
 *
 * NOTE: the data is generated, not real. The API has no per-day contribution
 * endpoint yet, so this renders plausible-looking activity for the last year.
 * Swap `generateActivityData` for a fetch once that endpoint exists.
 */
const generateActivityData = (startDate, endDate) => {
  const data = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    data.push({
      date: current.toISOString().split("T")[0],
      count: Math.floor(Math.random() * 12),
    });
    current.setDate(current.getDate() + 1);
  }

  return data;
};

const PANEL_COLORS = {
  0: "#161b22",
  3: "#0e4429",
  6: "#006d32",
  9: "#26a641",
  12: "#39d353",
};

const HeatMapProfile = () => {
  const { data, startDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1);

    return { data: generateActivityData(start, end), startDate: start };
  }, []);

  return (
    <div className="stack">
      <div className="spread">
        <h3>Contribution activity</h3>
        <span className="badge">Sample data</span>
      </div>

      <HeatMap
        className="HeatMapProfile"
        style={{ minWidth: 720, color: "var(--text-muted)" }}
        value={data}
        weekLabels={["", "Mon", "", "Wed", "", "Fri", ""]}
        startDate={startDate}
        rectSize={11}
        space={3}
        rectProps={{ rx: 2 }}
        panelColors={PANEL_COLORS}
        legendCellSize={0}
      />
    </div>
  );
};

export default HeatMapProfile;
