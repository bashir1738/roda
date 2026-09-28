import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Platform,
  TextInput, KeyboardAvoidingView,
} from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../providers/WalletContext';
import { friendlyError } from '../lib/sendTx';

export function LoginSheet() {
  const { loginVisible, closeLogin, createWallet, importWallet, isLoggingIn } = useWallet();
  const [mode, setMode] = useState<'choose' | 'import'>('choose');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onClose = () => {
    setMode('choose');
    setSecret('');
    setError(null);
    closeLogin();
  };

  const onCreate = async () => {
    setError(null);
    try {
      await createWallet();
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  const onImport = async () => {
    setError(null);
    try {
      await importWallet(secret);
    } catch (e) {
      setError(friendlyError(e));
    }
  };

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
              <Ionicons name="leaf" size={28} color="#FFFFFF" />
            </View>
            <Text className="text-charcoal dark:text-white text-2xl font-black text-center">
              {mode === 'choose' ? 'Your Roda Wallet' : 'Import Wallet'}
            </Text>
            <Text className="text-muted dark:text-[#A1A1AA] text-sm text-center mt-2 leading-relaxed px-2">
              {mode === 'choose'
                ? 'A Solana wallet is created on this device and secured by your OS keychain. No email, no password.'
                : 'Paste the base58 secret key of an existing Solana wallet (e.g. Phantom export).'}
            </Text>
          </View>

          {mode === 'choose' ? (
            <View className="gap-3">
              <TouchableOpacity
                className="bg-primary rounded-full py-4 items-center flex-row justify-center gap-2"
                onPress={onCreate}
                disabled={isLoggingIn}
                style={{ opacity: isLoggingIn ? 0.6 : 1 }}
              >
                <Ionicons name="wallet" size={18} color="#FFFFFF" />
                <Text className="text-white text-base font-bold">
                  {isLoggingIn ? 'Creating…' : 'Create New Wallet'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="rounded-full py-4 items-center flex-row justify-center gap-2 border border-primary"
                onPress={() => setMode('import')}
                disabled={isLoggingIn}
              >
                <Ionicons name="download-outline" size={18} color="#421F6D" />
                <Text className="text-primary text-base font-bold">Import Existing Wallet</Text>
              </TouchableOpacity>

              <TouchableOpacity className="py-3 items-center" onPress={onClose}>
                <Text className="text-muted dark:text-[#A1A1AA] text-sm">Not now</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="gap-3">
              <TextInput
                className="text-charcoal dark:text-white text-base bg-[#F8F9FA] dark:bg-white/8 px-4 py-4 rounded-2xl"
                style={{ borderWidth: 1, borderColor: '#D4C4E8' }}
                placeholder="Base58 secret key"
                placeholderTextColor="#6B6B6B"
                value={secret}
                onChangeText={(v) => {
                  setSecret(v);
                  setError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                secureTextEntry
              />
              {error && (
                <Text className="text-red-500 text-sm px-1">{error}</Text>
              )}
              <TouchableOpacity
                className="bg-primary rounded-full py-4 items-center"
                onPress={onImport}
                disabled={!secret.trim() || isLoggingIn}
                style={{ opacity: !secret.trim() || isLoggingIn ? 0.3 : 1 }}
              >
                <Text className="text-white text-base font-bold">
                  {isLoggingIn ? 'Importing…' : 'Import Wallet'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity className="py-3 items-center" onPress={() => setMode('choose')}>
                <Text className="text-muted dark:text-[#A1A1AA] text-sm">Back</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text className="text-muted dark:text-[#A1A1AA]/70 text-[11px] text-center mt-5 leading-relaxed">
            Your keys stay on this device — secured with SecureStore. Devnet funds only.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
