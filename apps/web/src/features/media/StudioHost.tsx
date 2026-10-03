import { lazy, Suspense } from "react";
import { useSoundStudio } from "./soundRequest";
import { useStudio } from "./studio";

const ImageStudio = lazy(() => import("./ImageStudio"));
const SoundStudio = lazy(() => import("./SoundStudio"));

/** Always mounted; loads each studio (and its cropper / waveform) the first time anyone opens it. */
export function StudioHost() {
  const images = useStudio((s) => s.req !== null || s.jobs.length > 0);
  const sounds = useSoundStudio((s) => s.req !== null);
  return (
    <Suspense fallback={null}>
      {images && <ImageStudio />}
      {sounds && <SoundStudio />}
    </Suspense>
  );
}
