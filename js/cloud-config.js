// Configuración pública de Supabase para GymLedger.
// GymLedger comparte el mismo proyecto de Supabase ya utilizado por GigPlan y WorkCycle,
// pero utiliza exclusivamente recursos gymledger_* y sus propias políticas RLS.
// Estos valores son públicos y están destinados al cliente web/PWA.
// NUNCA incorporar aquí service_role, secret keys ni credenciales administrativas.
export const DEFAULT_SUPABASE_URL = 'https://yerekyfrrkxioaniyasx.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_C4OM_-WcZvAhSi505VYUjA_TgAkNshM';
