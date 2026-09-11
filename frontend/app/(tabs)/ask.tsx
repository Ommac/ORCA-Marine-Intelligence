import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Send,
  User,
  Sparkles,
  Compass,
  RotateCcw,
  MapPin,
  Calendar,
  Ship,
  Map,
  Navigation,
  Mic,
  MicOff,
  Volume2,
  Languages,
} from 'lucide-react-native';
import { OrcaHeader } from '../../components/OrcaHeader';
import { PFZTopCards } from '../../components/PFZTopCards';
import { RiskExplanationCard } from '../../components/RiskExplanationCard';
import { queryOrcaAssistant, synthesizeSpeech, setSelectedPFZId } from '../../services/api';
import { getActiveTrip, subscribeToTrip } from '../../services/tripStore';
import { setMapFocus } from '../../services/mapFocusStore';
import { formatDateToFisherman } from '../../utils/formatting';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { UIAction, PFZCandidate, DisplayFlags, RiskExplanation, SupportedLanguage, LanguageOption } from '../../types/orca';

interface ChatMessage {
  id: string;
  sender: 'user' | 'orca';
  text: string;
  timestamp: string;
  isError?: boolean;
  retryQuery?: string;
  ui_action?: UIAction;
  top_candidates?: PFZCandidate[];
  display?: DisplayFlags;
  risk_explanation?: RiskExplanation;
  language?: string;
  audio_base64?: string;
}

const SUPPORTED_LANGUAGES_LIST: LanguageOption[] = [
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिंदी' },
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
];

const LOCALIZED_QUESTIONS: Record<string, string[]> = {
  mr: [
    'उद्या मासेमारीला जाणं सुरक्षित आहे का?',
    'माझ्या स्थानापासून २ रा PFZ सांगा',
    '५ मीटर बोटीसाठी लाटा सुरक्षित आहेत का?',
    'जवळचा मासेमारी क्षेत्र दाखवा',
  ],
  hi: [
    'क्या कल मछली पकड़ने जाना सुरक्षित है?',
    'मेरे स्थान से दूसरा PFZ बताओ',
    '५ मीटर नाव के लिए समुद्र कैसा है?',
    'नजदीकी मछली क्षेत्र कहाँ है?',
  ],
  en: [
    'Is it safe for me to go fishing today?',
    'Can I go fishing tomorrow?',
    'Where is the nearest fishing zone?',
    'Tell me 2nd PFZ from my location',
    'Are the waves safe for a 5m boat?',
  ],
  ta: [
    'நாளை மீன்பிடிக்க செல்வது பாதுகாப்பானதா?',
    'அருகிலுள்ள மீன்பிடி மண்டலம் எங்கே?',
  ],
  te: [
    'రేపు చేపల వేటకు వెళ్లడం సురక్షితమేనా?',
    'సమీప చేపల వేట ప్రాంతం ఎక్కడ ఉంది?',
  ],
  gu: [
    'આવતીકાલે માછીમારી કરવી સુરક્ષિત છે?',
    'સૌથી નજીકનો ફિશિંગ ઝોન ક્યાં છે?',
  ],
};

const LOCALIZED_WELCOME: Record<string, string> = {
  mr: 'नमस्कार! मी ORCA, तुमचा सागरी सल्लागार. समुद्राची स्थिती, मासेमारी क्षेत्र, लाटांची सुरक्षितता याबद्दल काहीही विचारा.',
  hi: 'नमस्ते! मैं ORCA हूँ, आपका समुद्री सुरक्षा सलाहकार। मौसम, मछली पकड़ने के क्षेत्र और लहरों के बारे में कुछ भी पूछें।',
  en: 'Namaste! I am ORCA, your Marine Intelligence Assistant. Ask me anything about sea conditions, fishing zones, wave safety, or boat advisories.',
  ta: 'வணக்கம்! நான் ஆர்கா (ORCA), உங்கள் கடல்சார் ஆலோசகர். கடல் நிலைமைகள் மற்றும் மீன்பிடி பகுதிகள் பற்றி கேளுங்கள்.',
  te: 'నమస్కారం! నేను ORCA, మీ సముద్ర భద్రతా సహాయకుడిని. సముద్ర పరిస్థితులు మరియు చేపల వేట మండలాల గురించి అడగండి.',
  gu: 'નમસ્તે! હું ORCA છું, તમારો દરિયાઈ સલાહકાર. દરિયાની સ્થિતિ અને ફિશિંગ ઝોન વિશે કંઈપણ પૂછો.',
};

