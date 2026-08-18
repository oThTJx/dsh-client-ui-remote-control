/** Remote-control pairing tab registered into Web Plugins settings. */

import remoteControlRemote from '@firefly0621/dsh-remote-control/remote'
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

/** Services required by the Settings registration and the generated Remote face. */
export const inject = ['slots', 'locale', 'remote']

/**
 * Mount the plugin's own Remote namespace and contribute the lazy pairing tab
 * to the Plugins settings section. The namespace mounts here rather than in
 * the api-remotes assembly so the browser half works on every dsh family
 * version without the official package depending on this plugin.
 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(remoteControlRemote)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-remote-control: dictionaries')

  const t = ctx.locale.bind(NS)
  // The namespace is mounted by this apply, so it cannot be an inject
  // dependency (the fiber would wait for its own apply); read it from the
  // registry once the mount above settles.
  const remote = ctx.get('remote.remoteControl') as ClientContext['remote']['remoteControl']

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
    testConnection: async () => {
      const result = await remote.testConnection()
      if (!result.ok) {
        throw new Error(`remoteControl.testConnection failed: ${result.error.code}: ${result.error.message}`)
      }
      return result.value
    },
    setRelayUrl: async (url: string) => {
      const result = await remote.setRelayUrl(url)
      if (!result.ok) {
        throw new Error(`remoteControl.setRelayUrl failed: ${result.error.code}: ${result.error.message}`)
      }
      return result.value
    },
    connect: async () => {
      const result = await remote.connect()
      if (!result.ok) {
        throw new Error(`remoteControl.connect failed: ${result.error.code}: ${result.error.message}`)
      }
      return result.value
    },
    disconnect: async () => {
      const result = await remote.disconnect()
      if (!result.ok) {
        throw new Error(`remoteControl.disconnect failed: ${result.error.code}: ${result.error.message}`)
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

  return unmount
}
