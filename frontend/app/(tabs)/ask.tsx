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
import { Send, User, Sparkles, Compass, RotateCcw } from 'lucide-react-native';
import { OrcaHeader } from '../../components/OrcaHeader';
import { queryOrcaAssistant } from '../../services/api';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

interface ChatMessage {
  id: string;
  sender: 'user' | 'orca';
  text: string;
  timestamp: string;
  isError?: boolean;
  retryQuery?: string;
}

export default function AskOrcaScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'orca',
      text: 'Namaste! I am ORCA, your Marine Intelligence Assistant. Ask me anything about sea conditions, fishing zones, or boat safety before sailing.',
      timestamp: 'Just now',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const sampleQuestions = [
    'Is it safe for me to go fishing today?',
    'Can I go fishing tomorrow?',
    'Where is the nearest fishing zone?',
    'Are the waves safe today?',
    'I have a 5m boat. Can I go tomorrow?',
  ];

  const handleSend = async (queryToSend?: string) => {
    const text = (queryToSend || inputText).trim();
    if (!text || isTyping) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      const response = await queryOrcaAssistant(text);
      const orcaMessage: ChatMessage = {
        id: `orca-${Date.now()}`,
        sender: 'orca',
        text: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, orcaMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
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
        subtitle="Ask anything about your fishing trip"
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
});
