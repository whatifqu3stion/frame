import { useLocalSearchParams } from "expo-router";
import OnboardingFlow from "@/components/OnboardingFlow";
export default function WelcomePreview() { const { moment } = useLocalSearchParams<{ moment?: string }>(); return <OnboardingFlow replay sampleReveal={__DEV__ && (moment === "sample" || moment === "loading")} loadingPreview={__DEV__ && moment === "loading"} />; }
