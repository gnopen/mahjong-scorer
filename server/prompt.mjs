// The prompt lives in shared/ so the local server, the Vercel function and
// the Supabase Edge Function all ask the model the same thing.
export { SYSTEM_PROMPT, USER_PROMPT } from '../shared/recognizePrompt.js'
