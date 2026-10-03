import { create } from "zustand";

export interface SoundRequest {
  title?: string;
  /** Called with a WAV data URL and the source's name. */
  onPick(data: string, name: string): void;
}

export const useSoundStudio = create<{ req: SoundRequest | null; open: boolean }>()(() => ({ req: null, open: false }));

export const openSoundStudio = (req: SoundRequest) => useSoundStudio.setState({ req, open: true });
export const closeSoundStudio = () => useSoundStudio.setState({ open: false });
