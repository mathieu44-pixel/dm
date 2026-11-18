import { useCallback, useEffect, useRef, useState } from 'react'
import { pickVoice, rateValue, speechChunks, type SpeechRate } from '../engine/speech/speech'

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const now = window.speechSynthesis.getVoices()
  if (now.length) return Promise.resolve(now)
  // Sur Android, la liste arrive de façon asynchrone.
  return new Promise((resolve) => {
    const done = () => resolve(window.speechSynthesis.getVoices())
    window.speechSynthesis.addEventListener('voiceschanged', done, { once: true })
    setTimeout(done, 1500)
  })
}

/** Lecture à voix haute avec la synthèse vocale du téléphone (gratuite, hors connexion selon les voix). */
export function useSpeech(language: 'fr' | 'en', rate: SpeechRate | undefined) {
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const token = useRef(0)

  const stop = useCallback(() => {
    token.current++
    if (speechSupported) window.speechSynthesis.cancel()
    setSpeakingId(null)
  }, [])

  const speak = useCallback(
    async (id: string, content: string) => {
      if (!speechSupported) return
      stop()
      const mine = ++token.current
      const chunks = speechChunks(content)
      if (!chunks.length) return
      const voice = pickVoice(await loadVoices(), language)
      if (mine !== token.current) return
      setSpeakingId(id)
      chunks.forEach((chunk, i) => {
        const u = new SpeechSynthesisUtterance(chunk)
        u.lang = voice?.lang ?? (language === 'fr' ? 'fr-FR' : 'en-US')
        if (voice) u.voice = voice
        u.rate = rateValue(rate)
        if (i === chunks.length - 1) u.onend = u.onerror = () => mine === token.current && setSpeakingId(null)
        window.speechSynthesis.speak(u)
      })
    },
    [language, rate, stop],
  )

  // Arrêt en quittant l'écran.
  useEffect(() => stop, [stop])

  return { speakingId, speak, stop, supported: speechSupported }
}
