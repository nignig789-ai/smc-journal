'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Trade, type Portfolio, type Profile } from '@/lib/supabase'
import dynamic from 'next/dynamic'

const Charts = dynamic(() => import('@/components/Charts'), { ssr: false })
const CalendarView = dynamic(() => import('@/components/CalendarView'), { ssr: false })

type Tab = 'overview' | 'trades' | 'calendar' | 'ai'

export default function Dashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [activePfId, setActivePfId] = useState<string>('')
  const [trades, setTrades] = useState<Trade[]>([])
  const [tab, setTab] = useState<Tab>('overview')
  const [showTradeModal, setShowTradeModal] = useState(false)
  const [showPfModal, setShowPfModal] = useState(false)
  const [editTrade, setEditTrade] = useState<Trade | null>(null)
  const [loading, setLoading] = useState(true)

  // Trade form
  const emptyForm = { date: new Date().toISOString().slice(0,10), symbol:'', market:'Gold', direction:'BUY', entry:'', sl:'', tp:'', lot:'', pnl:'', result:'WIN', setup:'', session:'London', note:'' }
  const [form, setForm] = useState<any>(emptyForm)
  const [pfForm, setPfForm] = useState({ name:'', initial_balance:'100000' })
  const [saving, setSaving] = useState(false)
  const [filterDir, setFilterDir] = useState('')
  const [filterResult, setFilterResult] = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  useEffect(() => { init() }, [])
  useEffect(() => { if (activePfId) loadTrades() }, [activePfId])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace('/auth'); return }

    const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (!p || p.role === 'pending') { await supabase.auth.signOut(); router.replace('/auth'); return }
    if (p.expires_at && new Date(p.expires_at) < new Date()) { await supabase.auth.signOut(); router.replace('/auth'); return }
    setProfile(p)

    if (p.role === 'admin') {
      // Admin also has access to dashboard but show link to admin panel
    }

    const { data: pfs } = await supabase.from('portfolios').select('*').eq('user_id', session.user.id).order('created_at')
    if (pfs && pfs.length > 0) {
      setPortfolios(pfs)
      setActivePfId(pfs[0].id)
    } else {
      // Auto-create default portfolio
      const { data: newPf } = await supabase.from('portfolios').insert({ user_id: session.user.id, name: 'พอร์ตหลัก', initial_balance: 100000 }).select().single()
      if (newPf) { setPortfolios([newPf]); setActivePfId(newPf.id) }
    }
    setLoading(false)
  }

  async function loadTrades() {
    const { data } = await supabase.from('trades').select('*').eq('portfolio_id', activePfId).order('date', { ascending: false })
    setTrades(data || [])
  }

  async function logout() { await supabase.auth.signOut(); router.replace('/auth') }

  async function saveTrade() {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const entry = parseFloat(form.entry), sl = parseFloat(form.sl), tp = parseFloat(form.tp)
    let rr = 0
    if (entry && sl && tp) { const r = Math.abs(entry-sl); rr = r>0 ? Math.abs(tp-entry)/r : 0 }
    const payload = {
      portfolio_id: activePfId, user_id: session!.user.id,
      date: form.date, symbol: form.symbol.toUpperCase()||'XAUUSD', market: form.market,
      direction: form.direction, entry, sl, tp, lot: parseFloat(form.lot)||0,
      pnl: parseFloat(form.pnl)||0, result: form.result, setup: form.setup,
      session: form.session, rr: parseFloat(rr.toFixed(2)), note: form.note
    }
    if (editTrade) await supabase.from('trades').update(payload).eq('id', editTrade.id)
    else await supabase.from('trades').insert(payload)
    await loadTrades(); setShowTradeModal(false); setEditTrade(null); setForm(emptyForm); setSaving(false)
  }

  async function deleteTrade(id: string) {
    if (!confirm('ลบรายการนี้?')) return
    await supabase.from('trades').delete().eq('id', id)
    loadTrades()
  }

  async function savePortfolio() {
    const { data: { session } } = await supabase.auth.getSession()
    const { data } = await supabase.from('portfolios').insert({ user_id: session!.user.id, name: pfForm.name, initial_balance: parseFloat(pfForm.initial_balance)||100000 }).select().single()
    if (data) { setPortfolios(p=>[...p,data]); setActivePfId(data.id) }
    setShowPfModal(false); setPfForm({ name:'', initial_balance:'100000' })
  }

  // Stats
  const total = trades.length
  const wins  = trades.filter(t=>t.result==='WIN').length
  const losses= trades.filter(t=>t.result==='LOSS').length
  const netPnl= trades.reduce((a,t)=>a+(+t.pnl||0),0)
  const grossW= trades.filter(t=>t.result==='WIN').reduce((a,t)=>a+(+t.pnl||0),0)
  const grossL= Math.abs(trades.filter(t=>t.result==='LOSS').reduce((a,t)=>a+(+t.pnl||0),0))
  const pf    = grossL===0?0:grossW/grossL
  const wr    = total===0?0:wins/total*100
  const activePf = portfolios.find(p=>p.id===activePfId)
  const equity   = (activePf?.initial_balance||100000)+netPnl
  const rrs = trades.filter(t=>t.rr).map(t=>+t.rr)
  const avgRR = rrs.length ? rrs.reduce((a,b)=>a+b,0)/rrs.length : 0

  const filteredTrades = trades.filter(t =>
    (!filterDir || t.direction===filterDir) &&
    (!filterResult || t.result===filterResult) &&
    (!filterSearch || t.symbol.includes(filterSearch.toUpperCase()))
  )

  const fmt = (n:number) => { const a=Math.abs(n); return a>=1000?(n/1000).toFixed(1)+'k':n.toFixed(0) }

  function openAdd() { setForm(emptyForm); setEditTrade(null); setShowTradeModal(true) }
  function openEdit(t:Trade) { setForm({...t, entry:t.entry?.toString(), sl:t.sl?.toString(), tp:t.tp?.toString(), lot:t.lot?.toString(), pnl:t.pnl?.toString()}); setEditTrade(t); setShowTradeModal(true) }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:12 }}>
      <div style={{ fontSize:28, fontWeight:800, color:'#f59e0b' }}>SMC<span style={{color:'#f97316'}}>Journal</span></div>
      <div style={{ color:'var(--muted)', fontSize:13 }}>กำลังโหลดข้อมูล...</div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      {/* NAV */}
      <nav style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'0 16px', display:'flex', alignItems:'center', gap:6, height:50, position:'sticky', top:0, zIndex:100 }}>
        <div style={{ fontWeight:900, fontSize:16, color:'#f59e0b', marginRight:8, whiteSpace:'nowrap' }}>SMC<span style={{color:'#f97316'}}>Journal</span></div>

        {/* Portfolio Switcher */}
        <select value={activePfId} onChange={e=>setActivePfId(e.target.value)}
          style={{ width:'auto', padding:'4px 8px', fontSize:12, background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)' }}>
          {portfolios.map(p=><option key={p.id} value={p.id}>🗂 {p.name}</option>)}
        </select>
        <button onClick={()=>setShowPfModal(true)} style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'4px 8px', color:'var(--muted)', fontSize:11, cursor:'pointer' }}>+ พอร์ต</button>

        {/* Tabs */}
        <div style={{ display:'flex', gap:2, flex:1, overflowX:'auto', margin:'0 8px' }}>
          {[
            {k:'overview',l:'📊 ภาพรวม'},
            {k:'trades',l:'📋 เทรด'},
            {k:'calendar',l:'📅 ปฏิทิน'},
            {k:'ai',l:'🤖 AI Coach'},
          ].map(({k,l})=>(
            <button key={k} onClick={()=>setTab(k as Tab)}
              style={{ padding:'5px 12px', borderRadius:6, border:'none', cursor:'pointer', whiteSpace:'nowrap', fontSize:12, fontWeight: tab===k?700:400,
                background: tab===k?'var(--accent)':'none', color: tab===k?'#000':'var(--muted)', transition:'.15s' }}>
              {l}
            </button>
          ))}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:'auto' }}>
          <div style={{ fontSize:12, color:'var(--muted)', whiteSpace:'nowrap' }}>👤 {profile?.display_name}</div>
          {profile?.role==='admin' && <button className="btn btn-sm" onClick={()=>router.push('/admin')} style={{ background:'rgba(168,85,247,.15)', color:'#a855f7', border:'1px solid rgba(168,85,247,.3)', padding:'4px 10px', fontSize:11 }}>👑 Admin</button>}
          {profile?.expires_at && (
            <div style={{ fontSize:10, color: new Date(profile.expires_at)<new Date()?'var(--red)':'var(--muted)', whiteSpace:'nowrap' }}>
              หมด {new Date(profile.expires_at).toLocaleDateString('th-TH')}
            </div>
          )}
          <button className="btn btn-danger btn-sm" onClick={logout}>ออก</button>
        </div>
      </nav>

      <div style={{ padding:16 }}>

        {/* ══ OVERVIEW ══ */}
        {tab==='overview' && (
          <>
            {/* Stat Cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:16 }}>
              {[
                { label:'Net P&L', value:`${netPnl>=0?'+':''}$${fmt(netPnl)}`, sub:`Equity $${fmt(equity)}`, color:netPnl>=0?'var(--green)':'var(--red)' },
                { label:'Win Rate', value:`${wr.toFixed(0)}%`, sub:`W${wins} / L${losses} / ${total}เทรด`, color:'var(--accent)' },
                { label:'Profit Factor', value:pf.toFixed(2), sub:`GW $${fmt(grossW)} / GL $${fmt(grossL)}`, color:pf>=1?'var(--green)':'var(--red)' },
                { label:'Avg RR', value:`${avgRR.toFixed(2)}R`, sub:'ต่อเทรด', color:'#3b82f6' },
                { label:'Total Trades', value:total.toString(), sub:activePf?.name||'', color:'var(--sub)' },
              ].map(s=>(
                <div key={s.label} className="card" style={{ padding:'14px 16px' }}>
                  <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>{s.label}</div>
                  <div style={{ fontSize:22, fontWeight:900, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{s.sub}</div>
                </div>
              ))}
            </div>
            {trades.length > 0
              ? <Charts trades={trades} />
              : <div className="card" style={{ textAlign:'center', padding:60, color:'var(--muted)' }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
                  <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>ยังไม่มีรายการเทรด</div>
                  <div style={{ fontSize:13, marginBottom:20 }}>เริ่มบันทึกเทรดแรกของคุณได้เลย!</div>
                  <button className="btn btn-primary" onClick={openAdd}>+ บันทึกการเทรด</button>
                </div>
            }
          </>
        )}

        {/* ══ TRADES ══ */}
        {tab==='trades' && (
          <>
            <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
              <input placeholder="🔍 Symbol..." value={filterSearch} onChange={e=>setFilterSearch(e.target.value)} style={{ width:150 }} />
              <select value={filterDir} onChange={e=>setFilterDir(e.target.value)} style={{ width:'auto' }}>
                <option value=''>ทิศทาง</option><option>BUY</option><option>SELL</option>
              </select>
              <select value={filterResult} onChange={e=>setFilterResult(e.target.value)} style={{ width:'auto' }}>
                <option value=''>ผลลัพธ์</option><option>WIN</option><option>LOSS</option><option>BE</option>
              </select>
              <button className="btn btn-primary" onClick={openAdd} style={{ marginLeft:'auto' }}>+ บันทึกเทรด</button>
            </div>
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th><th>วันที่</th><th>Symbol</th><th>Dir</th>
                      <th>Entry</th><th>SL</th><th>TP</th><th>Lot</th>
                      <th>RR</th><th>P&L</th><th>Result</th><th>Setup</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.length===0 ? (
                      <tr><td colSpan={13} style={{ textAlign:'center', padding:30, color:'var(--muted)' }}>ไม่มีรายการ</td></tr>
                    ) : filteredTrades.map((t,i)=>{
                      const sign=+t.pnl>=0?'+':''; const col=+t.pnl>=0?'var(--green)':'var(--red)'
                      return (
                        <tr key={t.id}>
                          <td style={{ color:'var(--muted)' }}>{filteredTrades.length-i}</td>
                          <td style={{ color:'var(--sub)', fontSize:12 }}>{t.date}</td>
                          <td style={{ fontWeight:700 }}>{t.symbol}</td>
                          <td><span className={`badge badge-${t.direction.toLowerCase()}`}>{t.direction}</span></td>
                          <td>{(+t.entry||0).toFixed(4)}</td>
                          <td style={{ color:'var(--red)' }}>{(+t.sl||0).toFixed(4)}</td>
                          <td style={{ color:'var(--green)' }}>{(+t.tp||0).toFixed(4)}</td>
                          <td>{t.lot}</td>
                          <td>{t.rr||'—'}R</td>
                          <td style={{ color:col, fontWeight:800 }}>{sign}${fmt(+t.pnl||0)}</td>
                          <td><span className={`badge badge-${t.result?.toLowerCase()||'be'}`}>{t.result}</span></td>
                          <td><span style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:4, padding:'2px 6px', fontSize:11, color:'var(--muted)' }}>{t.setup||'—'}</span></td>
                          <td>
                            <div style={{ display:'flex', gap:4 }}>
                              <button className="icon-btn" onClick={()=>openEdit(t)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'var(--muted)', padding:'2px 5px' }}>✏️</button>
                              <button className="icon-btn" onClick={()=>deleteTrade(t.id)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'var(--muted)', padding:'2px 5px' }}>🗑</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ══ CALENDAR ══ */}
        {tab==='calendar' && <CalendarView trades={trades} />}

        {/* ══ AI COACH ══ */}
        {tab==='ai' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div className="card">
              <div style={{ fontSize:12, color:'var(--sub)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:16 }}>🤖 AI Coach — วิเคราะห์พฤติกรรม</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { show: wr>60, icon:'🎯', t:`Win Rate สูง ${wr.toFixed(0)}%`, d:'คุณมีความแม่นยำในการเข้าเทรดที่ดีมาก' },
                  { show: wr<40&&total>5, icon:'🔍', t:`Win Rate ต่ำ ${wr.toFixed(0)}%`, d:'ทบทวน Setup และเงื่อนไขการเข้าเทรด' },
                  { show: pf>1.5, icon:'💰', t:`Profit Factor ดีมาก ${pf.toFixed(2)}`, d:'ระบบของคุณมีความได้เปรียบทางสถิติ' },
                  { show: pf<1&&total>5, icon:'⚠️', t:`Profit Factor ต่ำกว่า 1`, d:'ขาดทุนมากกว่ากำไร ควรทบทวน RR Ratio' },
                  { show: avgRR>2, icon:'📈', t:`Avg RR ดีมาก ${avgRR.toFixed(2)}R`, d:'คุณมี Risk/Reward ที่ดีเยี่ยม' },
                  { show: total===0, icon:'📋', t:'เริ่มบันทึกเทรดแรก', d:'ยิ่งมีข้อมูลมาก AI ยิ่งวิเคราะห์ได้แม่นยำ' },
                ].filter(i=>i.show).map((i,idx)=>(
                  <div key={idx} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:12, display:'flex', gap:10 }}>
                    <span style={{ fontSize:20 }}>{i.icon}</span>
                    <div><div style={{ fontWeight:700, marginBottom:2 }}>{i.t}</div><div style={{ color:'var(--muted)', fontSize:12 }}>{i.d}</div></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div style={{ fontSize:12, color:'var(--sub)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:12 }}>📊 สรุปสถิติ</div>
              {[
                { l:'Capital', v:`$${fmt(activePf?.initial_balance||100000)}`, c:'var(--sub)' },
                { l:'Equity', v:`$${fmt(equity)}`, c:equity>=(activePf?.initial_balance||100000)?'var(--green)':'var(--red)' },
                { l:'Gross Win', v:`+$${fmt(grossW)}`, c:'var(--green)' },
                { l:'Gross Loss', v:`-$${fmt(grossL)}`, c:'var(--red)' },
                { l:'Best Trade', v:`+$${fmt(Math.max(...trades.map(t=>+t.pnl||0),0))}`, c:'var(--green)' },
                { l:'Worst Trade', v:`$${fmt(Math.min(...trades.map(t=>+t.pnl||0),0))}`, c:'var(--red)' },
              ].map(r=>(
                <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ color:'var(--muted)', fontSize:13 }}>{r.l}</span>
                  <span style={{ color:r.c, fontWeight:800, fontSize:13 }}>{r.v}</span>
                </div>
              ))}
            </div>
            <div className="card" style={{ gridColumn:'1/-1' }}>
              <div style={{ fontSize:12, color:'var(--sub)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:12 }}>💡 คำแนะนำ</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[
                  { t:'จัดการ Risk ต่อเทรด', d:'ไม่ควรเกิน 1-2% ต่อเทรด', c:'var(--blue)' },
                  { t:'บันทึกทุกเทรด', d:'ข้อมูลครบ = AI วิเคราะห์แม่นขึ้น', c:'var(--accent)' },
                  { t:'Review รายสัปดาห์', d:'ดู Pattern ของ Win/Loss', c:'#a855f7' },
                  { t:'ใช้ Pending Order', d:'ไม่ไล่ราคา รอให้ราคามาหา', c:'var(--green)' },
                ].map(tip=>(
                  <div key={tip.t} style={{ background:'var(--surface)', borderLeft:`3px solid ${tip.c}`, borderRadius:'0 8px 8px 0', padding:'10px 14px' }}>
                    <div style={{ fontWeight:700, marginBottom:2, fontSize:13 }}>{tip.t}</div>
                    <div style={{ color:'var(--muted)', fontSize:12 }}>{tip.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ TRADE MODAL ══ */}
      {showTradeModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 }}>
          <div className="card" style={{ width:660, maxWidth:'100%', maxHeight:'90vh', overflowY:'auto', padding:24 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontWeight:800, fontSize:16 }}>{editTrade?'✏️ แก้ไขเทรด':'📋 บันทึกการเทรด'}</div>
              <button onClick={()=>{setShowTradeModal(false);setEditTrade(null);setForm(emptyForm)}} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:20, cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12 }}>
              {[
                { l:'วันที่', k:'date', t:'date' },
                { l:'Symbol', k:'symbol', t:'text', ph:'XAUUSD' },
              ].map(f=>(
                <div key={f.k}>
                  <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{f.l}</label>
                  <input type={f.t||'text'} placeholder={(f as any).ph||''} value={form[f.k]||''} onChange={e=>setForm((p:any)=>({...p,[f.k]:e.target.value}))} />
                </div>
              ))}
              <div>
                <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>ตลาด</label>
                <select value={form.market} onChange={e=>setForm((p:any)=>({...p,market:e.target.value}))}>
                  <option>Forex</option><option>Gold</option><option>Indices</option><option>Crypto</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Direction</label>
                <select value={form.direction} onChange={e=>setForm((p:any)=>({...p,direction:e.target.value}))}>
                  <option>BUY</option><option>SELL</option>
                </select>
              </div>
              {[
                { l:'Entry Price', k:'entry' },
                { l:'Stop Loss', k:'sl' },
                { l:'Take Profit', k:'tp' },
                { l:'Lot Size', k:'lot' },
                { l:'P&L ($)', k:'pnl' },
              ].map(f=>(
                <div key={f.k}>
                  <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>{f.l}</label>
                  <input type="number" step="any" placeholder="0.00" value={form[f.k]||''} onChange={e=>setForm((p:any)=>({...p,[f.k]:e.target.value}))} />
                </div>
              ))}
              <div>
                <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Result</label>
                <select value={form.result} onChange={e=>setForm((p:any)=>({...p,result:e.target.value}))}>
                  <option>WIN</option><option>LOSS</option><option>BE</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Session</label>
                <select value={form.session} onChange={e=>setForm((p:any)=>({...p,session:e.target.value}))}>
                  <option>London</option><option>New York</option><option>Asia</option>
                </select>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Setup / Strategy</label>
                <input placeholder="SMC Order Block, S&R, BOS..." value={form.setup||''} onChange={e=>setForm((p:any)=>({...p,setup:e.target.value}))} />
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Note</label>
                <textarea rows={2} value={form.note||''} onChange={e=>setForm((p:any)=>({...p,note:e.target.value}))} style={{ resize:'vertical' }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
              <button className="btn btn-ghost" onClick={()=>{setShowTradeModal(false);setEditTrade(null);setForm(emptyForm)}}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={saveTrade} disabled={saving}>{saving?'⏳ กำลังบันทึก...':'💾 บันทึก'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ PORTFOLIO MODAL ══ */}
      {showPfModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}>
          <div className="card" style={{ width:380, padding:24 }}>
            <div style={{ fontWeight:800, fontSize:16, marginBottom:20 }}>🗂 สร้างพอร์ตโฟลิโอใหม่</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>ชื่อพอร์ต</label>
                <input placeholder="เช่น พอร์ตหลัก, Backtest 2026..." value={pfForm.name} onChange={e=>setPfForm(p=>({...p,name:e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize:11, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Capital เริ่มต้น ($)</label>
                <input type="number" value={pfForm.initial_balance} onChange={e=>setPfForm(p=>({...p,initial_balance:e.target.value}))} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
              <button className="btn btn-ghost" onClick={()=>setShowPfModal(false)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={savePortfolio} disabled={!pfForm.name}>✅ สร้าง</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
