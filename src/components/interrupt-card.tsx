"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  getTodayIST,
  getISTHour,
  getNowIST,
  getNextPendingInterrupt,
  getNextInterruptTime,
  getCurrentInterruptNumber,
  INTERRUPT_TIMES,
} from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InterruptCardProps {
  userId: string;
  initialCompletedNumbers: number[];
}

export function InterruptCard({ userId, initialCompletedNumbers }: InterruptCardProps) {
  const router = useRouter();
  const [completedNumbers, setCompletedNumbers] = useState<number[]>(initialCompletedNumbers);
  const [currentInterruptNum, setCurrentInterruptNum] = useState<number | null>(null);
  const [nextInterrupt, setNextInterrupt] = useState<number | null>(null);
  const [nextInterruptTime, setNextInterruptTime] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [pendingInterrupt, setPendingInterrupt] = useState<{
    interruptNumber: number;
    isOverdue: boolean;
    scheduledTime: string;
  } | null>(null);
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
  const fetchCompletedInterrupts = useCallback(async (): Promise<number[]> => {
    const supabase = createClient();
    const today = getTodayIST();

    const { data } = await supabase
      .from("interrupt_entries")
      .select("interrupt_number")
      .eq("user_id", userId)
      .eq("entry_date", today);

    if (data && data.length > 0) {
      return data.map((d: { interrupt_number: number }) => d.interrupt_number);
    }
    return [];
  }, [userId]);

  // Main check function - runs every 30 seconds
  const checkInterrupts = useCallback(async () => {
    const todayIST = getTodayIST();

    // Check if day changed (midnight rollover)
    if (lastCheckDateRef.current !== todayIST) {
      lastCheckDateRef.current = todayIST;
      hasTriggeredRef.current = null;
      setCompletedNumbers([]);
    }

    // Update current interrupt number based on IST time
    const currentNum = getCurrentInterruptNumber();
    setCurrentInterruptNum(currentNum);

    // Fetch latest completed interrupts
    const latestCompleted = await fetchCompletedInterrupts();
    setCompletedNumbers(latestCompleted);

    // Calculate next interrupt that can be done
    if (currentNum) {
      for (let i = 1; i <= currentNum; i++) {
        if (!latestCompleted.includes(i)) {
          setNextInterrupt(i);
          break;
        }
      }
      // Check if all up to current are complete
      const allCurrentComplete = Array.from({ length: currentNum }, (_, i) => i + 1)
        .every(n => latestCompleted.includes(n));
      if (allCurrentComplete) {
        setNextInterrupt(null);
      }
    } else {
      setNextInterrupt(null);
    }

    // Calculate next interrupt time for display
    const nextTime = getNextInterruptTime(latestCompleted);
    setNextInterruptTime(nextTime);

    // Check if there's a pending interrupt that should trigger a modal
    const pending = getNextPendingInterrupt(latestCompleted);

    if (pending) {
      setPendingInterrupt(pending);

      // Only show modal if we haven't already triggered for this interrupt
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
    // Reset trigger so it can fire again on next check cycle
    setTimeout(() => {
      hasTriggeredRef.current = null;
    }, 60000); // Re-enable after 1 minute
  };

  const completedInterrupts = completedNumbers.length;
  const allComplete = completedInterrupts === 6;

  return (
    <>
      <Card className={allComplete ? "border-primary/50" : ""}>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">Interrupts</CardTitle>
              <CardDescription>{completedInterrupts}/6 completed today</CardDescription>
            </div>
            {allComplete ? (
              <Badge variant="secondary">All Done</Badge>
            ) : nextInterrupt ? (
              <Badge>Pending</Badge>
            ) : currentInterruptNum ? (
              <Badge variant="secondary">Caught Up</Badge>
            ) : (
              <Badge variant="outline">Waiting</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            {INTERRUPT_TIMES.map((t) => (
              <div
                key={t.number}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all ${
                  completedNumbers.includes(t.number)
                    ? "bg-primary text-primary-foreground"
                    : t.number === nextInterrupt
                    ? "bg-accent border-2 border-primary animate-pulse"
                    : currentInterruptNum && t.number <= currentInterruptNum
                    ? "bg-destructive/20 text-destructive"
                    : "bg-muted"
                }`}
              >
                {t.number}
              </div>
            ))}
          </div>
          {nextInterrupt ? (
            <Button asChild className="w-full">
              <Link href="/interrupt">Complete Interrupt #{nextInterrupt}</Link>
            </Button>
          ) : allComplete ? (
            <p className="text-sm text-muted-foreground text-center">
              All interrupts complete!
            </p>
          ) : nextInterruptTime ? (
            <p className="text-sm text-muted-foreground text-center">
              Next interrupt at {nextInterruptTime}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              First interrupt at 9:00 AM
            </p>
          )}
        </CardContent>
      </Card>

      {/* Interrupt Trigger Modal */}
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
