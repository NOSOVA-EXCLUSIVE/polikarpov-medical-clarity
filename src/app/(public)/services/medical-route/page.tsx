import { permanentRedirect } from "next/navigation";

export default function MedicalRoutePage() {
  permanentRedirect("/services/clinical-review");
}
