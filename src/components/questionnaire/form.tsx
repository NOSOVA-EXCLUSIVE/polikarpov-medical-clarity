"use client";

import type { Route } from "next";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type {
  ExternalImagingLinkInput,
  QuestionnaireSubmitInput,
  UploadDescriptorInput
} from "@/features/questionnaire/schemas";
import { classifyImagingSourceType } from "@/features/questionnaire/status";
import { publicProducts } from "@/features/products/catalog";
import { VIDEO_UPLOAD_POLICY } from "@/features/uploads/policies";

import {
  canContinueFromStep,
  createInitialWizardState,
  getInvalidExternalLinkCount,
  hasBlockingRedFlags,
  hasText,
  nextStep,
  normalizeRequestedProductForSelection,
  previousStep,
  trimValue,
  type LinkDraftState,
  type QuestionnaireWizardState,
  type RequestedProductValue,
  type UploadDraftState,
  type UploadCategoryValue,
  type WizardStep,
  wizardSteps
} from "./wizard-logic";

type SuccessState = {
  submissionId: string;
  status: string;
  preferredContactLabel: string;
};

type SubmitSuccessResponse = {
  success: true;
  submissionId: string;
  status: string;
};

type SubmitErrorResponse = {
  success: false;
  error?: string;
  redirectTo?: string;
};

type ExtendedQuestionnaireState = QuestionnaireWizardState & {
  legal: QuestionnaireWizardState["legal"] & {
    acceptedMedicalData: boolean;
  };
};

const confirmationCheckboxStyle = {
  width: 18,
  height: 18,
  minWidth: 18,
  minHeight: 18,
  flexShrink: 0,
  marginTop: "0.2rem"
} as const;

const preferredContactOptions = [
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Телефон" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "TELEGRAM", label: "Telegram" }
] as const;

function getPreferredContactLabel(value: QuestionnaireWizardState["patient"]["preferredContact"]) {
  return preferredContactOptions.find((option) => option.value === value)?.label ?? value;
}

function createInitialFormState(requestedProduct: RequestedProductValue): ExtendedQuestionnaireState {
  const initialState = createInitialWizardState(requestedProduct);

  return {
    ...initialState,
    legal: {
      ...initialState.legal,
      acceptedMedicalData: false
    }
  };
}

const formatOptions: Array<{
  value: RequestedProductValue;
  label: string;
}> = [
  { value: "NOT_SURE", label: "Не уверен(а), хочу разобраться в ситуации" },
  { value: "SECOND_OPINION", label: "Второе мнение" },
  { value: "MEDICAL_ROUTE", label: "Разбор ситуации и план действий" },
  { value: "RECOVERY_4_WEEKS", label: "Сопровождение" }
];

const redFlagOptions: Array<{
  key: keyof QuestionnaireWizardState["redFlags"];
  label: string;
}> = [
  { key: "hasFever", label: "высокая температура / воспаление" },
  { key: "hasAcuteSwelling", label: "резко нарастающий отёк" },
  { key: "unableToBearWeight", label: "невозможно опираться на конечность" },
  { key: "hasNumbness", label: "онемение" },
  { key: "hasWeakness", label: "слабость" },
  { key: "hasBladderOrBowelSymptoms", label: "нарушение мочеиспускания или стула" },
  { key: "hasChestPain", label: "боль в груди / одышка" },
  { key: "hasShortnessOfBreath", label: "одышка" },
  { key: "hasConfusion", label: "спутанность сознания" }
];

function createClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getRequestedProductFromQuery(value: string | null): RequestedProductValue {
  if (!value) {
    return "NOT_SURE";
  }

  const matchedProduct = publicProducts.find((product) => product.slug === value);
  switch (matchedProduct?.code) {
    case "SECOND_OPINION":
    case "MEDICAL_ROUTE":
    case "RECOVERY_4_WEEKS":
    case "PERSONAL_SUPPORT":
      return matchedProduct.code;
    default:
      return "NOT_SURE";
  }
}

function getExtension(filename: string) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.at(-1)?.toLowerCase() ?? "" : "";
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.ceil(value / 1024)} KB`;
}

function joinSections(sections: Array<[string, string]>) {
  return sections
    .filter(([, value]) => hasText(value))
    .map(([label, value]) => `${label}: ${trimValue(value)}`)
    .join("\n");
}

function createEmptyLink(): LinkDraftState {
  return {
    id: createClientId(),
    kind: "IMAGING",
    url: "",
    label: "",
    note: "",
    accessPassword: "",
    accessInstructions: ""
  };
}

async function getVideoDurationSeconds(file: File) {
  if (typeof document === "undefined") {
    return 0;
  }

  return new Promise<number>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const element = document.createElement("video");

    element.preload = "metadata";
    element.onloadedmetadata = () => {
      const duration = element.duration;
      URL.revokeObjectURL(objectUrl);
      resolve(Number.isFinite(duration) ? duration : 0);
    };

    element.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Не удалось прочитать длительность файла ${file.name}.`));
    };

    element.src = objectUrl;
  });
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  await response.text();
  throw new Error(
    "Не удалось завершить отправку анкеты. Сервис временно недоступен. Пожалуйста, попробуйте ещё раз чуть позже."
  );
}

