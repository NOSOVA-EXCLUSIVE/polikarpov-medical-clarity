export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export type RequestedProductValue =
  | "SECOND_OPINION"
  | "MEDICAL_ROUTE"
  | "RECOVERY_4_WEEKS"
  | "PERSONAL_SUPPORT"
  | "NOT_SURE";

export type PreferredContactValue = "EMAIL" | "PHONE" | "WHATSAPP" | "TELEGRAM";
export type UploadCategoryValue = "DOCUMENT" | "IMAGE" | "VIDEO";
export type ExternalLinkKindValue = "IMAGING" | "VIDEO" | "CLOUD";

export type RedFlagsState = {
  hasFever: boolean;
  hasAcuteSwelling: boolean;
  unableToBearWeight: boolean;
  hasNumbness: boolean;
  hasWeakness: boolean;
  hasBladderOrBowelSymptoms: boolean;
  hasChestPain: boolean;
  hasShortnessOfBreath: boolean;
  hasConfusion: boolean;
};

export type PatientState = {
  fullName: string;
  age: string;
  email: string;
  phone: string;
  preferredContact: PreferredContactValue;
  country: string;
  city: string;
  timezone: string;
};

export type SituationState = {
  chiefComplaint: string;
  symptomStarted: string;
  symptomProgression: string;
  alreadyDone: string;
  diagnosesFromDoctors: string;
  differentOpinions: string;
  priorOperations: string;
};

export type MedicalContextState = {
  chronicConditions: string;
  medications: string;
  allergies: string;
  pastInjuries: string;
};

export type UploadDraftState = {
  id: string;
  category: UploadCategoryValue;
  originalName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  durationSeconds?: number | null;
  storageKey: string;
  accessPassword?: string | null;
  accessInstructions?: string | null;
};

export type LinkDraftState = {
  id: string;
  kind: ExternalLinkKindValue;
  url: string;
  label?: string | null;
  note?: string | null;
  accessPassword?: string | null;
  accessInstructions?: string | null;
};

export type LegalState = {
  acceptedOffer: boolean;
  acceptedPrivacy: boolean;
  acceptedConsent: boolean;
  confirmedInformationAccuracy: boolean;
};

export type QuestionnaireWizardState = {
  requestedProductCode: RequestedProductValue;
  isAdult: boolean;
  confirmsNonEmergency: boolean;
  redFlags: RedFlagsState;
  patient: PatientState;
  situation: SituationState;
  medicalContext: MedicalContextState;
  reviewNoteForDoctor: string;
  uploads: UploadDraftState[];
  externalLinks: LinkDraftState[];
  legal: LegalState;
};

export const wizardSteps: ReadonlyArray<{
  step: WizardStep;
  number: string;
  title: string;
  description: string;
}> = [
  {
    step: 1,
    number: "01",
    title: "Перед началом",
    description: "Безопасность и стартовый формат"
  },
  {
    step: 2,
    number: "02",
    title: "Контакты",
    description: "Как с вами связаться"
  },
  {
    step: 3,
    number: "03",
    title: "Ситуация",
    description: "Что происходит сейчас"
  },
  {
    step: 4,
    number: "04",
    title: "Медицинский контекст",
    description: "Фон и ограничения"
  },
  {
    step: 5,
    number: "05",
    title: "Материалы",
    description: "Файлы и ссылки на исследования"
  },
  {
    step: 6,
    number: "06",
    title: "Подтверждение",
    description: "Финальная проверка и отправка"
  }
] as const;

