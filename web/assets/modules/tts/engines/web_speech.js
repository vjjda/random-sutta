// Path: web/assets/modules/tts/engines/web_speech.js
import { getLogger } from '../../utils/logger.js'; // [FIXED] Correct path

const logger = getLogger("WebSpeechEngine");

export class WebSpeechEngine {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voice = null;
        this.rate = 1.0;
        this.pitch = 1.0;
        
        // Init voices
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => this._loadVoices();
        }
        this._loadVoices();
    }

    _loadVoices() {
        const voices = this.synth.getVoices();
        // Ưu tiên giọng Google US hoặc English chất lượng cao
        this.voice = voices.find(v => v.name.includes("Google US English")) || 
                     voices.find(v => v.lang === "en-US") || 
                     voices.find(v => v.lang.startsWith("en"));
        
        logger.debug("Voice loaded", this.voice ? this.voice.name : "Default");
    }

    speak(text, onEnd, onBoundary) {
        if (this.synth.speaking) {
            this.synth.cancel();
        }

        if (!text) {
            if (onEnd) onEnd();
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        
        if (this.voice) utterance.voice = this.voice;
        utterance.rate = this.rate;
        utterance.pitch = this.pitch;

        utterance.onend = () => {
            if (onEnd) onEnd();
        };

        utterance.onerror = (e) => {
            logger.error("Speak error", e);
            if (onEnd) onEnd(); // Fallback to next
        };

        if (onBoundary) {
            utterance.onboundary = onBoundary;
        }

        this.synth.speak(utterance);
    }

    pause() {
        this.synth.pause();
    }

    resume() {
        this.synth.resume();
    }

    stop() {
        this.synth.cancel();
    }

    setRate(rate) {
        this.rate = rate;
    }
}