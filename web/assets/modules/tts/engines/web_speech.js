// Path: web/assets/modules/tts/engines/web_speech.js
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("WebSpeechEngine");

export class WebSpeechEngine {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voice = null;
        this.rate = 1.0;
        this.pitch = 1.0;
        this.onVoicesChanged = null; // Callback UI
        
        // Init voices
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => {
                this._loadVoices();
                if (this.onVoicesChanged) this.onVoicesChanged(this.getVoices());
            };
        }
        this._loadVoices();
        
        // Load saved settings
        this._loadSettings();
    }

    _loadVoices() {
        const voices = this.synth.getVoices();
        // Fallback logic
        if (!this.voice && voices.length > 0) {
             this.voice = voices.find(v => v.name.includes("Google US English")) || 
                          voices.find(v => v.lang === "en-US") || 
                          voices.find(v => v.lang.startsWith("en"));
        }
        logger.debug("Voice loaded", this.voice ? this.voice.name : "Default");
    }

    _loadSettings() {
        const savedRate = localStorage.getItem("tts_rate");
        const savedVoiceURI = localStorage.getItem("tts_voice_uri");

        if (savedRate) this.rate = parseFloat(savedRate);
        
        if (savedVoiceURI) {
            const voices = this.synth.getVoices();
            const found = voices.find(v => v.voiceURI === savedVoiceURI);
            if (found) this.voice = found;
        }
    }

    getVoices() {
        return this.synth.getVoices().filter(v => v.lang.startsWith('en'));
    }

    setVoice(voiceURI) {
        const voices = this.synth.getVoices();
        const found = voices.find(v => v.voiceURI === voiceURI);
        if (found) {
            this.voice = found;
            localStorage.setItem("tts_voice_uri", voiceURI);
            logger.info("Config", `Voice set to ${found.name}`);
        }
    }

    setRate(rate) {
        this.rate = parseFloat(rate);
        localStorage.setItem("tts_rate", this.rate);
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
            // Ignore interruption errors
            if (e.error !== 'interrupted' && onEnd) onEnd();
        };

        if (onBoundary) {
            utterance.onboundary = onBoundary;
        }

        this.synth.speak(utterance);
    }

    pause() { this.synth.pause(); }
    resume() { this.synth.resume(); }
    stop() { this.synth.cancel(); }
}