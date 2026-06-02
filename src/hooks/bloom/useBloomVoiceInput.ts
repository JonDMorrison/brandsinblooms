import * as React from "react";

type BloomSpeechRecognitionErrorCode =
  | "aborted"
  | "audio-capture"
  | "bad-grammar"
  | "language-not-supported"
  | "network"
  | "no-speech"
  | "not-allowed"
  | "phrases-not-supported"
  | "service-not-allowed"
  | string;

interface BloomSpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface BloomSpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): BloomSpeechRecognitionAlternative;
}

interface BloomSpeechRecognitionResultList {
  length: number;
  item(index: number): BloomSpeechRecognitionResult;
}

interface BloomSpeechRecognitionResultEvent extends Event {
  resultIndex: number;
  results: BloomSpeechRecognitionResultList;
}

interface BloomSpeechRecognitionErrorEvent extends Event {
  error: BloomSpeechRecognitionErrorCode;
  message: string;
}

interface BloomSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: ((this: BloomSpeechRecognition, event: Event) => void) | null;
  onerror:
    | ((
        this: BloomSpeechRecognition,
        event: BloomSpeechRecognitionErrorEvent,
      ) => void)
    | null;
  onresult:
    | ((
        this: BloomSpeechRecognition,
        event: BloomSpeechRecognitionResultEvent,
      ) => void)
    | null;
  abort(): void;
  start(): void;
  stop(): void;
}

interface BloomSpeechRecognitionConstructor {
  new (): BloomSpeechRecognition;
}

type BloomSpeechRecognitionWindow = Window & {
  SpeechRecognition?: BloomSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BloomSpeechRecognitionConstructor;
};

type BloomAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

interface SpeechRecognitionSupportRef {
  initialized: boolean;
  Recognition: BloomSpeechRecognitionConstructor | null;
}

const getSpeechRecognitionConstructor = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const speechWindow = window as BloomSpeechRecognitionWindow;
  if ("SpeechRecognition" in speechWindow && speechWindow.SpeechRecognition) {
    return speechWindow.SpeechRecognition;
  }

  if (
    "webkitSpeechRecognition" in speechWindow &&
    speechWindow.webkitSpeechRecognition
  ) {
    return speechWindow.webkitSpeechRecognition;
  }

  return null;
};

const getRecognitionLanguage = () => {
  if (typeof navigator === "undefined") {
    return "en-US";
  }

  return navigator.language || "en-US";
};

const getAudioContextConstructor = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const audioWindow = window as BloomAudioWindow;
  return window.AudioContext ?? audioWindow.webkitAudioContext ?? null;
};

const normalizeTranscript = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const appendTranscript = (current: string, addition: string) => {
  const nextAddition = normalizeTranscript(addition);
  if (!nextAddition) {
    return current;
  }

  return normalizeTranscript(
    current ? `${current} ${nextAddition}` : nextAddition,
  );
};

const mapSpeechRecognitionError = (
  error: BloomSpeechRecognitionErrorCode,
): string | null => {
  switch (error) {
    case "no-speech":
      return "No speech detected. Please try again.";
    case "audio-capture":
      return "Microphone not available. Check your browser permissions.";
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access denied. Please allow microphone access in your browser settings.";
    case "network":
      return "Network error during speech recognition.";
    case "aborted":
      return null;
    default:
      return "Speech recognition error. Please try again.";
  }
};

const mapMicrophoneAccessError = (error: unknown): string => {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Microphone access denied. Please allow microphone access in your browser settings.";
    }

    if (
      error.name === "NotFoundError" ||
      error.name === "DevicesNotFoundError"
    ) {
      return "Microphone not available. Check your browser permissions.";
    }
  }

  return "Microphone not available. Check your browser permissions.";
};

const detachRecognitionHandlers = (
  recognition: BloomSpeechRecognition | null,
) => {
  if (!recognition) {
    return;
  }

  recognition.onend = null;
  recognition.onerror = null;
  recognition.onresult = null;
};

