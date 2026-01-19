"use client";

import { useMemo } from "react";

interface HeatmapCalendarProps {
  data: { date: string; count: number }[];
  days?: number;
}

export function HeatmapCalendar({ data, days = 90 }: HeatmapCalendarProps) {
  const { grid, weeks, months } = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days + 1);

    // Adjust to start on Sunday
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    const dataMap = new Map(data.map((d) => [d.date, d.count]));

    const grid: { date: string; count: number; dayOfWeek: number }[][] = [];
    const months: { name: string; startWeek: number }[] = [];
    let currentDate = new Date(startDate);
    let weekIndex = 0;
    let lastMonth = -1;

    while (currentDate <= today) {
      const week: { date: string; count: number; dayOfWeek: number }[] = [];

      for (let i = 0; i < 7; i++) {
        const dateStr = currentDate.toISOString().split("T")[0];
        const isFuture = currentDate > today;

        // Track month changes
        const month = currentDate.getMonth();
        if (month !== lastMonth && !isFuture) {
          months.push({
            name: currentDate.toLocaleDateString("en-US", { month: "short" }),
            startWeek: weekIndex,
          });
          lastMonth = month;
        }

        week.push({
          date: dateStr,
          count: isFuture ? -1 : (dataMap.get(dateStr) ?? 0),
          dayOfWeek: i,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      grid.push(week);
      weekIndex++;
    }

    return { grid, weeks: grid.length, months };
  }, [data, days]);

  const getColor = (count: number) => {
    if (count < 0) return "bg-transparent";
    if (count === 0) return "bg-muted";
    if (count === 1) return "bg-primary/30";
    if (count === 2) return "bg-primary/50";
    if (count === 3) return "bg-primary/70";
    return "bg-primary";
  };

  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        {/* Month labels */}
        <div className="flex mb-1 text-xs text-muted-foreground">
          <div className="w-4" />
          {months.map((month, i) => (
            <div
              key={`${month.name}-${i}`}
              className="text-xs"
              style={{
                marginLeft: i === 0 ? 0 : `${(month.startWeek - (months[i - 1]?.startWeek ?? 0) - 1) * 14}px`,
              }}
            >
              {month.name}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex gap-0.5">
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 mr-1">
            {["", "M", "", "W", "", "F", ""].map((label, i) => (
              <div
                key={i}
                className="w-3 h-3 text-xs text-muted-foreground flex items-center justify-center"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Cells */}
          {grid.map((week, weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-0.5">
              {week.map((day) => (
                <div
                  key={day.date}
                  className={`w-3 h-3 rounded-sm ${getColor(day.count)}`}
                  title={day.count >= 0 ? `${day.date}: ${day.count} activities` : ""}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="w-3 h-3 rounded-sm bg-muted" />
          <div className="w-3 h-3 rounded-sm bg-primary/30" />
          <div className="w-3 h-3 rounded-sm bg-primary/50" />
          <div className="w-3 h-3 rounded-sm bg-primary/70" />
          <div className="w-3 h-3 rounded-sm bg-primary" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
