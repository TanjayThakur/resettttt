"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getToday } from "@/lib/utils";
import type { TimeBlock, Database } from "@/lib/supabase/types";
import Link from "next/link";

const CATEGORIES = [
  { id: "deep_work", label: "Deep Work", color: "bg-green-500" },
  { id: "shallow_work", label: "Shallow Work", color: "bg-blue-500" },
  { id: "meeting", label: "Meeting", color: "bg-purple-500" },
  { id: "break", label: "Break", color: "bg-yellow-500" },
  { id: "distraction", label: "Distraction", color: "bg-red-500" },
  { id: "other", label: "Other", color: "bg-gray-500" },
];

// Generate 30-min time blocks from 6 AM to 10 PM
const TIME_BLOCKS = Array.from({ length: 32 }, (_, i) => {
  const hour = Math.floor(i / 2) + 6;
  const minute = (i % 2) * 30;
  return {
    number: i + 1,
    time: `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
    label: `${hour > 12 ? hour - 12 : hour}:${minute.toString().padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`,
  };
});

export default function TrackerPage() {
  const router = useRouter();
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeBlock, setActiveBlock] = useState<number | null>(null);
  const [activity, setActivity] = useState("");
  const [category, setCategory] = useState("deep_work");
  const [isSaving, setIsSaving] = useState(false);

  const getCurrentBlockNumber = useCallback(() => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    if (hour < 6 || hour >= 22) return null;
    const blocksSince6AM = (hour - 6) * 2 + (minute >= 30 ? 1 : 0);
    return blocksSince6AM + 1;
  }, []);

  useEffect(() => {
    loadData();
    // Update current block every minute
    const interval = setInterval(() => {
      setActiveBlock(getCurrentBlockNumber());
    }, 60000);
    return () => clearInterval(interval);
  }, [getCurrentBlockNumber]);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/signin");
      return;
    }

    const today = getToday();

    const { data: blocks } = await supabase
      .from("time_blocks")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .order("block_number");

    setTimeBlocks((blocks as TimeBlock[]) ?? []);
    setActiveBlock(getCurrentBlockNumber());
    setIsLoading(false);
  };

  const saveBlock = async (blockNumber: number) => {
    if (!activity.trim()) {
      toast.error("Please enter what you were doing");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/signin");
      return;
    }

    const today = getToday();
    const block = TIME_BLOCKS.find(b => b.number === blockNumber);

    // Check if block already exists
    const existing = timeBlocks.find(b => b.block_number === blockNumber);

    if (existing) {
      await (supabase
        .from("time_blocks") as ReturnType<typeof supabase.from>)
        .update({
          activity: activity.trim(),
          category,
        } as Database["public"]["Tables"]["time_blocks"]["Update"])
        .eq("id", existing.id);
    } else {
      await (supabase
        .from("time_blocks") as ReturnType<typeof supabase.from>)
        .insert({
          user_id: user.id,
          date: today,
          block_number: blockNumber,
          start_time: block?.time ?? "00:00",
          activity: activity.trim(),
          category,
        } as Database["public"]["Tables"]["time_blocks"]["Insert"]);
    }

    toast.success("Block saved!");
    setActivity("");
    setCategory("deep_work");
    await loadData();
    setIsSaving(false);
  };

  const getBlockData = (blockNumber: number) => {
    return timeBlocks.find(b => b.block_number === blockNumber);
  };

  const getCategoryColor = (categoryId: string) => {
    return CATEGORIES.find(c => c.id === categoryId)?.color ?? "bg-gray-500";
  };

  // Calculate daily stats
  const stats = timeBlocks.reduce((acc, block) => {
    acc[block.category] = (acc[block.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const deepWorkHours = (stats.deep_work || 0) * 0.5;
  const distractionHours = (stats.distraction || 0) * 0.5;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">30-Min Tracker</h1>
            <p className="text-muted-foreground text-sm">
              Track what you do in 30-minute blocks
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back</Link>
          </Button>
        </div>

        {/* Daily Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Deep Work</CardDescription>
              <CardTitle className="text-2xl text-green-500">{deepWorkHours}h</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Blocks Logged</CardDescription>
              <CardTitle className="text-2xl">{timeBlocks.length}/32</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Distractions</CardDescription>
              <CardTitle className="text-2xl text-red-500">{distractionHours}h</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Quick Log Current Block */}
        {activeBlock && (
          <Card className="mb-6 border-primary">
            <CardHeader>
              <CardTitle className="text-lg">Log Current Block</CardTitle>
              <CardDescription>
                {TIME_BLOCKS.find(b => b.number === activeBlock)?.label} - What are you working on?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="What were you doing?"
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={category === cat.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCategory(cat.id)}
                    className={category === cat.id ? cat.color : ""}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
              <Button
                onClick={() => saveBlock(activeBlock)}
                disabled={isSaving}
                className="w-full"
              >
                {isSaving ? "Saving..." : "Log Block"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Time Block Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Today&apos;s Timeline</CardTitle>
            <CardDescription>Click any block to log or edit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
              {TIME_BLOCKS.map((block) => {
                const data = getBlockData(block.number);
                const isCurrent = block.number === activeBlock;
                const isPast = activeBlock ? block.number < activeBlock : false;

                return (
                  <div
                    key={block.number}
                    className={`p-2 rounded-lg border text-center cursor-pointer transition-all ${
                      isCurrent ? "ring-2 ring-primary" : ""
                    } ${data ? getCategoryColor(data.category) + " text-white" : isPast ? "bg-muted" : "bg-background hover:bg-accent"}`}
                    onClick={() => {
                      if (data) {
                        setActivity(data.activity ?? "");
                        setCategory(data.category);
                      }
                      setActiveBlock(block.number);
                    }}
                    title={data?.activity ?? "Not logged"}
                  >
                    <p className="text-xs font-medium">{block.label}</p>
                    {data && (
                      <p className="text-xs truncate mt-1">{data.activity}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
              {CATEGORIES.map((cat) => (
                <div key={cat.id} className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded ${cat.color}`} />
                  <span className="text-xs text-muted-foreground">{cat.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
