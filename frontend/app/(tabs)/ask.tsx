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
  Map,
  Navigation,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Languages,
  Globe,
} from 'lucide-react-native';
import { OrcaHeader } from '../../components/OrcaHeader';
import { PFZCard } from '../../components/PFZCard';
import { queryOrcaAssistant, SUPPORTED_LANGUAGES } from '../../services/api';
import { getActiveTrip, subscribeToTrip } from '../../services/tripStore';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { UIAction, PFZCandidate, DisplayFlags, OrcaResponse } from '../../types/orca';

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
  assessment?: OrcaResponse;
  audioBase64?: string | null;
  audioFormat?: string;
  language?: string;
  originalText?: string;
}

export default function AskOrcaScreen() {
  const router = useRouter();
  const [activeTrip, setActiveTrip] = useState(getActiveTrip());
  const [selectedLanguage, setSelectedLanguage] = useState<string>('auto');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'orca',
      text: 'Namaste! I am ORCA, your Marine Intelligence Assistant. Ask me anything about sea conditions, fishing zones, or boat safety in your preferred language.',
      timestamp: 'Just now',
      language: 'en',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const unsubscribe = subscribeToTrip((trip) => {
      setActiveTrip(trip);
    });
    return () => unsubscribe();
  }, []);

  const sampleQuestionsByLang: Record<string, string[]> = {
    mr: [
      'उद्या मासेमारीला जाणं सुरक्षित आहे का?',
      'सर्वात जवळचे मासेमारी क्षेत्र कुठे आहे?',
      '5 मीटर बोटीसाठी लाटा सुरक्षित आहेत का?',
      'स्थानिक हवामान आणि वाऱ्याचा वेग काय आहे?',
    ],
    hi: [
      'क्या कल मछली पकड़ना सुरक्षित है?',
      'निकटतम मछली पकड़ने का क्षेत्र कहाँ है?',
      'क्या 5 मीटर नाव के लिए समुद्र सुरक्षित है?',
      'आज समुद्र में लहरें और हवा कैसी हैं?',
    ],
    en: [
      'Is it safe for me to go fishing today?',
      'Can I go fishing tomorrow?',
      'Where is the nearest fishing zone?',
      'Are the waves safe for a 5m boat?',
    ],
    ta: [
      'மீன்பிடிக்க செல்வது பாதுகாப்பானதா?',
      'அருகிலுள்ள மீன்பிடி மண்டலம் எங்கே?',
      'அலைகள் பாதுகாப்பானவையா?',
    ],
    te: [
      'చేపల వేటకు వెళ్లడం సురక్షితమేనా?',
      'సమీపంలోని చేపల వేట ప్రాంతం ఎక్కడ ఉంది?',
    ],
    gu: [
      'કાલે માછીમારી કરવી સલામત છે?',
      'સૌથી નજીકનું ફિશિંગ ઝોન ક્યાં છે?',
    ],
    bn: [
      'কাল মাছ ধরতে যাওয়া কি নিরাপদ?',
      'নিকটতম মাছ ধরার অঞ্চল কোথায়?',
    ],
  };

  const sampleQuestions = sampleQuestionsByLang[selectedLanguage] || sampleQuestionsByLang['en'];

  const playAudio = (audioBase64: string, format = 'wav', msgId: string) => {
    if (!audioBase64) return;

    if (playingAudioId === msgId) {
      setPlayingAudioId(null);
      return;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).Audio) {
      try {
        const audio = new (window as any).Audio(`data:audio/${format};base64,${audioBase64}`);
        setPlayingAudioId(msgId);
        audio.onended = () => setPlayingAudioId(null);
        audio.onerror = () => setPlayingAudioId(null);
        audio.play().catch(() => setPlayingAudioId(null));
      } catch (e) {
        console.warn('Audio playback error:', e);
        setPlayingAudioId(null);
      }
    } else {
      // Native audio indicator animation
      setPlayingAudioId(msgId);
      setTimeout(() => setPlayingAudioId(null), 3500);
    }
  };

  const handleVoiceRecord = async () => {
    if (isRecording || isTyping) return;
    setIsRecording(true);

    // Natural voice prompt simulation in selected regional language
    const voicePrompts: Record<string, string> = {
      mr: 'उद्या मासेमारीला जाणं सुरक्षित आहे का?',
      hi: 'क्या कल मछली पकड़ना सुरक्षित है?',
      ta: 'மீன்பிடிக்க செல்வது பாதுகாப்பானதா?',
      te: 'చేపల వేటకు వెళ్లడం సురక్షితమేనా?',
      gu: 'કાલે માછીમારી કરવી સલામત છે?',
      bn: 'কাল মাছ ধরতে যাওয়া কি নিরাপদ?',
      en: 'Is it safe for me to go fishing tomorrow?',
    };
    const voiceText = voicePrompts[selectedLanguage] || voicePrompts['en'];
    // Valid standard 44-byte WAV header base64 payload for ASR
    const dummyWavB64 = 'UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

    setTimeout(() => {
      setIsRecording(false);
      handleSend(voiceText, dummyWavB64);
    }, 1200);
  };

  const handleMapAction = () => {
    router.push('/(tabs)/map');
  };

  const handleSend = async (queryToSend?: string, voiceAudioBase64?: string) => {
    const text = (queryToSend || inputText).trim();
    if (!text || isTyping) return;

    const userMsgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const userMessage: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language: selectedLanguage,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Build recent conversation history for backend context
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
        language: selectedLanguage !== 'auto' ? selectedLanguage : undefined,
        audio_base64: voiceAudioBase64,
        enable_tts: true,
      });

      const orcaMessage: ChatMessage = {
        id: `orca-${response.requestId || Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sender: 'orca',
        text: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        assessment: response.assessment,
        ui_action: response.uiAction,
        audioBase64: response.audioBase64,
        audioFormat: response.audioFormat || 'wav',
        language: response.language,
        originalText: response.originalRecommendation,
      };
      setMessages((prev) => [...prev, orcaMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sender: 'orca',
        text: `Unable to connect to ORCA Backend: ${err?.message || 'Network error'}. Please verify the backend server is running.`,
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <OrcaHeader
        title="Ask ORCA"
        subtitle={`Active Spot: ${activeTrip.location.name} (${activeTrip.location.latitude.toFixed(2)}°N, ${activeTrip.location.longitude.toFixed(2)}°E)`}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Bhashini Multilingual Language Selector Strip */}
        <View style={styles.languageStrip}>
          <View style={styles.languageHeader}>
            <Languages size={13} color={COLORS.oceanBlue} />
            <Text style={styles.languageHeaderText}>Language / भाषा:</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.languageScroll}>
            <TouchableOpacity
              style={[styles.langPill, selectedLanguage === 'auto' && styles.langPillActive]}
              onPress={() => setSelectedLanguage('auto')}
              activeOpacity={0.7}
            >
              <Globe size={11} color={selectedLanguage === 'auto' ? '#FFFFFF' : COLORS.textSecondary} />
              <Text style={[styles.langPillText, selectedLanguage === 'auto' && styles.langPillTextActive]}>
                Auto Detect
              </Text>
            </TouchableOpacity>

            {SUPPORTED_LANGUAGES.map((lang) => {
              const isActive = selectedLanguage === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langPill, isActive && styles.langPillActive]}
                  onPress={() => setSelectedLanguage(lang.code)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.langPillText, isActive && styles.langPillTextActive]}>
                    {lang.native} ({lang.code.toUpperCase()})
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
              <Sparkles size={16} color={COLORS.oceanBlue} />
              <Text style={styles.suggestionsTitle}>Suggested Questions</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {sampleQuestions.map((q, idx) => (
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
            const isPlaying = playingAudioId === msg.id;

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
                    <Compass size={18} color="#0284C7" strokeWidth={2.5} />
                  </View>
                )}

                <View
                  style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.orcaBubble,
                    msg.isError && styles.errorBubble,
                  ]}
                >
                  {/* ORCA answer text */}
                  <Text
                    style={[
                      styles.messageText,
                      isUser ? styles.userMessageText : styles.orcaMessageText,
                      msg.isError && styles.errorMessageText,
                    ]}
                  >
                    {msg.text}
                  </Text>

                  {/* Play Answer (Bhashini Voice) */}
                  {!isUser && msg.audioBase64 && (
                    <TouchableOpacity
                      style={[
                        styles.audioPlayButton,
                        isPlaying && styles.audioPlayButtonActive,
                      ]}
                      onPress={() => playAudio(msg.audioBase64!, msg.audioFormat, msg.id)}
                      activeOpacity={0.8}
                    >
                      {isPlaying ? (
                        <VolumeX size={13} color="#FFFFFF" />
                      ) : (
                        <Volume2 size={13} color={COLORS.oceanBlue} />
                      )}
                      <Text
                        style={[
                          styles.audioPlayText,
                          isPlaying && styles.audioPlayTextActive,
                        ]}
                      >
                        {isPlaying ? 'Playing Voice...' : 'Play Answer (Bhashini Voice)'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Existing PFZ Cards */}
                  {!isUser && msg.assessment?.pfz?.available && msg.assessment.pfz.nearest && (
                    <View style={styles.pfzCardWrapper}>
                      <PFZCard pfz={msg.assessment.pfz} onViewOnMap={handleMapAction} />
                    </View>
                  )}

                  {/* Show on Interactive Map Action */}
                  {!isUser && msg.ui_action?.type === 'show_on_map' && (!msg.assessment?.pfz?.available || !msg.assessment.pfz.nearest) && (
                    <TouchableOpacity
                      style={styles.mapActionButton}
                      onPress={handleMapAction}
                      activeOpacity={0.8}
                    >
                      <Map size={14} color="#FFFFFF" />
                      <Text style={styles.mapActionText}>
                        {msg.ui_action.label ? `View ${msg.ui_action.label} on Map` : 'Show on Interactive Map'}
                      </Text>
                      <Navigation size={12} color="#93C5FD" />
                    </TouchableOpacity>
                  )}

                  {msg.isError && msg.retryQuery && (
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={() => handleSend(msg.retryQuery)}
                      activeOpacity={0.7}
                    >
                      <RotateCcw size={14} color="#DC2626" />
                      <Text style={styles.retryText}>Retry Query</Text>
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

                {isUser && (
                  <View style={styles.userAvatar}>
                    <User size={18} color="#FFFFFF" />
                  </View>
                )}
              </View>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <View style={[styles.messageBubbleWrapper, styles.orcaBubbleWrapper]}>
              <View style={styles.botAvatar}>
                <Compass size={18} color="#0284C7" strokeWidth={2.5} />
              </View>
              <View style={[styles.messageBubble, styles.orcaBubble, styles.typingBubble]}>
                <ActivityIndicator size="small" color={COLORS.oceanBlue} />
                <Text style={styles.typingText}>ORCA is analyzing...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Chat Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.inputField}
            placeholder={
              selectedLanguage === 'mr'
                ? 'लाटा, मासेमारी क्षेत्र किंवा हवामानाबद्दल विचारा...'
                : selectedLanguage === 'hi'
                ? 'समुद्र, मछली पकड़ने के क्षेत्र के बारे में पूछें...'
                : 'Ask anything about waves, fishing zones...'
            }
            placeholderTextColor="#94A3B8"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
          />

          {/* Microphone Voice Button */}
          <TouchableOpacity
            style={[
              styles.micButton,
              isRecording && styles.micButtonActive,
            ]}
            onPress={handleVoiceRecord}
            disabled={isTyping}
            activeOpacity={0.8}
            accessibilityLabel="Speak message using Bhashini"
          >
            {isRecording ? (
              <MicOff size={18} color="#FFFFFF" />
            ) : (
              <Mic size={18} color={COLORS.oceanBlue} />
            )}
          </TouchableOpacity>

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
            <Send size={20} color={COLORS.textInverse} />
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
  },
  chipsRow: {
    gap: 8,
  },
  questionChip: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.full,
    paddingVertical: 8,
    paddingHorizontal: 14,
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
    marginVertical: 6,
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
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.oceanBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBubble: {
    maxWidth: '85%',
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
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 2,
  },
  errorBubble: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  typingText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  messageText: {
    ...TYPOGRAPHY.bodyLarge,
    fontSize: 14,
    lineHeight: 22,
  },
  userMessageText: {
    color: COLORS.textInverse,
    fontWeight: '600',
  },
  orcaMessageText: {
    color: COLORS.textPrimary,
  },
  errorMessageText: {
    color: '#991B1B',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  retryText: {
    ...TYPOGRAPHY.caption,
    color: '#DC2626',
    fontWeight: '700',
  },
  timestampText: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  orcaTimestamp: {
    color: COLORS.textTertiary,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
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
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  languageStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  languageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  languageHeaderText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.oceanBlue,
    fontWeight: '800',
    fontSize: 11,
  },
  languageScroll: {
    gap: 6,
    paddingRight: 10,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  langPillActive: {
    backgroundColor: COLORS.oceanBlue,
    borderColor: COLORS.oceanBlue,
  },
  langPillText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 11,
  },
  langPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  audioPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    marginTop: 8,
    marginBottom: 4,
  },
  audioPlayButtonActive: {
    backgroundColor: COLORS.oceanBlue,
    borderColor: COLORS.oceanBlue,
  },
  audioPlayText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.oceanBlue,
    fontWeight: '700',
    fontSize: 11,
  },
  audioPlayTextActive: {
    color: '#FFFFFF',
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  micButtonActive: {
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
  },
  pfzCardWrapper: {
    marginTop: 8,
    width: '100%',
  },
  mapActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.oceanBlue,
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
});
