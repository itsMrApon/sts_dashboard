/**
 * Vue 3 / Nuxt 3 bindings. Install the plugin once, then use the composables in any component;
 * every value is a ref your own design binds to.
 *
 *   // Nuxt: plugins/sts-ai.client.ts (the sts-ai CLI writes this for you)
 *   export default defineNuxtPlugin((nuxtApp) => {
 *     nuxtApp.vueApp.use(createStsPlugin({ apiBase: 'https://sudotechserve.com', siteKey: 'sts_pk_live_…' }))
 *   })
 *
 *   // any component
 *   const { messages, send, status } = useStsChat()
 */

import { computed, inject, onScopeDispose, shallowRef, type App, type InjectionKey, type Ref } from 'vue'
import { createSts, type StsClient } from './core.js'
import { createChat, createForm, createVoice } from './controllers.js'
import { createWizardPlayer, type WizardPlayer } from './wizardPlayer.js'
import type { StsAnswer, StsBusiness, StsOptions, StsReview, StsSessionInfo, StsWizard, StsWizardStep } from './types.js'

const STS_KEY: InjectionKey<StsClient> = Symbol('sts-ai')

/** `app.use(createStsPlugin({ apiBase, siteKey }))`: one client for the whole site. */
export function createStsPlugin(options: StsOptions) {
  return {
    install(app: App) {
      const client = createSts(options)
      app.provide(STS_KEY, client)
      app.config.globalProperties.$sts = client
    },
  }
}

export function useSts(): StsClient {
  const client = inject(STS_KEY, null)
  if (!client) throw new Error('Install the sts-ai plugin first: app.use(createStsPlugin({ apiBase, siteKey }))')
  return client
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong')

/** A ref that follows a controller, unsubscribed when the component goes away. */
function follow<T>(subscribe: (listener: (state: T) => void) => () => void): Ref<T> {
  const value = shallowRef() as Ref<T>
  const off = subscribe((state) => {
    value.value = state
  })
  onScopeDispose(off)
  return value
}

/** Loads something once into a ref (null until it arrives). */
function load<T>(task: () => Promise<T>) {
  const data = shallowRef<T | null>(null)
  const error = shallowRef<string | null>(null)
  task()
    .then((value) => {
      data.value = value
    })
    .catch((err) => {
      error.value = errorMessage(err)
    })
  return { data, error, ready: computed(() => data.value !== null) }
}

/** Business name + which services are turned on in sts-ai. */
export function useStsInfo() {
  const client = useSts()
  const { data, error } = load<StsSessionInfo>(() => client.info())
  return { info: data, error }
}

/** Chat AI as a service, for your own floating button, pop-up or page. */
export function useStsChat() {
  const client = useSts()
  const chat = createChat(client)
  const state = follow(chat.subscribe)
  const { info, error: infoError } = useStsInfo()
  const config = computed(() => info.value?.services.chat ?? null)
  return {
    /** false when Chat AI is off in sts-ai. */
    available: computed(() => Boolean(config.value)),
    greeting: computed(() => config.value?.greeting ?? ''),
    suggestions: computed(() => config.value?.suggestions ?? []),
    documentRequests: computed(() => config.value?.documentRequests ?? []),
    messages: computed(() => state.value.messages),
    status: computed(() => state.value.status),
    error: computed(() => state.value.error ?? infoError.value),
    send: chat.send,
    attach: chat.attach,
    reset: chat.reset,
  }
}

/** Voice AI as a service: call `start()` from your orb or button; `agentLevel` animates it. */
export function useStsSpeak() {
  const voice = createVoice(useSts())
  const state = follow(voice.subscribe)
  onScopeDispose(() => void voice.stop())
  return {
    state: computed(() => state.value.state),
    isAgentSpeaking: computed(() => state.value.isAgentSpeaking),
    muted: computed(() => state.value.muted),
    captions: computed(() => state.value.captions),
    agentLevel: computed(() => state.value.agentLevel),
    error: computed(() => state.value.error),
    start: voice.start,
    stop: voice.stop,
    setMuted: voice.setMuted,
  }
}

/** The business's form as a service: your fields and layout, its questions and inbox. */
export function useStsForm() {
  const form = createForm(useSts())
  const state = follow(form.subscribe)
  return {
    form: computed(() => state.value.form),
    values: computed(() => state.value.values),
    consent: computed(() => state.value.consent),
    status: computed(() => state.value.status),
    message: computed(() => state.value.message),
    fieldError: computed(() => state.value.fieldError),
    setValue: form.setValue,
    setConsent: form.setConsent,
    submit: form.submit,
  }
}

/**
 * The voice tour on your own page. Tag sections with `data-sts-step="…"` and style
 * `[data-sts-active]`. `follow()` speaks each section as the visitor scrolls to it; `play('pricing')`
 * speaks one step from your own event.
 */
export function useStsWizard(slug?: string) {
  const client = useSts()
  const wizard = shallowRef<StsWizard | null>(null)
  const error = shallowRef<string | null>(null)
  const step = shallowRef<StsWizardStep | null>(null)
  const speaking = shallowRef(false)
  const playing = shallowRef(false)
  let player: WizardPlayer | null = null

  const slugReady = slug
    ? Promise.resolve(slug)
    : client.info().then((info) => {
        const first = info.services.wizards[0]?.slug
        if (!first) throw new Error('No published tour for this business')
        return first
      })
  slugReady
    .then((value) => client.wizard.load(value))
    .then((value) => {
      wizard.value = value
    })
    .catch((err) => {
      error.value = errorMessage(err)
    })

  function ensurePlayer() {
    if (!wizard.value) return null
    if (!player) {
      player = createWizardPlayer(wizard.value, {
        onStep: (current) => {
          step.value = current
        },
        onSpeakingChange: (value) => {
          speaking.value = value
        },
        onEnd: () => {
          playing.value = false
        },
      })
    }
    return player
  }

  onScopeDispose(() => player?.stop())

  return {
    wizard,
    ready: computed(() => Boolean(wizard.value)),
    step,
    caption: computed(() => step.value?.narration ?? ''),
    speaking,
    playing,
    error,
    /** The tour leads: scrolls to each section and narrates it. Call from a click. */
    start: () => {
      playing.value = true
      ensurePlayer()?.start()
    },
    /** The visitor leads: each section speaks when they scroll to it. Call from a click first. */
    follow: () => {
      playing.value = true
      ensurePlayer()?.follow()
    },
    /** One step from your own event, by id or `data-sts-step` name. */
    play: (name: string) => ensurePlayer()?.play(name) ?? false,
    /** Call from any click so later `play()` calls can make sound. */
    unlock: () => ensurePlayer()?.unlock(),
    stop: () => {
      player?.stop()
      playing.value = false
    },
    setMuted: (value: boolean) => ensurePlayer()?.setMuted(value),
  }
}

/** Business details (name, description, profile) for your own about or footer block. */
export function useStsBusiness() {
  const client = useSts()
  const { data, error, ready } = load<StsBusiness>(() => client.business.get())
  return { business: data, error, ready }
}

/** The business's own answers, for an FAQ block. */
export function useStsAnswers() {
  const client = useSts()
  const { data, error, ready } = load<StsAnswer[]>(() => client.business.answers())
  return { answers: computed(() => data.value ?? []), error, ready }
}

/** Reviews the business chose to show. */
export function useStsReviews() {
  const client = useSts()
  const { data, error, ready } = load<StsReview[]>(() => client.business.reviews())
  return { reviews: computed(() => data.value ?? []), error, ready }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $sts: StsClient
  }
}
