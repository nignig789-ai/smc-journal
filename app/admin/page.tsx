'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Profile } from '@/lib/supabase'

type MemberRow = Profile & { trade_count: number; total_pnl: number }

export default function AdminPage() {
  const router = useRouter()
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [expireModal, setExpireModal] = useState<MemberRow|null>(null)
  const [expireDays, setExpireDays] = useState('30')
  const [search, setSearch] = useState('')

  useEffect(() => { checkAdmin(); loadMembers() }, [])

  async function checkAdmin() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace('/auth'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    if (profile?.role !== 'admin') router.replace('/dashboard')
  }

  async function loadMembers() {
    setLoading(true)
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    const { data: tradeCounts } = await supabase.from('trades').select('user_id, pnl')
    const countMap: Record<string, { count: number; pnl: number }> = {}
    tradeCounts?.forEach(t => {
      if (!countMap[t.user_id]) countMap[t.user_id] = { count: 0, pnl: 0 }
      countMap[t.user_id].count++; countMap[t.user_id].pnl += t.pnl || 0
    })
    setMembers((profiles || []).map(p => ({ ...p, trade_count: countMap[p.id]?.count || 0, total_pnl: countMap[p.id]?.pnl || 0 })))
    setLoading(false)
  }

  async function doApprove() {
    if (!expireModal) return
    const days = parseInt(expireDays)
    const expires = isNaN(days) || days === 0 ? null : new Date(Date.now() + days * 86400000).toISOString()
    await supabase.from('profiles').update({ role: 'member', approved_at: new Date().toISOString(), expires_at: expires }).eq('id', expireModal.id)
    setExpireModal(null); loadMembers()
  }

  async function revoke(id: string) {
    if (!confirm('ยืนยันการยกเลิกการเข้าถึง?')) return
    await supabase.from('profiles').update({ role: 'pending', expires_at: null }).eq('id', id); loadMembers()
  }

  async function logout() { await supabase.auth.signOut(); router.replace('/auth') }

  const filtered = members.filter(m => {
    const matchFilter = filter === 'all' || m.role === filter
    const matchSearch = !search || m.email.includes(search) || m.display_name.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const pendingCount = members.filter(m => m.role === 'pending').length

  return (
    <div style={{ minHeight:'100vh', background:'var(--void)' }}>
      <nav style={{ background:'rgba(14,17,23,0.95)', backdropFilter:'blur(20px)', borderBottom:'1px solid var(--rim)', padding:'0 20px', display:'flex', alignItems:'center', gap:10, height:54, position:'sticky', top:0, zIndex:100 }}>
        <div style={{ fontWeight:900, fontSize:18, letterSpacing:'-0.5px', marginRight:8 }}>
          <span style={{ color:'var(--plasma)' }}>SMC</span><span style={{ color:'var(--text)' }}>Journal</span>
        </div>
        <span style={{ color:'var(--purple)', fontWeight:700, fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
          <span>👑</span> Admin Panel
        </span>
        {pendingCount > 0 && (
          <span style={{ background:'var(--fire)', color:'#fff', borderRadius:99, padding:'2px 8px', fontSize:11, fontWeight:800, animation:'pulse 2s infinite' }}>
            {pendingCount} รอ
          </span>
        )}
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>router.push('/dashboard')}>📊 Dashboard</button>
          <button className="btn btn-danger btn-sm" onClick={logout}>ออกจากระบบ</button>
        </div>
      </nav>

      <div style={{ padding:20 }}>
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:20 }}>
          {[
            { l:'สมาชิกทั้งหมด', v:members.length, c:'var(--plasma)' },
            { l:'รอการอนุมัติ', v:pendingCount, c:'var(--amber)' },
            { l:'กำลังใช้งาน', v:members.filter(m=>m.role==='member').length, c:'var(--neon)' },
            { l:'หมดอายุ', v:members.filter(m=>m.expires_at&&new Date(m.expires_at)<new Date()).length, c:'var(--fire)' },
          ].map(s=>(
            <div key={s.l} className="stat-pill">
              <div style={{ fontSize:9, color:'var(--muted)', fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:8 }}>{s.l}</div>
              <div className="mono" style={{ fontSize:28, fontWeight:800, color:s.c }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <input placeholder="🔍 ค้นหา..." value={search} onChange={e=>setSearch(e.target.value)} style={{ width:200 }} />
          {['all','pending','member','admin'].map(f => (
            <button key={f} onClick={()=>setFilter(f)}
              style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--rim)', background:filter===f?'linear-gradient(135deg,var(--plasma),var(--plasma2))':'none', color:filter===f?'#000':'var(--muted)', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'Space Grotesk, sans-serif', transition:'.15s' }}>
              {f==='all'?'ทั้งหมด':f==='pending'?'รออนุมัติ':f==='member'?'สมาชิก':'Admin'}
            </button>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={loadMembers} style={{ marginLeft:'auto' }}>🔄 Refresh</button>
        </div>

        {/* Table */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ชื่อ / Email</th><th>สถานะ</th><th>อนุมัติเมื่อ</th>
                  <th>หมดอายุ</th><th>เทรด</th><th>Net P&L</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--muted)' }}>⏳ กำลังโหลด...</td></tr>
                ) : filtered.map(m => {
                  const expired = m.expires_at && new Date(m.expires_at) < new Date()
                  const daysLeft = m.expires_at ? Math.ceil((new Date(m.expires_at).getTime()-Date.now())/86400000) : null
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight:700, color:'var(--text)' }}>{m.display_name}</div>
                        <div style={{ fontSize:11, color:'var(--muted)', fontFamily:'JetBrains Mono' }}>{m.email}</div>
                      </td>
                      <td>
                        <span className={`badge badge-${expired?'loss':m.role}`}>
                          {expired?'⛔ หมดอายุ':m.role==='pending'?'⏳ รออนุมัติ':m.role==='admin'?'👑 Admin':'✅ สมาชิก'}
                        </span>
                      </td>
                      <td style={{ color:'var(--sub)', fontSize:12 }}>{m.approved_at ? new Date(m.approved_at).toLocaleDateString('th-TH') : '—'}</td>
                      <td>
                        {m.expires_at ? (
                          <span style={{ color:expired?'var(--fire)':daysLeft&&daysLeft<=7?'var(--amber)':'var(--neon)', fontSize:12, fontWeight:700, fontFamily:'JetBrains Mono' }}>
                            {expired?'หมดแล้ว':`${daysLeft}d`}
                            <div style={{ fontSize:10, color:'var(--muted)', fontWeight:400 }}>{new Date(m.expires_at).toLocaleDateString('th-TH')}</div>
                          </span>
                        ) : m.role==='member'?<span style={{color:'var(--neon)',fontSize:12}}>♾ ไม่หมดอายุ</span>:'—'}
                      </td>
                      <td className="mono" style={{ color:'var(--sub)' }}>{m.trade_count}</td>
                      <td className="mono" style={{ color:m.total_pnl>=0?'var(--neon)':'var(--fire)', fontWeight:700 }}>
                        {m.total_pnl>=0?'+':''}{m.total_pnl.toFixed(0)}
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:6 }}>
                          {(m.role==='pending'||m.role==='member'||expired) && (
                            <button className="btn btn-success btn-sm" onClick={()=>{setExpireModal(m);setExpireDays('30')}}>
                              {m.role==='pending'?'✅ อนุมัติ':'⏱ ต่ออายุ'}
                            </button>
                          )}
                          {m.role==='member'&&!expired && (
                            <button className="btn btn-danger btn-sm" onClick={()=>revoke(m.id)}>🚫</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Expire Modal */}
      {expireModal && (
        <div className="modal-overlay open">
          <div className="modal" style={{ width:400 }}>
            <div style={{ fontWeight:800, fontSize:17, marginBottom:6 }}>⏱ กำหนดระยะเวลาใช้งาน</div>
            <div style={{ color:'var(--muted)', fontSize:13, marginBottom:24 }}>สมาชิก: <strong style={{color:'var(--plasma)'}}>{expireModal.display_name}</strong></div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={{ fontSize:10, color:'var(--plasma)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:6 }}>จำนวนวัน (0 = ไม่หมดอายุ)</label>
                <input type="number" value={expireDays} onChange={e=>setExpireDays(e.target.value)} />
              </div>
              {parseInt(expireDays)>0 && (
                <div style={{ background:'rgba(0,212,255,0.06)', border:'1px solid rgba(0,212,255,0.15)', borderRadius:10, padding:12, fontSize:12, color:'var(--sub)' }}>
                  📅 หมดอายุ: <strong style={{color:'var(--plasma)'}}>
                    {new Date(Date.now()+parseInt(expireDays)*86400000).toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'})}
                  </strong>
                </div>
              )}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {['7','14','30','90','365','0'].map(d=>(
                  <button key={d} onClick={()=>setExpireDays(d)}
                    style={{ flex:1, minWidth:50, padding:'7px 0', border:`1px solid ${expireDays===d?'var(--plasma)':'var(--rim)'}`, borderRadius:8, background:expireDays===d?'rgba(0,212,255,.1)':'none', color:expireDays===d?'var(--plasma)':'var(--muted)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Space Grotesk, sans-serif' }}>
                    {d==='0'?'∞':d+'d'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:24 }}>
              <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setExpireModal(null)}>ยกเลิก</button>
              <button className="btn btn-plasma" style={{flex:1}} onClick={doApprove}>✅ ยืนยัน</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
