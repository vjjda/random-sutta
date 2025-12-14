// Path: web/assets/modules/tts/engines/tts_web_speech_engine.js
import { getLogger } from '../../utils/logger.js'; 

const logger = getLogger("TTS_WebSpeech");

export class TTSWebSpeechEngine {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voice = null;
        this.rate = 1.0;
        this.pitch = 1.0;
        this.onVoicesChanged = null;
        this.currentUtterance = null;
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => {
                this._loadVoices();
                if (this.onVoicesChanged) this.onVoicesChanged(this.getVoices());
            };
        }
        this._loadVoices();
        this._loadSettings();
        this.stop();
    }

    _loadVoices() {
        const voices = this.synth.getVoices();
        if (!this.voice && voices.length > 0) {
             this.voice = voices.find(v => v.name.includes("Google US English")) ||
                          voices.find(v => v.lang === "en-US") || 
                          voices.find(v => v.lang.startsWith("en"));
        }
    }

    _loadSettings() {
        const savedRate = localStorage.getItem("tts_rate");
        const savedPitch = localStorage.getItem("tts_pitch");
        const savedVoiceURI = localStorage.getItem("tts_voice_uri");
        
        if (savedRate) this.rate = parseFloat(savedRate);
        if (savedPitch) this.pitch = parseFloat(savedPitch);
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
        }
    }

    setRate(rate) {
        this.rate = parseFloat(rate);
        localStorage.setItem("tts_rate", this.rate);
    }

    setPitch(pitch) {
        this.pitch = parseFloat(pitch);
        localStorage.setItem("tts_pitch", this.pitch);
    }

    // [FIX] Return a resolved Promise for interface consistency
    speak(text, onEnd, onBoundary) {
        this.synth.cancel();
        if (!text) { 
            if (onEnd) onEnd(); 
            return Promise.resolve();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        this.currentUtterance = utterance;
        if (this.voice) utterance.voice = this.voice;
        utterance.rate = this.rate;
        utterance.pitch = this.pitch;
        utterance.onend = () => { 
            this.currentUtterance = null;
            if (onEnd) onEnd(); 
        };

        utterance.onerror = (e) => {
            logger.error("Speak error", `Code: ${e.error}`);
            this.currentUtterance = null;
            if (e.error !== 'interrupted' && e.error !== 'canceled' && onEnd) {
                onEnd();
            }
        };

        if (onBoundary) {
            utterance.onboundary = onBoundary;
        }

        setTimeout(() => {
            this.synth.speak(utterance);
        }, 10);

        return Promise.resolve();
    }

    pause() { this.synth.pause(); }
    resume() { this.synth.resume(); }
    
    stop() { 
        this.synth.cancel();
        this.currentUtterance = null;
    }
}