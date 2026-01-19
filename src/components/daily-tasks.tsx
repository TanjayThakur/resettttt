"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getToday, getStreakMultiplier } from "@/lib/utils";
import type { DailyTask } from "@/lib/supabase/types";

const TASK_XP = 5;
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DailyTasksProps {
  userId: string;
  currentStreak: number;
  onXpChange?: (xpDelta: number) => void;
}

type ProfileRow = { total_xp: number | null };
type TaskRow = { id: string };

export function DailyTasks({ userId, currentStreak, onXpChange }: DailyTasksProps) {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [recurrenceType, setRecurrenceType] = useState<"none" | "daily" | "weekly">("none");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const today = getToday();
  const multiplier = getStreakMultiplier(currentStreak);

  const loadTasks = useCallback(async () => {
    const supabase = createClient();

    // First, generate any recurring tasks for today
    await (supabase as any).rpc("generate_daily_tasks", {
      p_user_id: userId,
      p_date: today,
    });

    // Then load today's tasks
    const { data, error } = await supabase
      .from("daily_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .order("sort_order")
      .order("created_at");

    if (error) {
      console.error("Failed to load tasks:", error);
    } else {
      setTasks((data ?? []) as DailyTask[]);
    }
    setIsLoading(false);
  }, [userId, today]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleToggleTask = async (task: DailyTask) => {
    const supabase = createClient();
    const newIsDone = !task.is_done;
    const xpAmount = newIsDone ? Math.round(TASK_XP * multiplier) : 0;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              is_done: newIsDone,
              xp_awarded: xpAmount,
              completed_at: newIsDone ? new Date().toISOString() : null,
            }
          : t
      )
    );

    // Update task
    const { error: taskError } = await (supabase as any)
      .from("daily_tasks")
      .update({
        is_done: newIsDone,
        xp_awarded: xpAmount,
        completed_at: newIsDone ? new Date().toISOString() : null,
      })
      .eq("id", task.id);

    if (taskError) {
      console.error("Failed to update task:", taskError);
      toast.error("Failed to update task");
      loadTasks(); // Revert on error
      return;
    }

    // Update profile XP
    const xpDelta = newIsDone
      ? Math.round(TASK_XP * multiplier)
      : -task.xp_awarded;

    const { error: profileError } = await (supabase as any).rpc("increment_xp", {
      user_id: userId,
      xp_amount: xpDelta,
    });

    if (profileError) {
      // Fallback: update profile directly
      const { data: profile } = await supabase
        .from("profiles")
        .select("total_xp")
        .eq("id", userId)
        .maybeSingle<ProfileRow>();

      if (profile) {
        await (supabase as any)
          .from("profiles")
          .update({ total_xp: Math.max(0, (profile.total_xp || 0) + xpDelta) })
          .eq("id", userId);
      }
    }

    // Log XP
    if (newIsDone) {
      await (supabase as any).from("xp_log").insert({
        user_id: userId,
        amount: TASK_XP,
        source: "task",
        multiplier,
      });
    }

    if (newIsDone) {
      toast.success(`Task complete! +${xpAmount} XP`);
    }

    onXpChange?.(xpDelta);
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) {
      toast.error("Please enter a task title");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();

    // If recurring, create a task template first
    let taskId: string | null = null;
    if (recurrenceType !== "none") {
      const { data: taskData, error: taskError } = await (supabase as any)
        .from("tasks")
        .insert({
          user_id: userId,
          title: newTaskTitle.trim(),
          recurrence_type: recurrenceType,
          recurrence_days: recurrenceType === "weekly" ? selectedDays : [],
        })
        .select("id")
        .maybeSingle();

      if (taskError) {
        console.error("Failed to create task template:", taskError);
        toast.error("Failed to create recurring task");
        setIsSaving(false);
        return;
      }
      taskId = taskData?.id ?? null;
    }

    // Create today's task instance
    const { error } = await (supabase as any).from("daily_tasks").insert({
      user_id: userId,
      task_id: taskId,
      date: today,
      title: newTaskTitle.trim(),
      sort_order: tasks.length,
    });

    if (error) {
      console.error("Failed to add task:", error);
      toast.error("Failed to add task");
    } else {
      toast.success("Task added!");
      setNewTaskTitle("");
      setRecurrenceType("none");
      setSelectedDays([]);
      setDialogOpen(false);
      loadTasks();
    }

    setIsSaving(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    const supabase = createClient();
    const { error } = await (supabase as any).from("daily_tasks").delete().eq("id", taskId);

    if (error) {
      toast.error("Failed to delete task");
    } else {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast.success("Task deleted");
    }
  };

  const completedCount = tasks.filter((t) => t.is_done).length;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading tasks...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">Daily Tasks</CardTitle>
            <CardDescription>
              {completedCount}/{tasks.length} completed
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Add Task</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Task</DialogTitle>
                <DialogDescription>
                  Create a one-time or recurring task
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="task-title">Task Title</Label>
                  <Input
                    id="task-title"
                    placeholder="What needs to be done?"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Recurrence</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={recurrenceType === "none" ? "default" : "outline"}
                      onClick={() => setRecurrenceType("none")}
                    >
                      One-time
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={recurrenceType === "daily" ? "default" : "outline"}
                      onClick={() => setRecurrenceType("daily")}
                    >
                      Daily
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={recurrenceType === "weekly" ? "default" : "outline"}
                      onClick={() => setRecurrenceType("weekly")}
                    >
                      Weekly
                    </Button>
                  </div>
                </div>

                {recurrenceType === "weekly" && (
                  <div className="space-y-2">
                    <Label>Days of Week</Label>
                    <div className="flex gap-1 flex-wrap">
                      {DAYS_OF_WEEK.map((day, idx) => (
                        <Button
                          key={day}
                          type="button"
                          size="sm"
                          variant={selectedDays.includes(idx) ? "default" : "outline"}
                          onClick={() =>
                            setSelectedDays((prev) =>
                              prev.includes(idx)
                                ? prev.filter((d) => d !== idx)
                                : [...prev, idx]
                            )
                          }
                          className="w-10"
                        >
                          {day}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleAddTask}
                  disabled={isSaving || !newTaskTitle.trim()}
                  className="w-full"
                >
                  {isSaving ? "Adding..." : "Add Task"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length > 0 && (
          <Progress value={progress} className="h-2 mb-4" />
        )}

        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No tasks for today. Add one to get started!
          </p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-3 p-3 rounded-lg border group ${
                  task.is_done ? "bg-primary/10" : ""
                } ${task.is_top_3 ? "border-primary" : ""}`}
              >
                <Checkbox
                  checked={task.is_done}
                  onCheckedChange={() => handleToggleTask(task)}
                />
                <span
                  className={`flex-1 ${
                    task.is_done ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {task.title}
                </span>
                {task.is_top_3 && (
                  <span className="text-xs text-primary font-medium">Top 3</span>
                )}
                {task.is_done && task.xp_awarded > 0 && (
                  <span className="text-xs text-muted-foreground">
                    +{task.xp_awarded} XP
                  </span>
                )}
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3">
          +{TASK_XP} XP per task ({multiplier}x multiplier)
        </p>
      </CardContent>
    </Card>
  );
}
