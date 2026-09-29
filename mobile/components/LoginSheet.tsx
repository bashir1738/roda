import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Platform,
  TextInput, KeyboardAvoidingView,
} from 'react-native';
import Modal from 'react-native-modal';
import { useWallet } from '../providers/WalletContext';
import { friendlyError } from '../lib/sendTx';
import { Icon } from './Icon';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function LoginSheet() {
  const { loginVisible, closeLogin, loginWithEmail, isLoggingIn } = useWallet();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onClose = () => {
    setEmail('');
    setError(null);
    closeLogin();
  };

  const onSubmit = async () => {
    setError(null);
    try {
      await loginWithEmail(email);
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  const valid = EMAIL_RE.test(email.trim());

  return (
    <Modal
      isVisible={loginVisible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      backdropOpacity={0.55}
      style={{ justifyContent: 'flex-end', margin: 0 }}
      useNativeDriver
      useNativeDriverForBackdrop
      avoidKeyboard
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="bg-white dark:bg-[#121212] rounded-t-3xl px-6 pt-3 pb-10">
          <View className="self-center w-10 h-1 rounded-full bg-charcoal/15 mb-6" />

          <View className="items-center mb-7">
            <View className="w-14 h-14 rounded-2xl bg-primary items-center justify-center mb-4">
              <Icon name="leaf" size={28} color="#FFFFFF" />
            </View>
            <Text className="text-charcoal dark:text-white text-2xl font-black text-center">
              Welcome to Roda
            </Text>
            <Text className="text-muted dark:text-[#A1A1AA] text-sm text-center mt-2 leading-relaxed px-2">
              Sign in with your email. Magic creates a Solana wallet for you —
              no seed phrase, no password.
            </Text>
          </View>

          <View className="gap-3">
            <TextInput
              className="text-charcoal dark:text-white text-base bg-[#F8F9FA] dark:bg-white/8 px-4 py-4 rounded-2xl"
              style={{ borderWidth: 1, borderColor: '#D4C4E8' }}
              placeholder="you@example.com"
              placeholderTextColor="#6B6B6B"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              autoFocus
            />
            {error && (
              <Text className="text-red-500 text-sm px-1">{error}</Text>
            )}
            <TouchableOpacity
              className="bg-primary rounded-full py-4 items-center"
              onPress={onSubmit}
              disabled={!valid || isLoggingIn}
              style={{ opacity: !valid || isLoggingIn ? 0.3 : 1 }}
            >
              <Text className="text-white text-base font-bold">
                {isLoggingIn ? 'Waiting for code…' : 'Continue'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity className="py-3 items-center" onPress={onClose}>
              <Text className="text-muted dark:text-[#A1A1AA] text-sm">Not now</Text>
            </TouchableOpacity>
          </View>

          <Text className="text-muted dark:text-[#A1A1AA]/70 text-[11px] text-center mt-5 leading-relaxed">
            Your keys stay under your control. Devnet funds only.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
