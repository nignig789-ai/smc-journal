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

  useEffect(() => {
    checkAdmin()
    loadMembers()
  }, [])

  async function checkAdmin() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace('/auth'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    if (profile?.role !== 'admin') router.replace('/dashboard')
  }

  async function loadMembers() {
    setLoading(true)
    // Get all profiles
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    // Get trade counts per user
    const { data: tradeCounts } = await supabase.from('trades').select('user_id, pnl')
    const countMap: Record<string, { count: number; pnl: number }> = {}
    tradeCounts?.forEach(t => {
      if (!countMap[t.user_id]) countMap[t.user_id] = { count: 0, pnl: 0 }
      countMap[t.user_id].count++
      countMap[t.user_id].pnl += t.pnl || 0
    })
    const rows = (profiles || []).map(p => ({
      ...p,
      trade_count: countMap[p.id]?.count || 0,
      total_pnl: countMap[p.id]?.pnl || 0,
    }))
    setMembers(rows)
    setLoading(false)
  }

  async function approve(member: MemberRow) {
    setExpireModal(member)
  }

  async function doApprove() {
    if (!expireModal) return
    const days = parseInt(expireDays)
    const expires = isNaN(days) || days === 0 ? null : new Date(Date.now() + days * 86400000).toISOString()
    await supabase.from('profiles').update({
      role: 'member',
      approved_at: new Date().toISOString(),
      expires_at: expires
    }).eq('id', expireModal.id)
    setExpireModal(null)
    loadMembers()
  }

  async function revoke(id: string) {
    if (!confirm('ยืนยันการยกเลิกการเข้าถึง?')) return
    await supabase.from('profiles').update({ role: 'pending', expires_at: null }).eq('id', id)
    loadMembers()
  }

  async function extendAccess(member: MemberRow) {
    setExpireModal(member)
    setExpireDays('30')
  }

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/auth')
  }

  const filtered = members.filter(m => {
    const matchFilter = filter === 'all' || m.role === filter
    const matchSearch = !search || m.email.includes(search) || m.display_name.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const pendingCount = members.filter(m => m.role === 'pending').length

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      {/* NAV */}
      <nav style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'0 20px', display:'flex', alignItems:'center', gap:12, height:50 }}>
        <div style={{ fontWeight:900, fontSize:16, color:'#f59e0b' }}>SMC<span style={{color:'#f97316'}}>Journal</span></div>
        <span style={{ color:'var(--muted)', fontSize:12 }}>|</span>
        <span style={{ color:'#a855f7', fontWeight:700, fontSize:13 }}>👑 Admin Panel</span>
        {pendingCount > 0 && (
          <span style={{ background:'#ef4444', color:'#fff', borderRadius:99, padding:'1px 8px', fontSize:11, fontWeight:800 }}>
            {pendingCount} รอ
          </span>
        )}
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>router.push('/dashboard')}>📊 Dashboard</button>
          <button className="btn btn-danger btn-sm" onClick={logout}>ออกจากระบบ</button>
        </div>
      </nav>

      <div style={{ padding:20 }}>
        {/* STAT CARDS */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:20 }}>
          {[
            { label:'สมาชิกทั้งหมด', value: members.length, color:'var(--blue)' },
            { label:'รอการอนุมัติ', value: pendingCount, color:'#f59e0b' },
            { label:'กำลังใช้งาน', value: members.filter(m=>m.role==='member').length, color:'var(--green)' },
            { label:'หมดอายุ', value: members.filter(m=>m.expires_at && new Date(m.expires_at)<new Date()).length, color:'var(--red)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding:'14px 16px' }}>
              <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>{s.label}</div>
              <div style={{ fontSize:28, fontWeight:900, color:s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* FILTER BAR */}
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <input placeholder="🔍 ค้นหา..." value={search} onChange={e=>setSearch(e.target.value)} style={{ width:200 }} />
          {['all','pending','member','admin'].map(f => (
            <button key={f} onClick={()=>setFilter(f)}
              style={{ padding:'5px 14px', borderRadius:6, border:'1px solid var(--border)', background: filter===f?'var(--accent)':'none',
                color: filter===f?'#000':'var(--muted)', fontWeight:700, fontSize:12, cursor:'pointer' }}>
              {f==='all'?'ทั้งหมด':f==='pending'?'รออนุมัติ':f==='member'?'สมาชิก':'Admin'}
            </button>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={loadMembers} style={{ marginLeft:'auto' }}>🔄 Refresh</button>
        </div>

        {/* MEMBERS TABLE */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ชื่อ / Email</th>
                  <th>สถานะ</th>
                  <th>อนุมัติเมื่อ</th>
                  <th>หมดอายุ</th>
                  <th>เทรด</th>
                  <th>Net P&L</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:30, color:'var(--muted)' }}>⏳ กำลังโหลด...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:30, color:'var(--muted)' }}>ไม่มีข้อมูล</td></tr>
                ) : filtered.map(m => {
                  const expired = m.expires_at && new Date(m.expires_at) < new Date()
                  const daysLeft = m.expires_at ? Math.ceil((new Date(m.expires_at).getTime()-Date.now())/86400000) : null
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight:700 }}>{m.display_name}</div>
                        <div style={{ fontSize:11, color:'var(--muted)' }}>{m.email}</div>
                      </td>
                      <td>
                        <span className={`badge badge-${expired?'loss':m.role}`}>
                          {expired ? '⛔ หมดอายุ' : m.role==='pending'?'⏳ รออนุมัติ':m.role==='admin'?'👑 Admin':'✅ สมาชิก'}
                        </span>
                      </td>
                      <td style={{ color:'var(--sub)', fontSize:12 }}>
                        {m.approved_at ? new Date(m.approved_at).toLocaleDateString('th-TH') : '—'}
                      </td>
                      <td>
                        {m.expires_at ? (
                          <span style={{ color: expired?'var(--red)':daysLeft&&daysLeft<=7?'#f59e0b':'var(--green)', fontSize:12, fontWeight:700 }}>
                            {expired ? 'หมดแล้ว' : `${daysLeft} วัน`}
                            <div style={{ fontSize:10, color:'var(--muted)', fontWeight:400 }}>{new Date(m.expires_at).toLocaleDateString('th-TH')}</div>
                          </span>
                        ) : m.role==='member' ? <span style={{ color:'var(--green)', fontSize:12 }}>♾ ไม่หมดอายุ</span> : '—'}
                      </td>
                      <td style={{ color:'var(--sub)' }}>{m.trade_count}</td>
                      <td style={{ color: m.total_pnl>=0?'var(--green)':'var(--red)', fontWeight:700 }}>
                        {m.total_pnl>=0?'+':''}{m.total_pnl.toFixed(0)}
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:6 }}>
                          {m.role === 'pending' && (
                            <button className="btn btn-success btn-sm" onClick={()=>approve(m)}>✅ อนุมัติ</button>
                          )}
                          {(m.role === 'member' || expired) && (
                            <button className="btn btn-ghost btn-sm" onClick={()=>extendAccess(m)}>⏱ ต่ออายุ</button>
                          )}
                          {m.role === 'member' && !expired && (
                            <button className="btn btn-danger btn-sm" onClick={()=>revoke(m.id)}>🚫 ยกเลิก</button>
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

      {/* EXPIRE MODAL */}
      {expireModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}>
          <div className="card" style={{ width:380, padding:28 }}>
            <div style={{ fontWeight:800, fontSize:16, marginBottom:6 }}>⏱ กำหนดระยะเวลาการใช้งาน</div>
            <div style={{ color:'var(--muted)', fontSize:13, marginBottom:20 }}>
              สมาชิก: <strong style={{color:'var(--text)'}}>{expireModal.display_name}</strong>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>จำนวนวัน (0 = ไม่หมดอายุ)</label>
                <input type="number" value={expireDays} onChange={e=>setExpireDays(e.target.value)} placeholder="30" />
              </div>
              {parseInt(expireDays) > 0 && (
                <div style={{ background:'var(--surface)', borderRadius:8, padding:10, fontSize:12, color:'var(--sub)' }}>
                  📅 หมดอายุ: <strong style={{color:'var(--accent)'}}>
                    {new Date(Date.now()+parseInt(expireDays)*86400000).toLocaleDateString('th-TH', {year:'numeric',month:'long',day:'numeric'})}
                  </strong>
                </div>
              )}
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                {['7','14','30','90','365'].map(d => (
                  <button key={d} onClick={()=>setExpireDays(d)}
                    style={{ flex:1, padding:'5px 0', border:`1px solid ${expireDays===d?'var(--accent)':'var(--border)'}`,
                      borderRadius:6, background: expireDays===d?'rgba(245,158,11,.15)':'none',
                      color: expireDays===d?'var(--accent)':'var(--muted)', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                    {d}วัน
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:20 }}>
              <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setExpireModal(null)}>ยกเลิก</button>
              <button className="btn btn-primary" style={{flex:1}} onClick={doApprove}>✅ ยืนยันอนุมัติ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