export function QuestionnaireForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedProductFromQuery = useMemo(
    () => getRequestedProductFromQuery(searchParams.get("product")),
    [searchParams]
  );

  const [step, setStep] = useState<WizardStep>(1);
  const [state, setState] = useState<ExtendedQuestionnaireState>(() =>
    createInitialFormState(requestedProductFromQuery)
  );
  const [submitting, setSubmitting] = useState(false);
  const [uploadingCategory, setUploadingCategory] = useState<UploadCategoryValue | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<SuccessState | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const invalidExternalLinks = getInvalidExternalLinkCount(state);
  const stepCanContinue = canContinueFromStep(step, state, {
    invalidExternalLinks,
    uploadingInProgress: uploadingCategory !== null
  });
  const isReadyToSubmit = wizardSteps.every((item) =>
    canContinueFromStep(item.step, state, {
      invalidExternalLinks,
      uploadingInProgress: uploadingCategory !== null
    })
  );
  const imagingSourceType = classifyImagingSourceType({
    uploads: state.uploads,
    externalLinks: state.externalLinks.filter((item) => hasText(item.url))
  });

  const goToStep = (next: WizardStep) => {
    if (next === 6 && step !== 6) {
      setState((current) => ({
        ...current,
        confirmsNonEmergency: false
      }));
    }

    setStep(next);
    setErrorMessage(null);

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const updateState = (updater: (current: ExtendedQuestionnaireState) => ExtendedQuestionnaireState) => {
    setState((current) => updater(current));
    setErrorMessage(null);
  };

  const updateUpload = (id: string, updater: (current: UploadDraftState) => UploadDraftState) => {
    updateState((current) => ({
      ...current,
      uploads: current.uploads.map((item) => (item.id === id ? updater(item) : item))
    }));
  };

  const updateExternalLink = (id: string, updater: (current: LinkDraftState) => LinkDraftState) => {
    updateState((current) => ({
      ...current,
      externalLinks: current.externalLinks.map((item) => (item.id === id ? updater(item) : item))
    }));
  };

  const handleNext = () => {
    if (!stepCanContinue) {
      return;
    }

    goToStep(nextStep(step));
  };

  const handleBack = () => {
    goToStep(previousStep(step));
  };

  const handleUpload = async (category: UploadCategoryValue, fileList: FileList | null) => {
    if (!fileList?.length) {
      return;
    }

    const files = Array.from(fileList);
    setUploadingCategory(category);
    setErrorMessage(null);

    try {
      if (category === "VIDEO") {
        const existingVideos = state.uploads.filter((item) => item.category === "VIDEO");
        if (existingVideos.length + files.length > VIDEO_UPLOAD_POLICY.maxVideosPerQuestionnaire) {
          throw new Error(`Можно загрузить не более ${VIDEO_UPLOAD_POLICY.maxVideosPerQuestionnaire} видео.`);
        }
      }

      const createdUploads: UploadDraftState[] = [];

      for (const file of files) {
        const extension = getExtension(file.name);
        let durationSeconds: number | undefined;

        if (category === "VIDEO") {
          if (!VIDEO_UPLOAD_POLICY.allowedExtensions.includes(extension as "mp4" | "mov")) {
            throw new Error("Для видео доступны только mp4 и mov.");
          }

          if (file.size > VIDEO_UPLOAD_POLICY.maxBytesPerVideo) {
            throw new Error("Размер одного видео не должен превышать 250 MB.");
          }

          durationSeconds = Math.round(await getVideoDurationSeconds(file));
          if (durationSeconds > VIDEO_UPLOAD_POLICY.maxDurationSeconds) {
            throw new Error("Одно видео не должно быть длиннее 120 секунд.");
          }
        }

        const presignResponse = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category,
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            durationSeconds
          })
        });
        const presignJson = await readJsonResponse<{
          ok?: boolean;
          data?: { storageKey: string; uploadUrl: string; contentType: string };
          error?: { message?: string };
        }>(presignResponse);
        if (!presignResponse.ok || !presignJson?.ok) {
          throw new Error(presignJson?.error?.message ?? "Не удалось подготовить загрузку файла.");
        }

        await fetch(presignJson.data.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": presignJson.data.contentType
          },
          body: file
        });

        const completeResponse = await fetch("/api/uploads/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category,
            originalName: file.name,
            mimeType: file.type || "application/octet-stream",
            extension,
            sizeBytes: file.size,
            durationSeconds,
            storageKey: presignJson.data.storageKey
          })
        });
        const completeJson = await readJsonResponse<{
          ok?: boolean;
          data?: { upload: UploadDraftState };
          error?: { message?: string };
        }>(completeResponse);
        if (!completeResponse.ok || !completeJson?.ok) {
          throw new Error(completeJson?.error?.message ?? "Не удалось завершить загрузку файла.");
        }

        createdUploads.push({
          id: createClientId(),
          ...completeJson.data.upload
        });
      }

      if (category === "VIDEO") {
        const totalVideoBytes = [
          ...state.uploads.filter((item) => item.category === "VIDEO"),
          ...createdUploads
        ].reduce((sum, item) => sum + item.sizeBytes, 0);

        if (totalVideoBytes > VIDEO_UPLOAD_POLICY.maxBytesTotal) {
          throw new Error("Суммарный объём видео не должен превышать 600 MB.");
        }
      }

      updateState((current) => ({
        ...current,
        uploads: [...current.uploads, ...createdUploads]
      }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить файл.");
    } finally {
      setUploadingCategory(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!isReadyToSubmit) {
      const firstInvalidStep =
        wizardSteps.find(
          (item) =>
            !canContinueFromStep(item.step, state, {
              invalidExternalLinks,
              uploadingInProgress: uploadingCategory !== null
            })
        )?.step ?? 1;

      goToStep(firstInvalidStep);
      setErrorMessage("Пожалуйста, заполните обязательные поля текущего маршрута анкеты.");
      return;
    }

    if (hasBlockingRedFlags(state.redFlags)) {
      router.push("/not-suitable");
      return;
    }

    const payload: QuestionnaireSubmitInput = {
      isAdult: true,
      confirmsNonEmergency: true,
      requestedProductCode: state.requestedProductCode,
      patient: {
        fullName: trimValue(state.patient.fullName),
        age: trimValue(state.patient.age) || undefined,
        email: trimValue(state.patient.email),
        phone: trimValue(state.patient.phone),
        preferredContact: state.patient.preferredContact,
        country: trimValue(state.patient.country),
        city: trimValue(state.patient.city),
        timezone: trimValue(state.patient.timezone)
      },
      caseDetails: {
        chiefComplaint: trimValue(state.situation.chiefComplaint),
        symptomTimeline:
          joinSections([
            ["Когда началось", state.situation.symptomStarted],
            ["Как развивалось", state.situation.symptomProgression]
          ]) || undefined,
        traumaHistory: trimValue(state.medicalContext.pastInjuries) || undefined,
        surgeryHistory: trimValue(state.situation.priorOperations) || undefined,
        priorDiagnoses:
          joinSections([
            ["Диагнозы", state.situation.diagnosesFromDoctors],
            ["Разные мнения", state.situation.differentOpinions]
          ]) || undefined,
        currentTreatment:
          joinSections([
            ["Что уже делали", state.situation.alreadyDone],
            ["Принимаемые препараты", state.medicalContext.medications]
          ]) || undefined,
        goalOfConsultation: `Предпочтительный формат: ${state.requestedProductCode}`,
        reviewNoteForDoctor:
          joinSections([
            ["Возраст", state.patient.age],
            ["Хронические заболевания", state.medicalContext.chronicConditions],
            ["Аллергии", state.medicalContext.allergies],
            ["Что врачу важно посмотреть", state.reviewNoteForDoctor]
          ]) || undefined
      },
      redFlags: state.redFlags,
      uploads: state.uploads.map<UploadDescriptorInput>((item) => ({
        category: item.category,
        originalName: item.originalName,
        mimeType: item.mimeType,
        extension: item.extension,
        sizeBytes: item.sizeBytes,
        durationSeconds: item.durationSeconds ?? undefined,
        storageKey: item.storageKey,
        accessPassword: trimValue(item.accessPassword) || undefined,
        accessInstructions: trimValue(item.accessInstructions) || undefined
      })),
      externalLinks: state.externalLinks
        .filter((item) => hasText(item.url))
        .map<ExternalImagingLinkInput>((item) => ({
          kind: item.kind,
          url: trimValue(item.url),
          label: trimValue(item.label) || undefined,
          note: trimValue(item.note) || undefined,
          accessPassword: trimValue(item.accessPassword) || undefined,
          accessInstructions: trimValue(item.accessInstructions) || undefined
        })),
      legal: {
        acceptedOffer: true,
        acceptedPrivacy: true,
        acceptedMedicalData: true,
        acceptedConsent: true,
        confirmedInformationAccuracy: true
      }
    };

    try {
      setSubmitting(true);
      const preferredContactLabel = getPreferredContactLabel(state.patient.preferredContact);
      const response = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await readJsonResponse<SubmitSuccessResponse | SubmitErrorResponse>(response);

      if (!response.ok || !json?.success) {
        if ("redirectTo" in json && json.redirectTo) {
          router.push(json.redirectTo as Route);
          return;
        }

        throw new Error(
          "error" in json && json.error
            ? json.error
            : "Не удалось отправить анкету. Пожалуйста, попробуйте ещё раз."
        );
      }

      setSuccessState({
        submissionId: json.submissionId,
        status: json.status,
        preferredContactLabel
      });
      setState(createInitialFormState(requestedProductFromQuery));
      setStep(1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось отправить анкету.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderCurrentStep = () => {
    if (step === 1) {
      return (
        <>
          <div className="questionnaire-panel__header stack-sm">
            <h2>Перед началом</h2>
            <p>Вы сейчас отправляете информацию для первичного профессионального разбора ситуации.</p>
            <p className="questionnaire-field-note">Запись и оплата открываются после того, как врач подтвердит формат работы.</p>
          </div>
          <div className="questionnaire-panel__section checkbox-grid">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={state.isAdult}
                onChange={(e) => updateState((current) => ({ ...current, isAdult: e.target.checked }))}
              />
              <span>Мне есть 18 лет</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={state.confirmsNonEmergency}
                onChange={(e) =>
                  updateState((current) => ({ ...current, confirmsNonEmergency: e.target.checked }))
                }
              />
              <span>Ситуация не относится к экстренным</span>
            </label>
          </div>
          <div className="notice notice--danger stack-sm">
            <strong>Если сейчас есть одно из состояний ниже — лучше не продолжать анкету и обратиться за очной медицинской помощью:</strong>
            <div className="checkbox-grid">
              {redFlagOptions.map((item) => (
                <label key={item.key} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={state.redFlags[item.key]}
                    onChange={(e) =>
                      updateState((current) => ({
                        ...current,
                        redFlags: {
                          ...current.redFlags,
                          [item.key]: e.target.checked
                        }
                      }))
                    }
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="questionnaire-panel__section stack-sm">
            <h3 className="questionnaire-panel__section-title">Какой формат сейчас ближе вам?</h3>
            <p className="questionnaire-field-note">
              Это не окончательный выбор — врач уточнит после анализа анкеты.
            </p>
            <div className="questionnaire-option-grid">
              {formatOptions.map((option) => {
                const selection = normalizeRequestedProductForSelection({
                  currentValue: state.requestedProductCode,
                  optionValue: option.value,
                  queryRequestedProduct: requestedProductFromQuery
                });

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`questionnaire-option-card${selection.isSelected ? " is-selected" : ""}`}
                    onClick={() =>
                      updateState((current) => ({
                        ...current,
                        requestedProductCode: selection.nextValue
                      }))
                    }
                  >
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      );
    }

    if (step === 2) {
      return (
        <>
          <div className="questionnaire-panel__header stack-sm">
            <h2>Контакты</h2>
            <p>Эти данные нужны, чтобы врач мог лично связаться с вами после анализа анкеты.</p>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Имя</span>
              <input value={state.patient.fullName} onChange={(e) => updateState((c) => ({ ...c, patient: { ...c.patient, fullName: e.target.value } }))} />
            </label>
            <label className="field">
              <span>Возраст</span>
              <input value={state.patient.age} onChange={(e) => updateState((c) => ({ ...c, patient: { ...c.patient, age: e.target.value } }))} />
            </label>
            <label className="field">
              <span>Страна</span>
              <input value={state.patient.country} onChange={(e) => updateState((c) => ({ ...c, patient: { ...c.patient, country: e.target.value } }))} />
            </label>
            <label className="field">
              <span>Город</span>
              <input value={state.patient.city} onChange={(e) => updateState((c) => ({ ...c, patient: { ...c.patient, city: e.target.value } }))} />
            </label>
            <label className="field">
              <span>Email</span>
              <input type="email" value={state.patient.email} onChange={(e) => updateState((c) => ({ ...c, patient: { ...c.patient, email: e.target.value } }))} />
            </label>
            <label className="field">
              <span>Телефон</span>
              <input value={state.patient.phone} onChange={(e) => updateState((c) => ({ ...c, patient: { ...c.patient, phone: e.target.value } }))} />
            </label>
            <label className="field">
              <span>Предпочтительный способ связи</span>
              <select value={state.patient.preferredContact} onChange={(e) => updateState((c) => ({ ...c, patient: { ...c.patient, preferredContact: e.target.value as QuestionnaireWizardState["patient"]["preferredContact"] } }))}>
                {preferredContactOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Часовой пояс</span>
              <input value={state.patient.timezone} onChange={(e) => updateState((c) => ({ ...c, patient: { ...c.patient, timezone: e.target.value } }))} />
            </label>
          </div>
        </>
      );
    }

    if (step === 3) {
      return (
        <>
          <div className="questionnaire-panel__header stack-sm">
            <h2>Ситуация</h2>
            <p className="questionnaire-panel__intro questionnaire-panel__intro--single-line">Опишите главное. Здесь важно не &quot;идеально заполнить&quot;, а спокойно собрать более ясную картину ситуации.</p>
          </div>
          <div className="form-grid">
            <label className="field field--full">
              <span>Что вас беспокоит?</span>
              <textarea
                placeholder="Например: где болит, как проявляется"
                value={state.situation.chiefComplaint}
                onChange={(e) => updateState((c) => ({ ...c, situation: { ...c.situation, chiefComplaint: e.target.value } }))}
              />
            </label>
            <label className="field">
              <span>Когда началось?</span>
              <textarea
                placeholder="Дата или примерный период"
                value={state.situation.symptomStarted}
                onChange={(e) => updateState((c) => ({ ...c, situation: { ...c.situation, symptomStarted: e.target.value } }))}
              />
            </label>
            <label className="field">
              <span>Как развивалось?</span>
              <textarea
                placeholder="Лучше / хуже / без изменений"
                value={state.situation.symptomProgression}
                onChange={(e) => updateState((c) => ({ ...c, situation: { ...c.situation, symptomProgression: e.target.value } }))}
              />
            </label>
            <label className="field field--full">
              <span>Что уже делали?</span>
              <textarea value={state.situation.alreadyDone} onChange={(e) => updateState((c) => ({ ...c, situation: { ...c.situation, alreadyDone: e.target.value } }))} />
            </label>
            <label className="field">
              <span>Есть ли диагнозы от врачей?</span>
              <textarea value={state.situation.diagnosesFromDoctors} onChange={(e) => updateState((c) => ({ ...c, situation: { ...c.situation, diagnosesFromDoctors: e.target.value } }))} />
            </label>
            <label className="field">
              <span>Есть ли разные мнения?</span>
              <textarea value={state.situation.differentOpinions} onChange={(e) => updateState((c) => ({ ...c, situation: { ...c.situation, differentOpinions: e.target.value } }))} />
            </label>
            <label className="field field--full">
              <span>Были ли операции?</span>
              <textarea value={state.situation.priorOperations} onChange={(e) => updateState((c) => ({ ...c, situation: { ...c.situation, priorOperations: e.target.value } }))} />
            </label>
          </div>
        </>
      );
    }

    if (step === 4) {
      return (
        <>
          <div className="questionnaire-panel__header stack-sm">
            <h2>Медицинский контекст</h2>
            <p className="questionnaire-panel__intro">
              <span className="questionnaire-panel__line questionnaire-panel__line--nowrap">Эти данные помогают врачу увидеть ситуацию не отдельно по одному симптому,</span>
              <span className="questionnaire-panel__line">а в контексте вашего состояния.</span>
            </p>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Хронические заболевания</span>
              <textarea value={state.medicalContext.chronicConditions} onChange={(e) => updateState((c) => ({ ...c, medicalContext: { ...c.medicalContext, chronicConditions: e.target.value } }))} />
            </label>
            <label className="field">
              <span>Принимаемые препараты</span>
              <textarea value={state.medicalContext.medications} onChange={(e) => updateState((c) => ({ ...c, medicalContext: { ...c.medicalContext, medications: e.target.value } }))} />
            </label>
            <label className="field">
              <span>Аллергии</span>
              <textarea value={state.medicalContext.allergies} onChange={(e) => updateState((c) => ({ ...c, medicalContext: { ...c.medicalContext, allergies: e.target.value } }))} />
            </label>
            <label className="field">
              <span>Травмы в прошлом</span>
              <textarea value={state.medicalContext.pastInjuries} onChange={(e) => updateState((c) => ({ ...c, medicalContext: { ...c.medicalContext, pastInjuries: e.target.value } }))} />
            </label>
          </div>
        </>
      );
    }

    if (step === 5) {
      return (
        <>
          <div className="questionnaire-panel__header stack-sm">
            <h2>Материалы</h2>
            <p>Вы можете прикрепить всё, что есть. Даже если не уверены — лучше приложить.</p>
          </div>
          <div className="questionnaire-upload-grid">
            {(["DOCUMENT", "IMAGE", "VIDEO"] as const).map((category) => (
              <div key={category} className="card questionnaire-upload-card stack-sm">
                <strong>{category === "DOCUMENT" ? "Документы" : category === "IMAGE" ? "Изображения" : "Видео"}</strong>
                <p className="questionnaire-field-note">
                  {category === "VIDEO"
                    ? "До 3 видео. Если файл слишком большой, добавьте ссылку."
                    : "Можно загружать несколько файлов."}
                </p>
                <input
                  type="file"
                  multiple
                  onChange={(e) => handleUpload(category, e.target.files)}
                  disabled={uploadingCategory !== null}
                />
              </div>
            ))}
          </div>
          <div className="stack-sm">
            <div className="questionnaire-link-toolbar">
              <strong>Внешние ссылки на исследования</strong>
              <button
                type="button"
                className="button button--secondary"
                onClick={() =>
                  updateState((current) => ({
                    ...current,
                    externalLinks: [...current.externalLinks, createEmptyLink()]
                  }))
                }
              >
                Добавить ссылку
              </button>
            </div>
            {state.externalLinks.length === 0 ? (
              <p className="questionnaire-field-note">Если МРТ, DICOM-архив или видео лежат в облаке, добавьте ссылку здесь.</p>
            ) : null}
            {state.externalLinks.map((item) => (
              <div key={item.id} className="card questionnaire-link-card stack-sm">
                <div className="questionnaire-link-toolbar">
                  <strong>Ссылка на материал</strong>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() =>
                      updateState((current) => ({
                        ...current,
                        externalLinks: current.externalLinks.filter((link) => link.id !== item.id)
                      }))
                    }
                  >
                    Удалить
                  </button>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Тип ссылки</span>
                    <select
                      value={item.kind}
                      onChange={(e) =>
                        updateExternalLink(item.id, (current) => ({
                          ...current,
                          kind: e.target.value as LinkDraftState["kind"]
                        }))
                      }
                    >
                      <option value="IMAGING">Исследование</option>
                      <option value="VIDEO">Видео</option>
                      <option value="CLOUD">Облако / архив</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>URL</span>
                    <input value={item.url} onChange={(e) => updateExternalLink(item.id, (current) => ({ ...current, url: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Название</span>
                    <input value={item.label ?? ""} onChange={(e) => updateExternalLink(item.id, (current) => ({ ...current, label: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Комментарий</span>
                    <input value={item.note ?? ""} onChange={(e) => updateExternalLink(item.id, (current) => ({ ...current, note: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Пароль архива</span>
                    <input value={item.accessPassword ?? ""} onChange={(e) => updateExternalLink(item.id, (current) => ({ ...current, accessPassword: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Инструкции по доступу</span>
                    <input value={item.accessInstructions ?? ""} onChange={(e) => updateExternalLink(item.id, (current) => ({ ...current, accessInstructions: e.target.value }))} />
                  </label>
                </div>
              </div>
            ))}
          </div>
          {state.uploads.length > 0 ? (
            <div className="stack-sm">
              <strong>Загруженные файлы</strong>
              {state.uploads.map((item) => (
                <div key={item.id} className="card questionnaire-upload-item stack-sm">
                  <div className="questionnaire-link-toolbar">
                    <div className="questionnaire-upload-item__meta stack-sm">
                      <strong>{item.originalName}</strong>
                      <span className="questionnaire-field-note">{formatBytes(item.sizeBytes)}</span>
                    </div>
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() =>
                        updateState((current) => ({
                          ...current,
                          uploads: current.uploads.filter((upload) => upload.id !== item.id)
                        }))
                      }
                    >
                      Удалить
                    </button>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      <span>Пароль архива</span>
                      <input value={item.accessPassword ?? ""} onChange={(e) => updateUpload(item.id, (current) => ({ ...current, accessPassword: e.target.value }))} />
                    </label>
                    <label className="field">
                      <span>Инструкции по доступу</span>
                      <input value={item.accessInstructions ?? ""} onChange={(e) => updateUpload(item.id, (current) => ({ ...current, accessInstructions: e.target.value }))} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <label className="field field--full">
            <span>Что врачу важно посмотреть?</span>
            <textarea value={state.reviewNoteForDoctor} onChange={(e) => updateState((current) => ({ ...current, reviewNoteForDoctor: e.target.value }))} />
          </label>
          {imagingSourceType ? (
            <span className="questionnaire-source-chip">
              Источник материалов: {imagingSourceType === "UPLOADED" ? "uploaded" : imagingSourceType === "EXTERNAL_LINK_ONLY" ? "external_link_only" : "mixed"}
            </span>
          ) : null}
          <div className="questionnaire-guide stack-sm">
            <strong>Как подготовить материалы</strong>
            <div className="questionnaire-guide-grid">
              <div className="questionnaire-guide-card">Сделайте несколько чётких фото ключевых кадров исследования, если загружаете снимки вручную.</div>
              <div className="questionnaire-guide-card">Если у вас диск, архив или облачная папка, добавьте короткую инструкцию по доступу.</div>
              <div className="questionnaire-guide-card">Если файлы не загружаются напрямую, можно оставить внешнюю ссылку и указать пароль при необходимости.</div>
            </div>
          </div>
        </>
      );
    }

    if (step === 6) {
      return (
        <>
          <div className="questionnaire-panel__header stack-sm">
            <h2>Подтверждение</h2>
            <p>Последний шаг перед отправкой анкеты.</p>
          </div>
          <div className="checkbox-grid">
            <label className="checkbox-row">
              <input
                type="checkbox"
                style={confirmationCheckboxStyle}
                checked={state.confirmsNonEmergency}
                onChange={(e) =>
                  updateState((current) => ({
                    ...current,
                    confirmsNonEmergency: e.target.checked
                  }))
                }
              />
              <span>Я понимаю, что это не экстренная помощь</span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" style={confirmationCheckboxStyle} checked={state.legal.acceptedOffer} onChange={(e) => updateState((current) => ({ ...current, legal: { ...current.legal, acceptedOffer: e.target.checked } }))} />
              <span>
                Я ознакомлен(а) с условиями (
                <Link href="/legal/offer" onClick={(event) => event.stopPropagation()}>
                  Публичная оферта
                </Link>
                )
              </span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" style={confirmationCheckboxStyle} checked={state.legal.acceptedPrivacy} onChange={(e) => updateState((current) => ({ ...current, legal: { ...current.legal, acceptedPrivacy: e.target.checked } }))} />
              <span>
                Я согласен(на) на обработку персональных данных (
                <Link href="/legal/privacy" onClick={(event) => event.stopPropagation()}>
                  Политика обработки данных
                </Link>
                )
              </span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" style={confirmationCheckboxStyle} checked={state.legal.acceptedMedicalData} onChange={(e) => updateState((current) => ({ ...current, legal: { ...current.legal, acceptedMedicalData: e.target.checked } }))} />
              <span>Я даю согласие на обработку медицинской информации, включая сведения из анкеты, результаты анализов, лабораторных и инструментальных исследований, обследования, заключения и иные приложенные материалы.</span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" style={confirmationCheckboxStyle} checked={state.legal.acceptedConsent} onChange={(e) => updateState((current) => ({ ...current, legal: { ...current.legal, acceptedConsent: e.target.checked } }))} />
              <span>
                Я понимаю формат дистанционного взаимодействия (
                <Link href="/legal/consent" onClick={(event) => event.stopPropagation()}>
                  Информированное согласие
                </Link>
                )
              </span>
            </label>
            <p className="questionnaire-field-note questionnaire-legal-note">
              Оплата производится после анализа анкеты и подтверждения формата врачом.
            </p>
            <label className="checkbox-row">
              <input type="checkbox" style={confirmationCheckboxStyle} checked={state.legal.confirmedInformationAccuracy} onChange={(e) => updateState((current) => ({ ...current, legal: { ...current.legal, confirmedInformationAccuracy: e.target.checked } }))} />
              <span>Я подтверждаю, что указал(а) информацию корректно</span>
            </label>
          </div>
          <div className="notice stack-sm">
            <strong>Что будет дальше:</strong>
            <ol className="questionnaire-next-list">
              <li>Врач внимательно изучит вашу ситуацию и материалы</li>
              <li>Уточнит, возможен ли дистанционный формат взаимодействия в вашем случае</li>
              <li>Предложит конкретный формат работы и дальнейшие шаги</li>
            </ol>
            <p>Вы получите не просто мнение, а понятный профессиональный ориентир.</p>
          </div>
        </>
      );
    }

    return null;
  };

  if (successState) {
    return (
      <section className="section">
        <div className="container stack">
          <div className="card questionnaire-success-card stack">
            <h2>Анкета отправлена</h2>
            <p className="questionnaire-success-card__lead">
              Спасибо. Врач лично изучит вашу ситуацию и материалы.
            </p>
            <p>
              Мы внимательно разберём вашу ситуацию, чтобы понять, что действительно
              происходит и какой формат помощи будет для вас оптимален.
            </p>
            <p className="questionnaire-success-card__timing">
              ⏱ Обычно это занимает от 12 до 24 часов.
            </p>

            <div className="questionnaire-success-card__section stack-sm">
              <strong>После анализа вы получите:</strong>
              <ul className="questionnaire-success-list">
                <li>профессиональный ориентир по ситуации</li>
                <li>понимание вашей ситуации</li>
                <li>рекомендации по дальнейшим шагам</li>
                <li>предложение подходящего формата работы</li>
              </ul>
            </div>

            <div className="questionnaire-success-card__section stack-sm">
              <strong>Вы получите не просто ответ,</strong>
              <p>
                а понятный и честный профессиональный ориентир, на который можно
                опереться.
              </p>
            </div>

            <div className="questionnaire-success-card__section stack-sm">
              <strong>Мы свяжемся с вами по выбранному способу связи:</strong>
              <ul className="questionnaire-success-list">
                <li>👉 Email</li>
                <li>👉 WhatsApp</li>
                <li>👉 Telegram</li>
                <li>👉 Телефон</li>
              </ul>
              <p>Основной способ связи: {successState.preferredContactLabel}</p>
              <p>Пожалуйста, будьте на связи.</p>
            </div>

            <p className="questionnaire-field-note">
              Если ситуация изменится или усилится — не откладывайте обращение за
              очной медицинской помощью.
            </p>
            <p className="questionnaire-success-card__meta">
              Номер анкеты: {successState.submissionId} · Статус:{" "}
              {successState.status === "new" ? "Новая анкета" : successState.status}
            </p>

            <div className="hero-actions">
              <Link href="/" className="button">
                Вернуться на главную
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form className="questionnaire-form" onSubmit={handleSubmit}>
      <section className="section">
        <div className="container stack">
          <div className="questionnaire-shell stack">
            <div className="card questionnaire-progress stack-sm">
              <div className="questionnaire-progress__header">
                <div className="stack-sm">
                  <strong>Маршрут анкеты</strong>
                  <p className="questionnaire-progress__note">
                    Все 6 шагов кликабельны. Вы можете открыть любой раздел анкеты, а затем вернуться к текущему месту.
                  </p>
                </div>
                <span className="questionnaire-field-note">Шаг {step} из 6</span>
              </div>

              <div className="questionnaire-progress__track" aria-hidden="true">
                {wizardSteps.map((item) => (
                  <span
                    key={item.step}
                    className={`questionnaire-progress__segment${item.step <= step ? " is-active" : ""}`}
                  />
                ))}
              </div>

              <div className="questionnaire-step-list">
                {wizardSteps.map((item) => (
                  <button
                    key={item.step}
                    type="button"
                    className={`questionnaire-step-chip${item.step === step ? " is-current" : ""}`}
                    onClick={() => goToStep(item.step)}
                  >
                    <span>{item.number}</span>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </button>
                ))}
              </div>
            </div>

            {errorMessage ? <div className="notice notice--danger">{errorMessage}</div> : null}

            <div ref={panelRef} className="card questionnaire-panel stack">
              {renderCurrentStep()}
            </div>

            <div className="card questionnaire-footer">
              <div className="stack-sm">
                {hasBlockingRedFlags(state.redFlags) ? (
                  <p className="questionnaire-step-guard">
                    Анкета не должна продолжаться при экстренных симптомах. Лучше перейти на страницу клинических ограничений.
                  </p>
                ) : (
                  <p className="questionnaire-field-note">
                    Текущий шаг можно спокойно просмотреть и затем перейти дальше.
                  </p>
                )}
              </div>

              <div className="hero-actions questionnaire-footer__navigation">
                {step > 1 ? (
                  <button type="button" className="button button--secondary" onClick={handleBack}>
                    Назад
                  </button>
                ) : null}

                {step < 6 ? (
                  hasBlockingRedFlags(state.redFlags) ? (
                    <Link href="/not-suitable" className="button button--secondary">
                      Открыть ограничения
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={`button${stepCanContinue ? "" : " button--disabled"}`}
                      disabled={!stepCanContinue}
                      onClick={handleNext}
                    >
                      Продолжить заполнение
                    </button>
                  )
                ) : (
                  <button
                    type="submit"
                    className={`button${isReadyToSubmit && !submitting ? "" : " button--disabled"}`}
                    disabled={!isReadyToSubmit || submitting}
                  >
                    {submitting ? "Отправляем..." : "Отправить анкету"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </form>
  );
}

