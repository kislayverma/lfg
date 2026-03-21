/**
 * Hook that wraps react-native-speech-recognition-kit for voice-to-text
 * input in the notes editor.
 *
 * Handles:
 *  - Starting/stopping the speech recogniser
 *  - Streaming partial results for live feedback
 *  - Requesting microphone permission on Android
 *  - Cleaning up native listeners on unmount
 */

import {useState, useCallback, useEffect, useRef} from 'react';
import {Platform, PermissionsAndroid, Alert} from 'react-native';
import {
  startListening,
  stopListening,
  addEventListener,
  isRecognitionAvailable,
  speechRecogntionEvents,
} from 'react-native-speech-recognition-kit';

export interface VoiceInputState {
  /** Whether the recogniser is currently listening */
  isListening: boolean;
  /** Partial transcription while the user is still speaking */
  partialText: string;
  /** Toggle listening on/off. Returns the final transcription (or '') on stop. */
  toggleListening: () => Promise<void>;
  /** True if speech recognition is not available on this device */
  unavailable: boolean;
}

interface UseVoiceInputOptions {
  /** Called with the final transcription when the user stops speaking */
  onResult: (text: string) => void;
}

/**
 * Monotonically increasing session ID. Each call to startListening gets
 * a new ID. Events from a stale session (e.g. the END event fired by
 * stopListening for the *previous* session) are ignored.
 */
let nextSessionId = 0;

export function useVoiceInput({onResult}: UseVoiceInputOptions): VoiceInputState {
  const [isListening, setIsListening] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  // The session ID that is currently active. Events whose session
  // doesn't match are discarded (stale END / ERROR from previous session).
  const activeSessionRef = useRef<number | null>(null);

  // Set up native event listeners once
  useEffect(() => {
    const subs = [
      addEventListener(speechRecogntionEvents.PARTIAL_RESULTS, (e: any) => {
        if (activeSessionRef.current === null) return;
        const text = e?.value ?? '';
        setPartialText(text);
      }),
      addEventListener(speechRecogntionEvents.RESULTS, (e: any) => {
        if (activeSessionRef.current === null) return;
        activeSessionRef.current = null;
        const text = e?.value ?? '';
        setPartialText('');
        setIsListening(false);
        if (text.trim().length > 0) {
          onResultRef.current(text.trim());
        }
      }),
      addEventListener(speechRecogntionEvents.END, () => {
        if (activeSessionRef.current === null) return;
        // On Android, END fires before RESULTS. Don't nullify the session
        // here — let RESULTS handle it. Use a short delay so that if
        // RESULTS arrives right after, it isn't discarded.
        const sid = activeSessionRef.current;
        setTimeout(() => {
          // Only clean up if RESULTS didn't already handle this session
          if (activeSessionRef.current === sid) {
            activeSessionRef.current = null;
            setIsListening(false);
            setPartialText('');
          }
        }, 500);
      }),
      addEventListener(speechRecogntionEvents.ERROR, (e: any) => {
        if (activeSessionRef.current === null) return;
        console.warn('[VoiceInput] Error:', e?.message ?? e);
        activeSessionRef.current = null;
        setIsListening(false);
        setPartialText('');
      }),
    ];

    return () => {
      subs.forEach(s => s.remove());
    };
  }, []);

  const toggleListening = useCallback(async () => {
    if (isListening) {
      // Mark session as inactive BEFORE calling stopListening so that
      // the END event it fires is ignored (we handle state here).
      activeSessionRef.current = null;
      setIsListening(false);
      setPartialText('');
      try {
        await stopListening();
      } catch {
        // Ignore — may already be stopped
      }
      return;
    }

    // Check availability
    try {
      const available = await isRecognitionAvailable();
      if (!available) {
        setUnavailable(true);
        Alert.alert(
          'Speech Recognition Unavailable',
          'This device does not support speech recognition.',
        );
        return;
      }
    } catch {
      // If the check itself fails, try anyway
    }

    // Request mic permission on Android
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'Microphone access is needed for voice input.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert(
          'Microphone Permission Denied',
          'Please enable microphone access in Settings to use voice input.',
        );
        return;
      }
    }

    // Assign a new session ID so any stale native events are discarded
    const sessionId = ++nextSessionId;
    activeSessionRef.current = sessionId;
    setPartialText('');
    setIsListening(true);

    try {
      await startListening();
      // Verify our session is still the active one (user may have
      // toggled off during the async gap)
      if (activeSessionRef.current !== sessionId) {
        return;
      }
    } catch (err) {
      console.warn('[VoiceInput] Failed to start:', err);
      if (activeSessionRef.current === sessionId) {
        activeSessionRef.current = null;
        setIsListening(false);
      }
    }
  }, [isListening]);

  return {isListening, partialText, toggleListening, unavailable};
}
