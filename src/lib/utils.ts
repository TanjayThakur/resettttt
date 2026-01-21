import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================
// IST Timezone Utilities (Asia/Kolkata UTC+5:30)
// ============================================

/**
 * Get the current Date object representing IST time
 * Works consistently across server/client and any timezone
 */
export function getNowIST(): Date {
  // Get current UTC time, then convert to IST (UTC+5:30)
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istOffset = 5.5 * 60 * 60000; // 5 hours 30 minutes in ms
  return new Date(utc + istOffset);
}

/**
 * Get current hour in IST (0-23)
 */
export function getISTHour(): number {
  return getNowIST().getHours();
}

/**
 * Get current minutes in IST (0-59)
 */
export function getISTMinutes(): number {
  return getNowIST().getMinutes();
}

/**
 * Get today's date in IST as YYYY-MM-DD string
 * This is the SOURCE OF TRUTH for "today" across the app
 */
export function getTodayIST(): string {
  const istNow = getNowIST();
  const year = istNow.getFullYear();
  const month = String(istNow.getMonth() + 1).padStart(2, '0');
  const day = String(istNow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Legacy function - now uses IST
 * @deprecated Use getTodayIST() directly
 */
export function getToday(): string {
  return getTodayIST();
}

/**
 * Get Sunday of the week for a given IST date
 */
export function getSundayOfWeek(date: Date = getNowIST()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const dayStr = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayStr}`;
}

/**
 * Check if today is Sunday in IST
 */
export function isSunday(): boolean {
  return getNowIST().getDay() === 0;
}

export function getStreakMultiplier(streak: number): number {
  if (streak >= 31) return 2.5;
  if (streak >= 15) return 2.0;
  if (streak >= 8) return 1.5;
  return 1.0;
}

export const XP_VALUES = {
  MORNING: 50,
  INTERRUPT: 10,
  ALL_INTERRUPTS_BONUS: 100,
  NIGHT: 50,
  WEEKLY: 200,
} as const;

export const INTERRUPT_TIMES = [
  { number: 1, time: "9:00 AM", hour: 9, minute: 0 },
  { number: 2, time: "11:00 AM", hour: 11, minute: 0 },
  { number: 3, time: "1:00 PM", hour: 13, minute: 0 },
  { number: 4, time: "3:00 PM", hour: 15, minute: 0 },
  { number: 5, time: "5:00 PM", hour: 17, minute: 0 },
  { number: 6, time: "7:00 PM", hour: 19, minute: 0 },
] as const;

/**
 * Get the current interrupt number based on IST time
 * Returns the highest interrupt number that has passed (or is current)
 * Returns null if it's before 9 AM IST
 */
export function getCurrentInterruptNumber(): number | null {
  const hour = getISTHour();
  for (let i = INTERRUPT_TIMES.length - 1; i >= 0; i--) {
    if (hour >= INTERRUPT_TIMES[i].hour) {
      return INTERRUPT_TIMES[i].number;
    }
  }
  return null;
}

/**
 * Get the next pending interrupt that should be triggered
 * Returns null if all interrupts are completed or none are due yet
 */
export function getNextPendingInterrupt(completedNumbers: number[]): {
  interruptNumber: number;
  isOverdue: boolean;
  scheduledTime: string;
} | null {
  const hour = getISTHour();
  const currentInterruptNum = getCurrentInterruptNumber();

  if (!currentInterruptNum) {
    return null; // Before 9 AM
  }

  // Find first uncompleted interrupt up to current time
  for (let i = 1; i <= currentInterruptNum; i++) {
    if (!completedNumbers.includes(i)) {
      const interruptInfo = INTERRUPT_TIMES.find(t => t.number === i);
      return {
        interruptNumber: i,
        isOverdue: hour > (interruptInfo?.hour ?? 0),
        scheduledTime: interruptInfo?.time ?? "",
      };
    }
  }

  return null;
}

/**
 * Get the next upcoming interrupt time (for display)
 * Returns the next interrupt that hasn't been completed yet
 */
export function getNextInterruptTime(completedNumbers: number[]): string | null {
  // Find the first uncompleted interrupt
  for (const interrupt of INTERRUPT_TIMES) {
    if (!completedNumbers.includes(interrupt.number)) {
      return interrupt.time;
    }
  }
  return null; // All completed
}

/**
 * Calculate milliseconds until the next interrupt should trigger
 * Used for setTimeout scheduling
 */
export function getMsUntilNextInterrupt(completedNumbers: number[]): number | null {
  const istNow = getNowIST();
  const currentHour = istNow.getHours();
  const currentMinutes = istNow.getMinutes();
  const currentSeconds = istNow.getSeconds();

  // Find next uncompleted interrupt
  for (const interrupt of INTERRUPT_TIMES) {
    if (!completedNumbers.includes(interrupt.number)) {
      if (currentHour < interrupt.hour) {
        // Future interrupt - calculate ms until then
        const hoursUntil = interrupt.hour - currentHour;
        const minutesUntil = -currentMinutes;
        const secondsUntil = -currentSeconds;
        const msUntil = (hoursUntil * 60 * 60 + minutesUntil * 60 + secondsUntil) * 1000;
        return Math.max(0, msUntil);
      } else if (currentHour >= interrupt.hour) {
        // This interrupt is overdue - trigger immediately
        return 0;
      }
    }
  }

  return null; // All completed or past 7 PM
}
