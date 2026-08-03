import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type Profile = {
  id: string
  email: string
  display_name: string
  role: 'pending' | 'member' | 'admin'
  approved_at: string | null
  expires_at: string | null
  created_at: string
}

export type Portfolio = {
  id: string
  user_id: string
  name: string
  currency: string
  initial_balance: number
  created_at: string
}

export type Trade = {
  id: string
  portfolio_id: string
  user_id: string
  date: string
  symbol: string
  market: string
  direction: 'BUY' | 'SELL'
  entry: number
  sl: number
  tp: number
  lot: number
  pnl: number
  result: 'WIN' | 'LOSS' | 'BE'
  setup: string
  session: string
  rr: number
  note: string
  created_at: string
}
