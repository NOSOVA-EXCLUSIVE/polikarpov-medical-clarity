import "server-only";

import { prisma } from "@/lib/db/prisma";

const APPLICATION_DISPLAY_PREFIX = "PMC";
const MOSCOW_OFFSET_MINUTES = 180;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function getMoscowShiftedDate(date: Date) {
  return new Date(date.getTime() + MOSCOW_OFFSET_MINUTES * 60 * 1000);
}

function getMoscowDateParts(date: Date) {
  const shifted = getMoscowShiftedDate(date);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate()
  };
}

function getMoscowDayRange(date: Date) {
  const { year, month, day } = getMoscowDateParts(date);
  const startUtcMs =
    Date.UTC(year, month, day, 0, 0, 0, 0) - MOSCOW_OFFSET_MINUTES * 60 * 1000;

  return {
    start: new Date(startUtcMs),
    end: new Date(startUtcMs + DAY_IN_MS)
  };
}

function getMoscowDateKey(date: Date) {
  const { year, month, day } = getMoscowDateParts(date);
  return `${year}${pad(month + 1)}${pad(day)}`;
}

export function formatApplicationDisplayNumber(submittedAt: Date, sequence: number) {
  return `${APPLICATION_DISPLAY_PREFIX}-${getMoscowDateKey(submittedAt)}-${String(sequence).padStart(3, "0")}`;
}

function getFallbackDisplayNumber(submittedAt: Date) {
  return formatApplicationDisplayNumber(submittedAt, 1);
}

async function getSequenceMapForDay(date: Date) {
  const range = getMoscowDayRange(date);
  const applications = await prisma.application.findMany({
    where: {
      submittedAt: {
        gte: range.start,
        lt: range.end
      }
    },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    select: {
      id: true
    }
  });

  return new Map(applications.map((application, index) => [application.id, index + 1]));
}

export async function getApplicationDisplayNumber(input: {
  applicationId: string;
  submittedAt?: Date;
}) {
  const submittedAt =
    input.submittedAt ??
    (
      await prisma.application.findUnique({
        where: { id: input.applicationId },
        select: { submittedAt: true }
      })
    )?.submittedAt;

  if (!submittedAt) {
    return null;
  }

  const sequenceMap = await getSequenceMapForDay(submittedAt);
  const sequence = sequenceMap.get(input.applicationId) ?? 1;
  return formatApplicationDisplayNumber(submittedAt, sequence);
}

export async function attachApplicationDisplayNumbers<T extends { id: string; submittedAt: Date }>(
  applications: T[]
) {
  const sequenceMaps = new Map<string, Map<string, number>>();

  for (const application of applications) {
    const dateKey = getMoscowDateKey(application.submittedAt);
    if (!sequenceMaps.has(dateKey)) {
      sequenceMaps.set(dateKey, await getSequenceMapForDay(application.submittedAt));
    }
  }

  return applications.map((application) => {
    const dateKey = getMoscowDateKey(application.submittedAt);
    const sequence = sequenceMaps.get(dateKey)?.get(application.id) ?? 1;

    return {
      ...application,
      displayNumber: formatApplicationDisplayNumber(application.submittedAt, sequence)
    };
  });
}

export function getFallbackApplicationDisplayNumber(submittedAt: Date) {
  return getFallbackDisplayNumber(submittedAt);
}
