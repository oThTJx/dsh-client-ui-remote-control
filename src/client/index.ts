/** Remote-control pairing tab registered into Web Plugins settings. */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  RemoteControlSettingsTab,
  type RemoteControlSettingsTabInjected,
} from './RemoteControlSettingsTab.tsx'
import { en, zh, type RemoteControlLocaleKey } from './locales.ts'

export type { RemoteControlSettingsTabInjected, RemoteControlSettingsTabProps } from './RemoteControlSettingsTab.tsx'
export type { RemoteControlLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Remote-control pairing copy. */
    'settings.remoteControl': RemoteControlLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.remoteControl'

/** Services required by the Settings registration and generated Remote face. */
export const inject = ['slots', 'locale', 'remote', 'remote.remoteControl']

/** Contribute the lazy remote-control tab to the Plugins settings section. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-remote-control: dictionaries')

  const t = ctx.locale.bind(NS)
  const remote = ctx.remote.remoteControl

  const injected = (): RemoteControlSettingsTabInjected => ({
    pairing: async () => {
      const result = await remote.pairing()
      if (!result.ok) {
        throw new Error(`remoteControl.pairing failed: ${result.error.code}: ${result.error.message}`)
      }
      return result.value
    },
    sessions: async () => {
      const result = await remote.sessions()
      if (!result.ok) {
        throw new Error(`remoteControl.sessions failed: ${result.error.code}: ${result.error.message}`)
      }
      return result.value
    },
    revoke: async (sessionId: string) => {
      const result = await remote.revoke(sessionId)
      if (!result.ok) {
        throw new Error(`remoteControl.revoke failed: ${result.error.code}: ${result.error.message}`)
      }
      return result.value
    },
    resetIdentity: async () => {
      const result = await remote.resetIdentity()
      if (!result.ok) {
        throw new Error(`remoteControl.resetIdentity failed: ${result.error.code}: ${result.error.message}`)
      }
      return result.value
    },
  })

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'remote',
    order: 20,
    label: () => t('tab'),
    locale: NS,
    inject: injected,
  }, RemoteControlSettingsTab))
}
