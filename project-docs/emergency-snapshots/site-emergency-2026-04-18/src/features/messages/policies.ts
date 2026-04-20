import type { MessageMode, ProductCode } from "@prisma/client";

export const MESSAGE_POLICY_BY_PRODUCT: Record<
  ProductCode,
  {
    mode: MessageMode;
    clarificationWindowHours: number | null;
    patientMessageLimit: number | null;
  }
> = {
  SECOND_OPINION: {
    mode: "CLARIFICATION_WINDOW",
    clarificationWindowHours: 72,
    patientMessageLimit: 3
  },
  MEDICAL_ROUTE: {
    mode: "CLARIFICATION_WINDOW",
    clarificationWindowHours: 168,
    patientMessageLimit: 5
  },
  RECOVERY_4_WEEKS: {
    mode: "SUPPORT_PACKAGE",
    clarificationWindowHours: null,
    patientMessageLimit: null
  },
  PERSONAL_SUPPORT: {
    mode: "SUPPORT_PACKAGE",
    clarificationWindowHours: null,
    patientMessageLimit: null
  }
};
