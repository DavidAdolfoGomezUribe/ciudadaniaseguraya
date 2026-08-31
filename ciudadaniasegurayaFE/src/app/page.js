import { LandingExperience } from "@/features/landing/components/LandingExperience";
import { PurposePanel } from "@/features/landing/components/PurposePanel";
import { TechnologyExplanation } from "@/features/landing/components/TechnologyExplanation";

export default function HomePage() {
  return (
    <>
      <LandingExperience purpose={<PurposePanel />} />
      <TechnologyExplanation />
    </>
  );
}
