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
import { Send, User, Sparkles, Compass, RotateCcw, MapPin, Calendar, Ship, Waves, Map, Navigation } from 'lucide-react-native';
import { OrcaHeader } from '../../components/OrcaHeader';
import { PFZTopCards } from '../../components/PFZTopCards';
import { RiskExplanationCard } from '../../components/RiskExplanationCard';
import { queryOrcaAssistant } from '../../services/api';
import { getActiveTrip, subscribeToTrip } from '../../services/tripStore';
import { setMapFocus } from '../../services/mapFocusStore';
import { formatDateToFisherman } from '../../utils/formatting';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { UIAction, PFZCandidate, DisplayFlags, RiskExplanation } from '../../types/orca';

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
}

export default function AskOrcaScreen() {
  const router = useRouter();
  const [activeTrip, setActiveTrip] = useState(getActiveTrip());
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'orca',
      text: 'Namaste! I am ORCA, your Marine Intelligence Assistant. Ask me anything about sea conditions, fishing zones, wave safety, or boat advisories.',
      timestamp: 'Just now',
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

  const sampleQuestions = [
    'Is it safe for me to go fishing today?',
    'Can I go fishing tomorrow?',
    'Where is the nearest fishing zone?',
    'Tell me 2nd PFZ from my location',
    'Are the waves safe for a 5m boat?',
  ];

  const handleMapAction = (uiAction: UIAction) => {
    if (!uiAction) return;
    setMapFocus(uiAction);
    router.push('/(tabs)/map');
  };

  const handleSend = async (queryToSend?: string) => {
    const text = (queryToSend || inputText).trim();
    if (!text || isTyping) return;

    const userMsgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const userMessage: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <OrcaHeader
        title="Ask ORCA"
        subtitle="AI-Powered Maritime Advisory Assistant"
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
              <Text style={styles.suggestionsTitle}>Quick Inquiries</Text>
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

                  {/* Visual "WHY?" Risk Explanation Card - Only when display.risk_explanation is explicitly true */}
                  {msg.display?.risk_explanation === true && msg.risk_explanation && (
                    <RiskExplanationCard explanation={msg.risk_explanation} showDecisionBanner={true} />
                  )}

                  {/* Top 3 or Single PFZ Recommendation Cards - Only when display.pfz is explicitly true */}
                  {msg.display?.pfz === true && msg.top_candidates && msg.top_candidates.length > 0 && (
                    <PFZTopCards
                      candidates={msg.top_candidates}
                      selectedRank={msg.ui_action?.rank || (msg.top_candidates.length === 1 ? msg.top_candidates[0].rank : 1)}
                      onSelect={(cand) =>
                        handleMapAction({
                          type: 'show_on_map',
                          target: 'pfz',
                          rank: cand.rank,
                          coordinates: cand.coordinates,
                          label: cand.label || `PFZ ${cand.rank}`,
                          geometry: cand.geometry,
                          zoom: 11,
                          top_candidates: msg.top_candidates,
                        })
                      }
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
                <Text style={styles.typingText}>ORCA AI is analyzing ocean models...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Chat Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.inputField}
            placeholder="Ask anything about waves, fishing zones..."
            placeholderTextColor="#94A3B8"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
          />

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
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.oceanBlue,
    justifyContent: 'center',
    alignItems: 'center',
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
    lineHeight: 21,
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
    width: 46,
    height: 46,
    borderRadius: 23,
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
