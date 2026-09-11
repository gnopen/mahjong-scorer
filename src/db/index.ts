/**
 * Picks the persistence backend once, at startup. Supabase when the project
 * URL and anon key are present, on-device storage otherwise, so the app is
 * fully usable before anyone has set up a backend.
 */

import { LocalStore } from './localStore'
import { SupabaseStore, supabaseConfig } from './supabaseStore'
import type { Store } from './types'

let instance: Store | null = null

export function store(): Store {
  if (instance) return instance
  const cfg = supabaseConfig()
  instance = cfg ? new SupabaseStore(cfg.url, cfg.key) : new LocalStore()
  return instance
}

export function backendLabel(): string {
  return store().kind === 'supabase'
    ? 'Synced through Supabase'
    : 'Saved on this device only'
}

/**
 * Stores a hand photo. Supabase gets a real upload into the `hands` bucket;
 * on-device storage keeps the data URL, which is small enough after the
 * capture screen has downscaled it.
 */
export async function savePhoto(gameId: string, dataUrl: string): Promise<string | null> {
  const s = store()
  if (s instanceof SupabaseStore) {
    const blob = await (await fetch(dataUrl)).blob()
    return s.uploadPhoto(gameId, blob)
  }
  return dataUrl
}

/** Turns a stored photo path back into something an img tag can load. */
export function photoUrl(path: string): string {
  if (path.startsWith('data:') || path.startsWith('http')) return path
  const s = store()
  return s instanceof SupabaseStore ? s.photoUrl(path) : path
}

export * from './types'
export { stats } from './stats'
