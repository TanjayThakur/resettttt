"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getTodayIST,
  getISTHour,
  getNextPendingInterrupt,
  getNextInterruptTime,
  INTERRUPT_TIMES,
  getNowIST,
} from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface InterruptSchedulerProps {
  userId: string;
  initialCompletedNumbers: number[];
}

export function InterruptScheduler({
  userId,
  initialCompletedNumbers,
}: InterruptSchedulerProps) {
  const router = useRouter();
  const [completedNumbers, setCompletedNumbers] = useState<number[]>(initialCompletedNumbers);
  const [showModal, setShowModal] = useState(false);
  const [pendingInterrupt, setPendingInterrupt] = useState<{
    interruptNumber: number;
    isOverdue: boolean;
    scheduledTime: string;
  } | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [nextInterruptTime, setNextInterruptTime] = useState<string | null>(null);
  const hasTriggeredRef = useRef<number | null>(null);
  const lastCheckDateRef = useRef<string>(getTodayIST());

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Send browser notification
  const sendNotification = useCallback((interruptNum: number, scheduledTime: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      const notification = new Notification(`Interrupt #${interruptNum} is ready!`, {
        body: `Time for your ${scheduledTime} reflection. Take a moment to check in with yourself.`,
        icon: "/icon-192x192.png",
        tag: `interrupt-${interruptNum}`,
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        router.push("/interrupt");
        notification.close();
      };
    }
  }, [router]);

  // Fetch latest completed interrupts from database
  const fetchCompletedInterrupts = useCallback(async () => {
    const supabase = createClient();
    const today = getTodayIST();

    const { data } = await supabase
      .from("interrupt_entries")
      .select("interrupt_number")
      .eq("user_id", userId)
      .eq("entry_date", today);

    if (data && data.length > 0) {
      const numbers = data.map((d: { interrupt_number: number }) => d.interrupt_number);
      setCompletedNumbers(numbers);
      return numbers;
    }
    return completedNumbers;
  }, [userId, completedNumbers]);

  // Main check function - runs every 30 seconds
  const checkInterrupts = useCallback(async () => {
    const istNow = getNowIST();
    const todayIST = getTodayIST();

    // Update display time
    setCurrentTime(
      istNow.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      })
    );

    // Check if day changed (midnight rollover)
    if (lastCheckDateRef.current !== todayIST) {
      lastCheckDateRef.current = todayIST;
      hasTriggeredRef.current = null;
      setCompletedNumbers([]);
    }

    // Fetch latest completed interrupts
    const latestCompleted = await fetchCompletedInterrupts();

    // Calculate next interrupt time for display
    const nextTime = getNextInterruptTime(latestCompleted);
    setNextInterruptTime(nextTime);

    // Check if there's a pending interrupt that should trigger
    const pending = getNextPendingInterrupt(latestCompleted);

    if (pending) {
      setPendingInterrupt(pending);

      // Only show modal if we haven't already triggered for this interrupt
      // and the modal isn't already showing
      if (
        hasTriggeredRef.current !== pending.interruptNumber &&
        !showModal
      ) {
        hasTriggeredRef.current = pending.interruptNumber;
        setShowModal(true);
        sendNotification(pending.interruptNumber, pending.scheduledTime);
      }
    } else {
      setPendingInterrupt(null);
    }
  }, [fetchCompletedInterrupts, showModal, sendNotification]);

  // Initial check on mount and set up interval
  useEffect(() => {
    // Check immediately on mount (catch-up logic)
    checkInterrupts();

    // Check every 30 seconds
    const intervalId = setInterval(checkInterrupts, 30000);

    // Also check when tab becomes visible (handles inactive tab scenario)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkInterrupts();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Also check on window focus
    const handleFocus = () => {
      checkInterrupts();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkInterrupts]);

  // Handle "Start Interrupt" button
  const handleStartInterrupt = () => {
    setShowModal(false);
    router.push("/interrupt");
  };

  // Handle "Remind Me Later" button
  const handleRemindLater = () => {
    setShowModal(false);
    // Reset trigger so it can fire again on next check
    hasTriggeredRef.current = null;
  };

  // Get current hour for status display
  const currentHour = getISTHour();
  const allComplete = completedNumbers.length === 6;
  const beforeFirstInterrupt = currentHour < 9;

  return (
    <>
      {/* Interrupt Status Display - can be used anywhere */}
      <div className="text-xs text-muted-foreground space-y-1">
        {currentTime && (
          <p>Current time (IST): {currentTime}</p>
        )}
        {!allComplete && nextInterruptTime && (
          <p>
            Next interrupt: {nextInterruptTime}
            {pendingInterrupt && pendingInterrupt.isOverdue && (
              <span className="text-destructive ml-1">(Overdue!)</span>
            )}
          </p>
        )}
      </div>

      {/* Interrupt Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              Interrupt #{pendingInterrupt?.interruptNumber}
            </DialogTitle>
            <DialogDescription>
              {pendingInterrupt?.isOverdue ? (
                <>
                  Your {pendingInterrupt.scheduledTime} interrupt is overdue.
                  Take a moment to reflect now.
                </>
              ) : (
                <>
                  It&apos;s time for your {pendingInterrupt?.scheduledTime} interrupt.
                  Take a brief pause to check in with yourself.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Progress indicator */}
          <div className="flex justify-center gap-2 py-4">
            {INTERRUPT_TIMES.map((t) => (
              <div
                key={t.number}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  completedNumbers.includes(t.number)
                    ? "bg-primary text-primary-foreground"
                    : t.number === pendingInterrupt?.interruptNumber
                    ? "bg-accent border-2 border-primary animate-pulse"
                    : "bg-muted"
                }`}
              >
                {t.number}
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleRemindLater}>
              Remind Me Later
            </Button>
            <Button onClick={handleStartInterrupt}>
              Start Interrupt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