export function createInitialWizardState(
  requestedProductCode: RequestedProductValue
): QuestionnaireWizardState {
  return {
    requestedProductCode,
    isAdult: false,
    confirmsNonEmergency: false,
    redFlags: {
      hasFever: false,
      hasAcuteSwelling: false,
      unableToBearWeight: false,
      hasNumbness: false,
      hasWeakness: false,
      hasBladderOrBowelSymptoms: false,
      hasChestPain: false,
      hasShortnessOfBreath: false,
      hasConfusion: false
    },
    patient: {
      fullName: "",
      age: "",
      email: "",
      phone: "",
      preferredContact: "EMAIL",
      country: "",
      city: "",
      timezone:
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Moscow"
          : "Europe/Moscow"
    },
    situation: {
      chiefComplaint: "",
      symptomStarted: "",
      symptomProgression: "",
      alreadyDone: "",
      diagnosesFromDoctors: "",
      differentOpinions: "",
      priorOperations: ""
    },
    medicalContext: {
      chronicConditions: "",
      medications: "",
      allergies: "",
      pastInjuries: ""
    },
    reviewNoteForDoctor: "",
    uploads: [],
    externalLinks: [],
    legal: {
      acceptedOffer: false,
      acceptedPrivacy: false,
      acceptedConsent: false,
      confirmedInformationAccuracy: false
    }
  };
}

export function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function trimValue(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimValue(value));
}

export function isValidPhone(value: string) {
  return trimValue(value).replace(/[^\d]/g, "").length >= 6;
}

export function isValidAge(value: string) {
  const parsed = Number.parseInt(trimValue(value), 10);
  return Number.isFinite(parsed) && parsed >= 18 && parsed <= 120;
}

export function isValidFullName(value: string) {
  return trimValue(value).length >= 2;
}

export function isValidChiefComplaint(value: string) {
  return hasText(value);
}

export function hasAnySituationContent(state: SituationState) {
  return [
    state.chiefComplaint,
    state.symptomStarted,
    state.symptomProgression,
    state.alreadyDone,
    state.diagnosesFromDoctors,
    state.differentOpinions,
    state.priorOperations
  ].some(hasText);
}

export function isValidUrl(value: string) {
  try {
    new URL(trimValue(value));
    return true;
  } catch {
    return false;
  }
}

export function hasBlockingRedFlags(redFlags: RedFlagsState) {
  return Object.values(redFlags).some(Boolean);
}

export function getInvalidExternalLinkCount(state: QuestionnaireWizardState) {
  return state.externalLinks.filter((item) => hasText(item.url) && !isValidUrl(item.url)).length;
}

export function canContinueFromStep(
  step: WizardStep,
  state: QuestionnaireWizardState,
  options?: {
    invalidExternalLinks?: number;
    uploadingInProgress?: boolean;
  }
) {
  switch (step) {
    case 1:
      return state.isAdult && state.confirmsNonEmergency && !hasBlockingRedFlags(state.redFlags);
    case 2:
      return (
        isValidFullName(state.patient.fullName) &&
        hasText(state.patient.country) &&
        hasText(state.patient.city) &&
        isValidEmail(state.patient.email) &&
        isValidPhone(state.patient.phone) &&
        hasText(state.patient.preferredContact) &&
        hasText(state.patient.timezone)
      );
    case 3:
      return hasAnySituationContent(state.situation);
    case 4:
      return true;
    case 5:
      return !options?.uploadingInProgress && (options?.invalidExternalLinks ?? 0) === 0;
    case 6:
      return Object.values(state.legal).every(Boolean);
    default:
      return false;
  }
}

export function nextStep(step: WizardStep): WizardStep {
  return Math.min(6, step + 1) as WizardStep;
}

export function previousStep(step: WizardStep): WizardStep {
  return Math.max(1, step - 1) as WizardStep;
}

export function normalizeRequestedProductForSelection(input: {
  currentValue: RequestedProductValue;
  optionValue: RequestedProductValue;
  queryRequestedProduct: RequestedProductValue;
}) {
  const isSupportOption = input.optionValue === "RECOVERY_4_WEEKS";
  const isSelected = isSupportOption
    ? input.currentValue === "RECOVERY_4_WEEKS" || input.currentValue === "PERSONAL_SUPPORT"
    : input.currentValue === input.optionValue;

  const nextValue =
    isSupportOption && input.queryRequestedProduct === "PERSONAL_SUPPORT"
      ? "PERSONAL_SUPPORT"
      : input.optionValue;

  return {
    isSelected,
    nextValue
  };
}
