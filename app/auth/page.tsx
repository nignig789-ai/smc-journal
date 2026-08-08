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
    const { data: profile } = await supabase.from('profiles').select('*').eq('email', email).single()
    if (!profile) { showMsg('ไม่พบข้อมูลบัญชี', 'err'); setLoading(false); return }
    if (profile.role === 'pending') { await supabase.auth.signOut(); showMsg('บัญชีของคุณรอการอนุมัติจาก Admin 🕐', 'err'); setLoading(false); return }
    if (profile.expires_at && new Date(profile.expires_at) < new Date()) { await supabase.auth.signOut(); showMsg('การใช้งานของคุณหมดอายุแล้ว กรุณาติดต่อ Admin', 'err'); setLoading(false); return }
    if (profile.role === 'admin') router.replace('/admin')
    else router.replace('/dashboard')
  }

  async function handleRegister() {
    if (!displayName.trim()) { showMsg('กรุณาใส่ชื่อที่แสดง', 'err'); return }
    setLoading(true); setMsg('')
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } })
    if (error) { showMsg(error.message, 'err'); setLoading(false); return }
    showMsg('✅ สมัครสำเร็จ! รอ Admin อนุมัติก่อนเข้าใช้งานได้เลยครับ')
    setMode('login'); setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--void)', position:'relative', overflow:'hidden' }}>
      {/* BG Grid */}
      <div className="grid-bg" style={{ position:'absolute', inset:0, opacity:.4 }} />
      {/* Glow orbs */}
      <div style={{ position:'absolute', top:'20%', left:'15%', width:400, height:400, background:'radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'20%', right:'15%', width:300, height:300, background:'radial-gradient(circle, rgba(57,255,143,0.06) 0%, transparent 70%)', pointerEvents:'none' }} />

      <div style={{ width:420, maxWidth:'95vw', position:'relative', zIndex:1 }}>
        {/* LOGO */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <div style={{ width:42, height:42, background:'linear-gradient(135deg, var(--plasma), var(--purple))', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, boxShadow:'0 0 30px rgba(0,212,255,0.3)' }}>📊</div>
            <div style={{ fontSize:28, fontWeight:800, letterSpacing:'-1px' }}>
              <span style={{ color:'var(--plasma)' }}>SMC</span>
              <span style={{ color:'var(--text)' }}>Journal</span>
            </div>
          </div>
          <div style={{ color:'var(--muted)', fontSize:13, letterSpacing:'.5px' }}>SMART MONEY CONCEPT · TRADING JOURNAL</div>
        </div>

        <div className="card-glass" style={{ padding:32, border:'1px solid rgba(0,212,255,0.1)' }}>
          {/* Tabs */}
          <div style={{ display:'flex', background:'var(--surface)', borderRadius:10, padding:4, marginBottom:28, gap:4 }}>
            {(['login','register'] as const).map(m => (
              <button key={m} onClick={()=>{setMode(m);setMsg('')}}
                style={{ flex:1, padding:'8px 0', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:13,
                  background: mode===m ? 'linear-gradient(135deg, var(--plasma), var(--plasma2))' : 'transparent',
                  color: mode===m ? '#000' : 'var(--muted)', transition:'all .2s', fontFamily:'Space Grotesk, sans-serif' }}>
                {m==='login' ? '🔑 เข้าสู่ระบบ' : '✨ สมัครสมาชิก'}
              </button>
            ))}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {mode==='register' && (
              <div>
                <label style={{ fontSize:10, color:'var(--plasma)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:6 }}>ชื่อที่แสดง</label>
                <input placeholder="เช่น Golf Trader, SMC Pro..." value={displayName} onChange={e=>setDisplayName(e.target.value)} />
              </div>
            )}
            <div>
              <label style={{ fontSize:10, color:'var(--plasma)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:6 }}>Email</label>
              <input type="email" placeholder="trader@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(mode==='login'?handleLogin():handleRegister())} />
            </div>
            <div>
              <label style={{ fontSize:10, color:'var(--plasma)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:6 }}>Password</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(mode==='login'?handleLogin():handleRegister())} />
            </div>

            {msg && (
              <div style={{ padding:'12px 16px', borderRadius:8, fontSize:13, fontWeight:500,
                background: msgType==='ok' ? 'rgba(57,255,143,.08)' : 'rgba(255,77,109,.08)',
                color: msgType==='ok' ? 'var(--neon)' : 'var(--fire)',
                border: `1px solid ${msgType==='ok' ? 'rgba(57,255,143,.2)' : 'rgba(255,77,109,.2)'}` }}>
                {msg}
              </div>
            )}

            <button className="btn btn-plasma" style={{ width:'100%', padding:'12px', fontSize:14, justifyContent:'center', marginTop:4 }}
              onClick={mode==='login' ? handleLogin : handleRegister} disabled={loading}>
              {loading ? '⏳ กำลังดำเนินการ...' : mode==='login' ? '🚀 เข้าสู่ระบบ' : '✅ สมัครสมาชิก'}
            </button>
          </div>

          {mode==='register' && (
            <div style={{ marginTop:20, padding:14, background:'rgba(0,212,255,0.04)', borderRadius:10, border:'1px solid rgba(0,212,255,0.1)', fontSize:12, color:'var(--sub)', lineHeight:1.7 }}>
              ℹ️ หลังสมัครแล้ว <strong style={{color:'var(--plasma)'}}>Admin จะตรวจสอบและอนุมัติ</strong> จึงจะ Login ได้ครับ
            </div>
          )}
        </div>

        <div style={{ textAlign:'center', marginTop:20, fontSize:11, color:'var(--muted)' }}>
          Powered by SMC Journal · Secured by Supabase
        </div>
      </div>
    </div>
  )
}
