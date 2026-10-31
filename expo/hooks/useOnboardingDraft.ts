import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { emptyOnboardingDraft, parseOnboardingDraft, type OnboardingDraft } from "@/domain/onboardingDraft";
import { profileStorageKey } from "@/storage/profileStorage";

/** Mount once per profile. Replay deliberately leaves the real setup draft untouched. */
export function useOnboardingDraft(profileId: string, replay: boolean) {
  const [draft, setDraft] = useState<OnboardingDraft>(emptyOnboardingDraft);
  const [ready, setReady] = useState(replay);
  const [fresh, setFresh] = useState(replay);
  const [error, setError] = useState(false);
  const queue = useRef(Promise.resolve());
  const stopped = useRef(false);
  const key = profileStorageKey("onboardingDraft", profileId);
  useEffect(() => {
    if (replay) return;
    let active = true;
    void AsyncStorage.getItem(key).then((raw) => { if (active) { setDraft(parseOnboardingDraft(raw)); setFresh(raw === null); setReady(true); } })
      .catch(() => { if (active) { setError(true); setReady(true); } });
    return () => { active = false; };
  }, [key, replay]);
  useEffect(() => {
    if (!ready || replay || stopped.current) return;
    let active = true;
    queue.current = queue.current.catch(() => {}).then(() => AsyncStorage.setItem(key, JSON.stringify(draft)));
    void queue.current.then(() => { if (active) setError(false); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [draft, key, ready, replay]);
  const clear = async () => {
    if (replay) return;
    stopped.current = true;
    await queue.current.catch(() => {});
    await AsyncStorage.removeItem(key);
  };
  return { draft, setDraft, ready, fresh, error, clear };
}
