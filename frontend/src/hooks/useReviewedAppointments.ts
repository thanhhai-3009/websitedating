import { useState } from "react";

const STORAGE_KEY = "reviewedAppointments";

const load = (): number[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
};

export const useReviewedAppointments = () => {
  const [reviewed, setReviewed] = useState<number[]>(load);

  const markReviewed = (id: number) => {
    setReviewed((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const isReviewed = (id: number) => reviewed.includes(id);

  return { isReviewed, markReviewed };
};
