import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

export function getSundayOfWeek(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

export function isSunday(): boolean {
  return new Date().getDay() === 0;
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
  { number: 1, time: "9:00 AM", hour: 9 },
  { number: 2, time: "11:00 AM", hour: 11 },
  { number: 3, time: "1:00 PM", hour: 13 },
  { number: 4, time: "3:00 PM", hour: 15 },
  { number: 5, time: "5:00 PM", hour: 17 },
  { number: 6, time: "7:00 PM", hour: 19 },
] as const;

export function getCurrentInterruptNumber(): number | null {
  const hour = new Date().getHours();
  for (let i = INTERRUPT_TIMES.length - 1; i >= 0; i--) {
    if (hour >= INTERRUPT_TIMES[i].hour) {
      return INTERRUPT_TIMES[i].number;
    }
  }
  return null;
}