export function useBloomVoiceInput() {
  const supportRef = React.useRef<SpeechRecognitionSupportRef>({
    initialized: false,
    Recognition: null,
  });
  if (!supportRef.current.initialized) {
    supportRef.current = {
      initialized: true,
      Recognition: getSpeechRecognitionConstructor(),
    };
  }

  const activeRecognitionRef = React.useRef<BloomSpeechRecognition | null>(
    null,
  );
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const mountedRef = React.useRef(true);
  const [isListening, setIsListening] = React.useState(false);
  const [transcript, setTranscript] = React.useState("");
  const [interimTranscript, setInterimTranscript] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = React.useState<AnalyserNode | null>(
    null,
  );
  const isSupported = Boolean(supportRef.current.Recognition);

  const cleanupAudioResources = React.useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    analyserRef.current = null;
    if (mountedRef.current) {
      setAnalyserNode(null);
    }

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close().catch(() => undefined);
    }
  }, []);

  const setupAudioAnalysis = React.useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      throw new Error("getUserMedia unavailable");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;

    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      if (mountedRef.current) {
        setAnalyserNode(null);
      }
      return;
    }

    try {
      const audioContext = new AudioContextConstructor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      setAnalyserNode(analyser);

      if (audioContext.state === "suspended") {
        void audioContext.resume().catch(() => undefined);
      }
    } catch {
      cleanupAudioResources();
    }
  }, [cleanupAudioResources]);

  const abortActiveRecognition = React.useCallback(() => {
    const activeRecognition = activeRecognitionRef.current;
    if (!activeRecognition) {
      return;
    }

    detachRecognitionHandlers(activeRecognition);
    try {
      activeRecognition.abort();
    } catch {
      // Ignore browser-specific abort errors during cleanup.
    }
    activeRecognitionRef.current = null;
    cleanupAudioResources();
  }, [cleanupAudioResources]);

  const startListening = React.useCallback(async () => {
    const Recognition = supportRef.current.Recognition;
    if (!Recognition) {
      return;
    }

    abortActiveRecognition();

    try {
      await setupAudioAnalysis();
    } catch (microphoneError) {
      if (!mountedRef.current) {
        return;
      }

      setError(mapMicrophoneAccessError(microphoneError));
      setIsListening(false);
      cleanupAudioResources();
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = getRecognitionLanguage();
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      if (!mountedRef.current) {
        return;
      }

      const finalParts: string[] = [];
      const interimParts: string[] = [];

      for (
        let resultIndex = event.resultIndex;
        resultIndex < event.results.length;
        resultIndex += 1
      ) {
        const result = event.results.item(resultIndex);
        const transcriptText =
          result.length > 0 ? result.item(0).transcript : "";
        if (!transcriptText.trim()) {
          continue;
        }

        if (result.isFinal) {
          finalParts.push(transcriptText);
        } else {
          interimParts.push(transcriptText);
        }
      }

      if (finalParts.length > 0) {
        setTranscript((current) =>
          appendTranscript(current, finalParts.join(" ")),
        );
        setInterimTranscript("");
        return;
      }

      setInterimTranscript(normalizeTranscript(interimParts.join(" ")));
    };

    recognition.onerror = (event) => {
      if (!mountedRef.current) {
        return;
      }

      setError(mapSpeechRecognitionError(event.error));
      setIsListening(false);
      if (activeRecognitionRef.current === recognition) {
        detachRecognitionHandlers(recognition);
        activeRecognitionRef.current = null;
      }
      cleanupAudioResources();
    };

    recognition.onend = () => {
      if (!mountedRef.current) {
        return;
      }

      setIsListening(false);
      if (activeRecognitionRef.current === recognition) {
        detachRecognitionHandlers(recognition);
        activeRecognitionRef.current = null;
      }
      cleanupAudioResources();
    };

    activeRecognitionRef.current = recognition;
    setError(null);
    setInterimTranscript("");

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      detachRecognitionHandlers(recognition);
      activeRecognitionRef.current = null;
      setIsListening(false);
      cleanupAudioResources();
      setError("Speech recognition error. Please try again.");
    }
  }, [abortActiveRecognition, cleanupAudioResources, setupAudioAnalysis]);

  const stopListening = React.useCallback(() => {
    const activeRecognition = activeRecognitionRef.current;
    if (!activeRecognition) {
      setIsListening(false);
      cleanupAudioResources();
      return;
    }

    try {
      activeRecognition.stop();
    } catch {
      detachRecognitionHandlers(activeRecognition);
      activeRecognitionRef.current = null;
    }

    setIsListening(false);
    cleanupAudioResources();
  }, [cleanupAudioResources]);

  const resetTranscript = React.useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  React.useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortActiveRecognition();
      cleanupAudioResources();
    };
  }, [abortActiveRecognition, cleanupAudioResources]);

  return {
    isSupported,
    isListening: isSupported ? isListening : false,
    transcript: isSupported ? transcript : "",
    interimTranscript: isSupported ? interimTranscript : "",
    analyserNode: isSupported ? analyserNode : null,
    startListening,
    stopListening,
    error: isSupported ? error : null,
    resetTranscript,
  };
}
