import { useEffect } from 'react';
import Constants from 'expo-constants';

const TASK_NAME = 'roda-background-check';
const IN_EXPO_GO = Constants.appOwnership === 'expo';
const INTERVAL_SECONDS = 15 * 60; // 15 minutes
let taskDefined = false;

// All native modules are loaded lazily via require() inside try/catch so that a
// missing/removed module (e.g. expo-notifications in Expo Go on SDK 53+) never
// throws at import time and crashes the root layout.

async function runChecks(Notifications: any) {
  // Runs in a background task — no React context available. Load the device
  // wallet straight from SecureStore and read the chain directly.
  const { loadKeypair } = require('../lib/wallet');
  const { getProgram } = require('../lib/program');
  const { MEMBER_OWNER_OFFSET } = require('../lib/pdas');
  const { toNumber, variantIndex } = require('../lib/decode');

  const keypair = await loadKeypair();
  if (!keypair) return;
  const address = keypair.publicKey.toBase58();

  const program = getProgram();
  const members = await program.account.circleMember.all([
    { memcmp: { offset: MEMBER_OWNER_OFFSET, bytes: address } },
  ]);
  if (!members?.length) return;

  const circleKeys = members.map((m: any) => m.account.circle);
  const infos = await program.account.circle.fetchMultiple(circleKeys);

  const now = Math.floor(Date.now() / 1000);
  const PAID_NONE = 65535;

  infos.forEach((info: any, i: number) => {
    if (!info) return; // circle closed
    const status = variantIndex(info.status, ['active', 'completed']);
    if (status !== 0) return; // only active circles

    const name = info.name ?? 'your circle';
    const frequency = toNumber(info.frequencySecs);
    const roundStarted = toNumber(info.roundStartedTs);
    const paidCount = Number(info.paidCount);
    const memberCount = Number(info.memberCount);
    const poolBalance = toNumber(info.poolBalance);

    // All paid → pot claimable by this round's recipient.
    if (paidCount >= memberCount && memberCount > 0 && poolBalance > 0) {
      const membersVec: any[] = info.members ?? [];
      const recipient = membersVec[toNumber(info.currentRound) % memberCount];
      const isMine = recipient && recipient.toBase58() === address;
      if (isMine) {
        sendNotification(Notifications, '🎉 Your payout is ready', `Claim your payout from ${name}`);
      }
      return;
    }

    // Round window closing within 24h → contribution due soon.
    const closesAt = roundStarted + frequency;
    const hoursUntil = (closesAt - now) / 3600;
    if (hoursUntil > 0 && hoursUntil <= 24) {
      sendNotification(
        Notifications,
        '⏰ Contribution due soon',
        `${name} closes in ${Math.round(hoursUntil)}h`
      );
    }
  });
}

async function sendNotification(Notifications: any, title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}

async function setup() {
  // These throw in Expo Go (SDK 53+) — caught by the caller.
  const Notifications = require('expo-notifications');
  const BackgroundFetch = require('expo-background-fetch');
  const TaskManager = require('expo-task-manager');

  // In Expo Go (SDK 53+) the native module is not bundled — bail cleanly.
  if (!Notifications?.setNotificationHandler) throw new Error('Native notification module unavailable — use a dev build');

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (!taskDefined) {
    TaskManager.defineTask(TASK_NAME, async () => {
      try {
        await runChecks(Notifications);
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
    taskDefined = true;
  }

  const perm = await Notifications.requestPermissionsAsync();
  const granted = perm?.granted === true || perm?.status === 'granted';
  if (!granted) return;

  const registered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (!registered) {
    await BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: INTERVAL_SECONDS,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  }
}

export function useNotifications() {
  useEffect(() => {
    if (IN_EXPO_GO) return;
    setup().catch(() => {
      if (__DEV__) console.info('[Roda] Push + background tasks require a dev build — skipped in Expo Go.');  
    });
  }, []);
}

// Fire a vault-matured notification on demand (best-effort; no-ops in Expo Go).
export async function notifyVaultMatured(vaultTier: string) {
  try {
    const Notifications = require('expo-notifications');
    const perm = await Notifications.requestPermissionsAsync();
    if (!(perm?.granted === true || perm?.status === 'granted')) return;
    await sendNotification(Notifications, '✅ Vault matured', `Your ${vaultTier} Vault is ready to claim`);
  } catch {
    // Unavailable in Expo Go — ignore.
  }
}