export default function AskOrcaScreen() {
  const router = useRouter();
  const [activeTrip, setActiveTrip] = useState(getActiveTrip());
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>('mr');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'orca',
      text: LOCALIZED_WELCOME.mr,
      timestamp: 'Just now',
      language: 'mr',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const currentAudioRef = useRef<any>(null);
  const activeRecognitionRef = useRef<any>(null);

  useEffect(() => {
    const unsubscribe = subscribeToTrip((trip) => {
      setActiveTrip(trip);
    });
    return () => unsubscribe();
  }, []);

  const handleSelectLanguage = (langCode: SupportedLanguage) => {
    setSelectedLang(langCode);
    // If only initial welcome message exists, update it to the selected language
    if (messages.length === 1 && messages[0].id === 'welcome-1') {
      setMessages([
        {
          id: 'welcome-1',
          sender: 'orca',
          text: LOCALIZED_WELCOME[langCode] || LOCALIZED_WELCOME.en,
          timestamp: 'Just now',
          language: langCode,
        },
      ]);
    }
  };

  const handleMapAction = (uiAction: UIAction) => {
    if (!uiAction) return;
    setMapFocus(uiAction);
    router.push('/(tabs)/map');
  };

  // ---------------------------------------------------------------------------
  // Voice Input (Microphone Handler)
  // ---------------------------------------------------------------------------
  const toggleRecording = () => {
    if (isRecording) {
      if (activeRecognitionRef.current) {
        try {
          activeRecognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsRecording(false);
      return;
    }

    if (typeof window !== 'undefined' && (('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window))) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      try {
        const recognition = new SpeechRecognition();
        activeRecognitionRef.current = recognition;
        const langMap: Record<string, string> = {
          mr: 'mr-IN',
          hi: 'hi-IN',
          ta: 'ta-IN',
          te: 'te-IN',
          gu: 'gu-IN',
          en: 'en-IN',
        };
        recognition.lang = langMap[selectedLang] || 'mr-IN';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => setIsRecording(true);
        recognition.onresult = (event: any) => {
          const transcript = event.results?.[0]?.[0]?.transcript;
          if (transcript) {
            setInputText(transcript);
          }
          setIsRecording(false);
        };
        recognition.onerror = () => setIsRecording(false);
        recognition.onend = () => setIsRecording(false);

        recognition.start();
      } catch (err) {
        console.warn('SpeechRecognition start failed, fallback to sample:', err);
        fallbackVoiceSimulation();
      }
    } else {
      fallbackVoiceSimulation();
    }
  };

  const fallbackVoiceSimulation = () => {
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      const samples = LOCALIZED_QUESTIONS[selectedLang] || LOCALIZED_QUESTIONS.en;
      setInputText(samples[0]);
    }, 1200);
  };

  // ---------------------------------------------------------------------------
  // Voice Playback (Text-to-Speech Handler)
  // ---------------------------------------------------------------------------
  const handlePlayAudio = async (msg: ChatMessage) => {
    if (playingAudioId === msg.id) {
      if (currentAudioRef.current) {
        try {
          currentAudioRef.current.pause();
        } catch {}
        currentAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setPlayingAudioId(null);
      return;
    }

    try {
      setPlayingAudioId(msg.id);

      let audioB64 = msg.audio_base64;
      if (!audioB64) {
        audioB64 = (await synthesizeSpeech(msg.text, selectedLang)) || undefined;
        if (audioB64) {
          msg.audio_base64 = audioB64;
        }
      }

      if (audioB64 && typeof window !== 'undefined' && typeof Audio !== 'undefined') {
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
        }
        const audio = new Audio(`data:audio/wav;base64,${audioB64}`);
        currentAudioRef.current = audio;
        audio.onended = () => {
          setPlayingAudioId(null);
          currentAudioRef.current = null;
        };
        audio.onerror = () => {
          setPlayingAudioId(null);
          currentAudioRef.current = null;
        };
        await audio.play();
      } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(msg.text);
        const langMap: Record<string, string> = {
          mr: 'mr-IN',
          hi: 'hi-IN',
          ta: 'ta-IN',
          te: 'te-IN',
          gu: 'gu-IN',
          en: 'en-IN',
        };
        utterance.lang = langMap[selectedLang] || 'en-IN';
        utterance.onend = () => setPlayingAudioId(null);
        utterance.onerror = () => setPlayingAudioId(null);
        window.speechSynthesis.speak(utterance);
      } else {
        setPlayingAudioId(null);
      }
    } catch (err) {
      console.warn('Voice playback failed:', err);
      setPlayingAudioId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Send Message Flow
  // ---------------------------------------------------------------------------
  const handleSend = async (queryToSend?: string) => {
    const text = (queryToSend || inputText).trim();
    if (!text || isTyping) return;

    const userMsgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const userMessage: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language: selectedLang,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Build recent conversation history
    const history = messages
      .filter((m) => !m.isError)
      .slice(-6)
      .map((m) => ({
        role: m.sender === 'orca' ? 'assistant' : 'user',
        content: m.text,
      }));

    try {
      const response = await queryOrcaAssistant(text, {
        latitude: activeTrip.location.latitude,
        longitude: activeTrip.location.longitude,
        date: activeTrip.date,
        boat_width_m: activeTrip.boatWidthM,
        conversation_history: history,
        language: selectedLang,
        generate_audio: true,
      });

      const displayFlags: DisplayFlags | undefined =
        response.assessment?.display ||
        response.rawBackendResponse?.display;

      const shouldDisplayPFZ = Boolean(displayFlags?.pfz);
      const shouldDisplayRiskExplanation = Boolean(displayFlags?.risk_explanation);

      const topCands: PFZCandidate[] =
        response.assessment?.top_pfz ||
        response.rawBackendResponse?.top_pfz ||
        response.assessment?.pfz?.top_candidates ||
        response.rawBackendResponse?.pfz?.top_candidates ||
        response.uiAction?.top_candidates ||
        [];

      const riskExpl: RiskExplanation | undefined =
        response.assessment?.risk_explanation ||
        response.rawBackendResponse?.risk_explanation ||
        response.rawBackendResponse?.risk?.explanation_card ||
        undefined;

      const orcaMessage: ChatMessage = {
        id: `orca-${response.requestId || Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sender: 'orca',
        text: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ui_action: response.uiAction,
        top_candidates: shouldDisplayPFZ && topCands.length > 0 ? topCands : undefined,
        risk_explanation: shouldDisplayRiskExplanation ? riskExpl : undefined,
        display: displayFlags,
        language: response.assessment?.language || selectedLang,
        audio_base64: response.audioBase64 || response.assessment?.audio_base64,
      };

      setMessages((prev) => [...prev, orcaMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sender: 'orca',
        text: `Unable to connect to ORCA Backend: ${err?.message || 'Network error'}. Please ensure the server is running.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
        retryQuery: text,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, isTyping]);

  const currentQuestions = LOCALIZED_QUESTIONS[selectedLang] || LOCALIZED_QUESTIONS.en;

  const placeholders: Record<string, string> = {
    mr: 'मासेमारी, लाटा, PFZ बद्दल विचारा किंवा 🎤 बोला...',
    hi: 'मछली पकड़ने, लहरों या PFZ के बारे में पूछें या 🎤 बोलें...',
    en: 'Ask anything about waves, fishing zones, or 🎤 speak...',
    ta: 'மீன்பிடி, அலைகள் பற்றி கேளுங்கள் அல்லது 🎤 பேசுங்கள்...',
    te: 'చేపల వేట, అలల గురించి అడగండి లేదా 🎤 మాట్లాడండి...',
    gu: 'માછીમારી, મોજાં વિશે પૂછો અથવા 🎤 બોલો...',
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <OrcaHeader
        title="Ask ORCA"
        subtitle="AI-Powered Maritime Advisory with Bhashini Multilingual Voice"
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Active Trip Context Header Strip */}
        <View style={styles.contextStrip}>
          <View style={styles.contextPill}>
            <MapPin size={12} color={COLORS.oceanBlue} />
            <Text style={styles.contextPillText} numberOfLines={1}>
              {activeTrip.location.name}
            </Text>
          </View>

          <View style={styles.contextPill}>
            <Calendar size={12} color={COLORS.oceanBlue} />
            <Text style={styles.contextPillText}>
              {formatDateToFisherman(activeTrip.date)}
            </Text>
          </View>

          <View style={styles.contextPill}>
            <Ship size={12} color={COLORS.oceanBlue} />
            <Text style={styles.contextPillText}>
              {activeTrip.boatWidthM}m Vessel
            </Text>
          </View>
        </View>

        {/* Bhashini Language Selector Bar */}
        <View style={styles.languageBar}>
          <View style={styles.languageBarTitleRow}>
            <Languages size={14} color="#0284C7" />
            <Text style={styles.languageBarLabel}>Language / भाषा:</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.languageChipsRow}
          >
            {SUPPORTED_LANGUAGES_LIST.map((lang) => {
              const isSelected = selectedLang === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langChip, isSelected && styles.langChipActive]}
                  onPress={() => handleSelectLanguage(lang.code)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.langChipText, isSelected && styles.langChipTextActive]}>
                    {lang.nativeLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Quick Suggestion Chips */}
          <View style={styles.suggestionsWrapper}>
            <View style={styles.suggestionsHeader}>
              <Sparkles size={15} color={COLORS.oceanBlue} />
              <Text style={styles.suggestionsTitle}>
                {selectedLang === 'mr' ? 'त्वरित प्रश्न (Quick Inquiries)' : selectedLang === 'hi' ? 'त्वरित प्रश्न' : 'Quick Inquiries'}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {currentQuestions.map((q, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.questionChip}
                  onPress={() => handleSend(q)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Messages Feed */}
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isPlayingThis = playingAudioId === msg.id;

            return (
              <View
                key={msg.id}
                style={[
                  styles.messageBubbleWrapper,
                  isUser ? styles.userBubbleWrapper : styles.orcaBubbleWrapper,
                ]}
              >
                {!isUser && (
                  <View style={styles.botAvatar}>
                    <Compass size={17} color="#0284C7" strokeWidth={2.6} />
                  </View>
                )}

                <View
                  style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.orcaBubble,
                    msg.isError && styles.errorBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      isUser ? styles.userMessageText : styles.orcaMessageText,
                      msg.isError && styles.errorMessageText,
                    ]}
                  >
                    {msg.text}
                  </Text>

                  {msg.isError && msg.retryQuery && (
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={() => handleSend(msg.retryQuery)}
                      activeOpacity={0.7}
                    >
                      <RotateCcw size={13} color="#DC2626" />
                      <Text style={styles.retryText}>Retry Query</Text>
                    </TouchableOpacity>
                  )}

                  {/* Visual "WHY?" Risk Explanation Card */}
                  {msg.display?.risk_explanation === true && msg.risk_explanation && (
                    <RiskExplanationCard explanation={msg.risk_explanation} language={msg.language || selectedLang} />
                  )}

                  {/* Top 3 or Single PFZ Recommendation Cards */}
                  {msg.display?.pfz === true && msg.top_candidates && msg.top_candidates.length > 0 && (
                    <PFZTopCards
                      candidates={msg.top_candidates}
                      selectedRank={msg.ui_action?.rank || (msg.top_candidates.length === 1 ? msg.top_candidates[0].rank : 1)}
                      onSelect={(cand) => {
                        setSelectedPFZId(cand.id);
                        handleMapAction({
                          type: 'show_on_map',
                          target: 'pfz',
                          rank: cand.rank,
                          coordinates: cand.coordinates,
                          label: cand.label || `PFZ ${cand.rank}`,
                          geometry: cand.geometry,
                          zoom: 11,
                          top_candidates: msg.top_candidates,
                        });
                      }}
                      onViewAssessment={(cand) => {
                        setSelectedPFZId(cand.id);
                        router.push({
                          pathname: '/assessment',
                          params: {
                            pfzId: cand.id,
                            rank: String(cand.rank),
                          },
                        });
                      }}
                    />
                  )}

                  {msg.ui_action && msg.ui_action.type === 'show_on_map' && (!msg.top_candidates || msg.top_candidates.length === 0) && (
                    <TouchableOpacity
                      style={styles.mapActionButton}
                      onPress={() => handleMapAction(msg.ui_action!)}
                      activeOpacity={0.8}
                    >
                      <Map size={14} color="#FFFFFF" />
                      <Text style={styles.mapActionText}>
                        {msg.ui_action.label ? `View ${msg.ui_action.label} on Map` : 'Show on Interactive Map'}
                      </Text>
                      <Navigation size={12} color="#93C5FD" />
                    </TouchableOpacity>
                  )}

                  {/* Bubble Footer with Timestamp and Speaker 🔊 */}
                  <View style={styles.bubbleFooterRow}>
                    {!isUser && !msg.isError && (
                      <TouchableOpacity
                        style={[styles.audioPill, isPlayingThis && styles.audioPillActive]}
                        onPress={() => handlePlayAudio(msg)}
                        activeOpacity={0.7}
                        accessibilityLabel="Listen to Voice Advice"
                      >
                        <Volume2 size={13} color={isPlayingThis ? '#0284C7' : COLORS.textSecondary} />
                        <Text style={[styles.audioPillText, isPlayingThis && styles.audioPillTextActive]}>
                          {isPlayingThis ? 'Playing...' : '🔊 Listen'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <Text
                      style={[
                        styles.timestampText,
                        isUser ? styles.userTimestamp : styles.orcaTimestamp,
                      ]}
                    >
                      {msg.timestamp}
                    </Text>
                  </View>
                </View>

                {isUser && (
                  <View style={styles.userAvatar}>
                    <User size={16} color="#FFFFFF" strokeWidth={2.5} />
                  </View>
                )}
              </View>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <View style={[styles.messageBubbleWrapper, styles.orcaBubbleWrapper]}>
              <View style={styles.botAvatar}>
                <Compass size={17} color="#0284C7" strokeWidth={2.6} />
              </View>
              <View style={[styles.messageBubble, styles.orcaBubble, styles.typingBubble]}>
                <ActivityIndicator size="small" color={COLORS.oceanBlue} />
                <Text style={styles.typingText}>
                  {selectedLang === 'mr'
                    ? 'ORCA AI समुद्राचे विश्लेषण करत आहे...'
                    : selectedLang === 'hi'
                    ? 'ORCA AI समुद्र मॉडल का विश्लेषण कर रहा है...'
                    : 'ORCA AI is analyzing ocean models...'}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Recording Banner Indicator */}
        {isRecording && (
          <View style={styles.recordingBanner}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>
              {selectedLang === 'mr'
                ? 'ऐकत आहे... (Listening in Marathi)'
                : selectedLang === 'hi'
                ? 'सुन रहा हूँ... (Listening in Hindi)'
                : 'Listening...'}
            </Text>
          </View>
        )}

        {/* Chat Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.inputField}
            placeholder={placeholders[selectedLang] || placeholders.en}
            placeholderTextColor="#94A3B8"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
          />

          {/* Microphone Button 🎤 */}
          <TouchableOpacity
            style={[styles.micButton, isRecording && styles.micButtonActive]}
            onPress={toggleRecording}
            activeOpacity={0.8}
            accessibilityLabel="Voice input"
          >
            {isRecording ? (
              <MicOff size={19} color="#DC2626" />
            ) : (
              <Mic size={19} color="#0284C7" />
            )}
          </TouchableOpacity>

          {/* Send Button */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || isTyping}
            activeOpacity={0.8}
            accessibilityLabel="Send message"
          >
            <Send size={18} color={COLORS.textInverse} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
  },
  contextStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.skyBlueBorder,
    gap: 4,
  },
  contextPillText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 11,
  },
  languageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#07162C',
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(2, 132, 199, 0.25)',
    gap: 10,
  },
  languageBarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  languageBarLabel: {
    ...TYPOGRAPHY.caption,
    color: '#93C5FD',
    fontWeight: '700',
    fontSize: 11,
  },
  languageChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  langChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.3)',
  },
  langChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  langChipText: {
    ...TYPOGRAPHY.caption,
    color: '#CBD5E1',
    fontWeight: '700',
    fontSize: 11,
  },
  langChipTextActive: {
    color: '#FFFFFF',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: SPACING.md,
    paddingBottom: 20,
  },
  suggestionsWrapper: {
    marginBottom: SPACING.md,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  suggestionsTitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  chipsRow: {
    gap: 8,
  },
  questionChip: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.full,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: COLORS.skyBlueBorder,
    ...SHADOWS.sm,
  },
  chipText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.oceanBlue,
    fontWeight: '700',
  },
  messageBubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 16,
    gap: 8,
  },
  userBubbleWrapper: {
    justifyContent: 'flex-end',
  },
  orcaBubbleWrapper: {
    justifyContent: 'flex-start',
  },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.oceanBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  userBubble: {
    backgroundColor: COLORS.oceanBlue,
    borderBottomRightRadius: 2,
  },
  orcaBubble: {
    backgroundColor: COLORS.cardBg,
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  errorBubble: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  typingText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  messageText: {
    ...TYPOGRAPHY.bodyMedium,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  orcaMessageText: {
    color: COLORS.textPrimary,
  },
  errorMessageText: {
    color: '#DC2626',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
  },
  retryText: {
    ...TYPOGRAPHY.caption,
    color: '#DC2626',
    fontWeight: '700',
  },
  mapActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#0284C7',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    ...SHADOWS.sm,
  },
  mapActionText: {
    ...TYPOGRAPHY.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  bubbleFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  audioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  audioPillActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  audioPillText: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  audioPillTextActive: {
    color: '#0284C7',
  },
  timestampText: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  orcaTimestamp: {
    color: COLORS.textTertiary,
  },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#FCA5A5',
    gap: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  recordingText: {
    ...TYPOGRAPHY.caption,
    color: '#DC2626',
    fontWeight: '700',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  inputField: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.full,
    paddingHorizontal: 16,
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  micButtonActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.oceanBlue,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  sendButtonDisabled: {
    backgroundColor: '#CBD5E1',
    elevation: 0,
    shadowOpacity: 0,
  },
});
