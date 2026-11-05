export interface FrameScheduler {
  request(): void;
  cancel(): void;
  isPending(): boolean;
}

/** Runs `run` at most once per animation frame, and only when something requested it. */
export function createFrameScheduler(run: () => void): FrameScheduler {
  let frame: number | null = null;

  const fire = () => {
    frame = null;
    try {
      run();
    } catch (error) {
      console.error('react-native-viewport-detector: visibility pass failed', error);
    }
  };

  return {
    request() {
      if (frame === null) {
        frame = requestAnimationFrame(fire);
      }
    },
    cancel() {
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
    },
    isPending() {
      return frame !== null;
    },
  };
}
