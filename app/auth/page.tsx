'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login'|'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok'|'err'>('ok')

  const showMsg = (m: string, t: 'ok'|'err' = 'ok') => { setMsg(m); setMsgType(t) }

  async function handleLogin() {
    setLoading(true); setMsg('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { showMsg(error.message, 'err'); setLoading(false); return }

    // Check profile status
    const { data: profile } = await supabase.from('profiles').select('*').eq('email', email).single()
    if (!profile) { showMsg('ไม่พบข้อมูลบัญชี', 'err'); setLoading(false); return }

    if (profile.role === 'pending') {
      await supabase.auth.signOut()
      showMsg('บัญชีของคุณรอการอนุมัติจาก Admin ครับ 🕐', 'err')
      setLoading(false); return
    }
    if (profile.expires_at && new Date(profile.expires_at) < new Date()) {
      await supabase.auth.signOut()
      showMsg('การใช้งานของคุณหมดอายุแล้ว กรุณาติดต่อ Admin', 'err')
      setLoading(false); return
    }
    if (profile.role === 'admin') router.replace('/admin')
    else router.replace('/dashboard')
  }

  async function handleRegister() {
    if (!displayName.trim()) { showMsg('กรุณาใส่ชื่อที่แสดง', 'err'); return }
    setLoading(true); setMsg('')
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName } }
    })
    if (error) { showMsg(error.message, 'err'); setLoading(false); return }
    showMsg('✅ สมัครสำเร็จ! รอ Admin อนุมัติก่อนเข้าใช้งานได้เลยครับ')
    setMode('login'); setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ width:400, maxWidth:'95vw' }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:32, fontWeight:900, color:'#f59e0b' }}>SMC<span style={{color:'#f97316'}}>Journal</span></div>
          <div style={{ color:'var(--muted)', fontSize:13, marginTop:4 }}>Smart Money Concept Trading Journal</div>
        </div>

        <div className="card" style={{ padding:28 }}>
          {/* Tabs */}
          <div style={{ display:'flex', marginBottom:24, background:'var(--surface)', borderRadius:8, padding:3 }}>
            {(['login','register'] as const).map(m => (
              <button key={m} onClick={()=>{setMode(m);setMsg('')}}
                style={{ flex:1, padding:'7px 0', border:'none', borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:13,
                  background: mode===m ? 'var(--accent)' : 'transparent',
                  color: mode===m ? '#000' : 'var(--muted)', transition:'.15s' }}>
                {m==='login' ? '🔑 เข้าสู่ระบบ' : '✍️ สมัครสมาชิก'}
              </button>
            ))}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {mode==='register' && (
              <div>
                <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', display:'block', marginBottom:4 }}>ชื่อที่แสดง (ตั้งได้เอง)</label>
                <input placeholder="เช่น Golf Trader, SMC Pro..." value={displayName} onChange={e=>setDisplayName(e.target.value)} />
              </div>
            )}
            <div>
              <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', display:'block', marginBottom:4 }}>Email</label>
              <input type="email" placeholder="trader@email.com" value={email} onChange={e=>setEmail(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&(mode==='login'?handleLogin():handleRegister())} />
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', display:'block', marginBottom:4 }}>Password</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&(mode==='login'?handleLogin():handleRegister())} />
            </div>

            {msg && (
              <div style={{ padding:'10px 14px', borderRadius:8, fontSize:13, fontWeight:600,
                background: msgType==='ok' ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
                color: msgType==='ok' ? '#22c55e' : '#ef4444',
                border: `1px solid ${msgType==='ok' ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}` }}>
                {msg}
              </div>
            )}

            <button className="btn btn-primary" style={{ width:'100%', padding:'11px', fontSize:14 }}
              onClick={mode==='login' ? handleLogin : handleRegister} disabled={loading}>
              {loading ? '⏳ กำลังดำเนินการ...' : mode==='login' ? '🚀 เข้าสู่ระบบ' : '✅ สมัครสมาชิก'}
            </button>
          </div>

          {mode==='register' && (
            <div style={{ marginTop:16, padding:12, background:'var(--surface)', borderRadius:8, fontSize:12, color:'var(--muted)', lineHeight:1.6 }}>
              ℹ️ หลังสมัครแล้ว <strong style={{color:'var(--sub)'}}>Admin จะตรวจสอบและอนุมัติ</strong> การใช้งาน จึงจะ Login ได้ครับ
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
