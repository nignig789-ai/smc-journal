'use client'
import { useEffect, useState } from 'react'
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
  const [navOpen, setNavOpen] = useState(false)

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
    const { data: pfs } = await supabase.from('portfolios').select('*').eq('user_id', session.user.id).order('created_at')
    if (pfs && pfs.length > 0) { setPortfolios(pfs); setActivePfId(pfs[0].id) }
    else {
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
    const payload = { portfolio_id: activePfId, user_id: session!.user.id, date: form.date, symbol: form.symbol.toUpperCase()||'XAUUSD', market: form.market, direction: form.direction, entry, sl, tp, lot: parseFloat(form.lot)||0, pnl: parseFloat(form.pnl)||0, result: form.result, setup: form.setup, session: form.session, rr: parseFloat(rr.toFixed(2)), note: form.note }
    if (editTrade) await supabase.from('trades').update(payload).eq('id', editTrade.id)
    else await supabase.from('trades').insert(payload)
    await loadTrades(); setShowTradeModal(false); setEditTrade(null); setForm(emptyForm); setSaving(false)
  }

  async function deleteTrade(id: string) {
    if (!confirm('ลบรายการนี้?')) return
    await supabase.from('trades').delete().eq('id', id); loadTrades()
  }

  async function savePortfolio() {
    const { data: { session } } = await supabase.auth.getSession()
    const { data } = await supabase.from('portfolios').insert({ user_id: session!.user.id, name: pfForm.name, initial_balance: parseFloat(pfForm.initial_balance)||100000 }).select().single()
    if (data) { setPortfolios(p=>[...p,data]); setActivePfId(data.id) }
    setShowPfModal(false); setPfForm({ name:'', initial_balance:'100000' })
  }

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

  const fmt = (n:number) => { const a=Math.abs(n); if(a>=1000) return (n/1000).toFixed(1)+'k'; return n.toFixed(0) }
  const fmtSign = (n:number) => `${n>=0?'+':''}$${fmt(n)}`

  function openAdd() { setForm(emptyForm); setEditTrade(null); setShowTradeModal(true) }
  function openEdit(t:Trade) { setForm({...t, entry:t.entry?.toString(), sl:t.sl?.toString(), tp:t.tp?.toString(), lot:t.lot?.toString(), pnl:t.pnl?.toString()}); setEditTrade(t); setShowTradeModal(true) }

  const tabs = [
    {k:'overview', icon:'⚡', l:'ภาพรวม'},
    {k:'trades',   icon:'📋', l:'เทรด'},
    {k:'calendar', icon:'📅', l:'ปฏิทิน'},
    {k:'ai',       icon:'🤖', l:'AI Coach'},
  ]

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--void)', flexDirection:'column', gap:16 }}>
      <div style={{ width:48, height:48, border:'3px solid var(--rim)', borderTop:'3px solid var(--plasma)', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
      <div style={{ color:'var(--muted)', fontSize:13 }}>กำลังโหลด...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--void)', display:'flex', flexDirection:'column' }}>
      {/* TOP NAV */}
      <nav style={{ background:'rgba(14,17,23,0.95)', backdropFilter:'blur(20px)', borderBottom:'1px solid var(--rim)', padding:'0 20px', display:'flex', alignItems:'center', gap:8, height:54, position:'sticky', top:0, zIndex:100 }}>
        <div style={{ fontWeight:900, fontSize:18, letterSpacing:'-0.5px', marginRight:8, whiteSpace:'nowrap' }}>
          <span style={{ color:'var(--plasma)' }}>SMC</span>
          <span style={{ color:'var(--text)' }}>Journal</span>
        </div>

        {/* Portfolio Switcher */}
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          <select value={activePfId} onChange={e=>setActivePfId(e.target.value)}
            style={{ width:'auto', padding:'5px 10px', fontSize:12, background:'var(--surface)', border:'1px solid var(--rim)', borderRadius:8, color:'var(--text)' }}>
            {portfolios.map(p=><option key={p.id} value={p.id}>💼 {p.name}</option>)}
          </select>
          <button onClick={()=>setShowPfModal(true)} style={{ background:'none', border:'1px solid var(--rim)', borderRadius:8, padding:'5px 8px', color:'var(--muted)', fontSize:11, cursor:'pointer', whiteSpace:'nowrap' }}>+</button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:2, flex:1, overflowX:'auto', margin:'0 8px' }}>
          {tabs.map(({k,icon,l})=>(
            <button key={k} onClick={()=>setTab(k as Tab)}
              className={tab===k ? 'nav-active' : ''}
              style={{ padding:'5px 14px', borderRadius:8, border:`1px solid ${tab===k?'rgba(0,212,255,.2)':'transparent'}`, cursor:'pointer', whiteSpace:'nowrap', fontSize:12, fontWeight:600, background:'none', color:'var(--muted)', transition:'all .15s', fontFamily:'Space Grotesk, sans-serif', display:'flex', alignItems:'center', gap:5 }}>
              <span>{icon}</span><span style={{ display:'none' }}>{l}</span>
              <span style={{ display:'block' }}>{l}</span>
            </button>
          ))}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:'auto' }}>
          {profile?.expires_at && (
            <div style={{ fontSize:10, color: new Date(profile.expires_at)<new Date()?'var(--fire)':'var(--muted)', whiteSpace:'nowrap', background:'var(--surface)', padding:'3px 8px', borderRadius:6, border:'1px solid var(--rim)' }}>
              ⏱ {new Date(profile.expires_at).toLocaleDateString('th-TH')}
            </div>
          )}
          <div style={{ fontSize:12, color:'var(--sub)', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:8, height:8, background:'var(--neon)', borderRadius:'50%', boxShadow:'0 0 8px var(--neon)' }} />
            {profile?.display_name}
          </div>
          {profile?.role==='admin' && (
            <button onClick={()=>router.push('/admin')} style={{ background:'rgba(180,127,255,.1)', color:'var(--purple)', border:'1px solid rgba(180,127,255,.2)', borderRadius:8, padding:'4px 10px', fontSize:11, cursor:'pointer', fontWeight:700 }}>👑 Admin</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={logout}>ออก</button>
        </div>
      </nav>

      <div style={{ padding:20, flex:1 }}>

        {/* ══ OVERVIEW ══ */}
        {tab==='overview' && (
          <>
            {/* STAT CARDS */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:12, marginBottom:20 }}>
              {[
                { label:'NET P&L', value:fmtSign(netPnl), sub:`Equity $${fmt(equity)}`, color:netPnl>=0?'var(--neon)':'var(--fire)', glow:netPnl>=0?'glow-neon':'glow-fire', icon:'💰' },
                { label:'WIN RATE', value:`${wr.toFixed(1)}%`, sub:`W${wins} / L${losses} / ${total}`, color:'var(--plasma)', glow:'glow-plasma', icon:'🎯' },
                { label:'PROFIT FACTOR', value:pf.toFixed(2), sub:`GW $${fmt(grossW)}`, color:pf>=1?'var(--neon)':'var(--fire)', glow:pf>=1?'glow-neon':'glow-fire', icon:'⚡' },
                { label:'AVG RR', value:`${avgRR.toFixed(2)}R`, sub:'ต่อเทรด', color:'var(--amber)', glow:'', icon:'📊' },
                { label:'TOTAL TRADES', value:total.toString(), sub:activePf?.name||'', color:'var(--purple)', glow:'', icon:'📋' },
              ].map(s=>(
                <div key={s.label} className={`stat-pill ${s.glow}`}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                    <div style={{ fontSize:9, color:'var(--muted)', fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase' }}>{s.label}</div>
                    <span style={{ fontSize:18 }}>{s.icon}</span>
                  </div>
                  <div className="mono" style={{ fontSize:26, fontWeight:700, color:s.color, letterSpacing:'-0.5px' }}>{s.value}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {trades.length > 0
              ? <Charts trades={trades} />
              : (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:80, textAlign:'center' }}>
                  <div style={{ fontSize:60, marginBottom:16 }}>📊</div>
                  <div style={{ fontSize:22, fontWeight:800, marginBottom:8, color:'var(--text)' }}>เริ่มบันทึกเทรดแรกของคุณ</div>
                  <div style={{ fontSize:14, color:'var(--muted)', marginBottom:24, maxWidth:340, lineHeight:1.7 }}>ยิ่งบันทึกครบ ยิ่งวิเคราะห์ได้แม่นขึ้น AI จะช่วยหาจุดแข็งและจุดอ่อนให้คุณ</div>
                  <button className="btn btn-plasma" onClick={openAdd} style={{ padding:'12px 28px', fontSize:14 }}>+ บันทึกการเทรด</button>
                </div>
              )}
          </>
        )}

        {/* ══ TRADES ══ */}
        {tab==='trades' && (
          <>
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
              <input placeholder="🔍 ค้นหา Symbol..." value={filterSearch} onChange={e=>setFilterSearch(e.target.value)} style={{ width:180 }} />
              <select value={filterDir} onChange={e=>setFilterDir(e.target.value)} style={{ width:'auto' }}>
                <option value=''>ทิศทาง</option><option>BUY</option><option>SELL</option>
              </select>
              <select value={filterResult} onChange={e=>setFilterResult(e.target.value)} style={{ width:'auto' }}>
                <option value=''>ผลลัพธ์</option><option>WIN</option><option>LOSS</option><option>BE</option>
              </select>
              <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
                <div style={{ fontSize:12, color:'var(--muted)' }}>{filteredTrades.length} รายการ</div>
                <button className="btn btn-plasma" onClick={openAdd}>+ บันทึกเทรด</button>
              </div>
            </div>

            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th><th>วันที่</th><th>Symbol</th><th>Dir</th>
                      <th>Entry</th><th>SL</th><th>TP</th><th>Lot</th>
                      <th>RR</th><th>P&L</th><th>Result</th><th>Setup</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.length===0 ? (
                      <tr><td colSpan={13} style={{ textAlign:'center', padding:40, color:'var(--muted)' }}>ไม่มีรายการ</td></tr>
                    ) : filteredTrades.map((t,i)=>{
                      const col=+t.pnl>=0?'var(--neon)':'var(--fire)'
                      return (
                        <tr key={t.id}>
                          <td className="mono" style={{ color:'var(--muted)', fontSize:11 }}>{filteredTrades.length-i}</td>
                          <td className="mono" style={{ color:'var(--sub)', fontSize:11 }}>{t.date}</td>
                          <td style={{ fontWeight:700, color:'var(--plasma)' }}>{t.symbol}</td>
                          <td><span className={`badge badge-${t.direction.toLowerCase()}`}>{t.direction}</span></td>
                          <td className="mono" style={{ fontSize:12 }}>{(+t.entry||0).toFixed(4)}</td>
                          <td className="mono" style={{ color:'var(--fire)', fontSize:12 }}>{(+t.sl||0).toFixed(4)}</td>
                          <td className="mono" style={{ color:'var(--neon)', fontSize:12 }}>{(+t.tp||0).toFixed(4)}</td>
                          <td className="mono" style={{ fontSize:12 }}>{t.lot}</td>
                          <td className="mono" style={{ color:'var(--amber)', fontSize:12 }}>{t.rr||'—'}R</td>
                          <td className="mono" style={{ color:col, fontWeight:700, fontSize:13 }}>{+t.pnl>=0?'+':''}{(+t.pnl||0).toFixed(0)}</td>
                          <td><span className={`badge badge-${t.result?.toLowerCase()||'be'}`}>{t.result}</span></td>
                          <td><span style={{ background:'var(--surface)', border:'1px solid var(--rim)', borderRadius:6, padding:'2px 8px', fontSize:10, color:'var(--sub)' }}>{t.setup||'—'}</span></td>
                          <td>
                            <div style={{ display:'flex', gap:4 }}>
                              <button onClick={()=>openEdit(t)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:13, padding:'3px 6px', borderRadius:6, transition:'.15s' }}>✏️</button>
                              <button onClick={()=>deleteTrade(t.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:13, padding:'3px 6px', borderRadius:6, transition:'.15s' }}>🗑</button>
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
              <div style={{ fontSize:10, color:'var(--plasma)', fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:16 }}>🤖 AI Coach — วิเคราะห์พฤติกรรม</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { show:wr>60, icon:'🎯', col:'var(--neon)', t:`Win Rate สูง ${wr.toFixed(1)}%`, d:'คุณมีความแม่นยำในการเข้าเทรดที่ดีมาก ระบบ Setup ของคุณทำงานได้ดี' },
                  { show:wr<40&&total>5, icon:'🔍', col:'var(--fire)', t:`Win Rate ต่ำ ${wr.toFixed(1)}%`, d:'ทบทวน Setup และเงื่อนไขการเข้าเทรด อาจต้องรอ Confirmation มากขึ้น' },
                  { show:pf>1.5, icon:'💰', col:'var(--neon)', t:`Profit Factor ดีมาก ${pf.toFixed(2)}`, d:'ระบบของคุณมีความได้เปรียบทางสถิติสูง ทำต่อไปอย่างสม่ำเสมอ' },
                  { show:pf<1&&total>5, icon:'⚠️', col:'var(--amber)', t:'Profit Factor ต่ำกว่า 1', d:'ขาดทุนมากกว่ากำไร ควรทบทวน RR Ratio และ Position Sizing' },
                  { show:avgRR>2, icon:'📈', col:'var(--plasma)', t:`Avg RR ดีมาก ${avgRR.toFixed(2)}R`, d:'คุณมี Risk/Reward ที่ยอดเยี่ยม ทำให้ระบบมีความยั่งยืนระยะยาว' },
                  { show:total===0, icon:'📋', col:'var(--sub)', t:'เริ่มบันทึกเทรดแรก', d:'ยิ่งมีข้อมูลมาก AI ยิ่งวิเคราะห์ได้แม่นยำและเป็นประโยชน์มากขึ้น' },
                ].filter(i=>i.show).map((i,idx)=>(
                  <div key={idx} style={{ background:'var(--surface)', border:`1px solid ${i.col}22`, borderRadius:10, padding:14, display:'flex', gap:12, alignItems:'flex-start' }}>
                    <div style={{ width:36, height:36, background:`${i.col}15`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{i.icon}</div>
                    <div>
                      <div style={{ fontWeight:700, marginBottom:3, color:i.col }}>{i.t}</div>
                      <div style={{ color:'var(--muted)', fontSize:12, lineHeight:1.6 }}>{i.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div className="card">
                <div style={{ fontSize:10, color:'var(--plasma)', fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:14 }}>📊 สถิติโดยรวม</div>
                {[
                  { l:'Capital', v:`$${fmt(activePf?.initial_balance||100000)}`, c:'var(--sub)' },
                  { l:'Equity', v:`$${fmt(equity)}`, c:equity>=(activePf?.initial_balance||100000)?'var(--neon)':'var(--fire)' },
                  { l:'Gross Win', v:`+$${fmt(grossW)}`, c:'var(--neon)' },
                  { l:'Gross Loss', v:`-$${fmt(grossL)}`, c:'var(--fire)' },
                  { l:'Best Trade', v:`+$${fmt(Math.max(...trades.map(t=>+t.pnl||0),0))}`, c:'var(--neon)' },
                  { l:'Worst Trade', v:`$${fmt(Math.min(...trades.map(t=>+t.pnl||0),0))}`, c:'var(--fire)' },
                ].map(r=>(
                  <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid var(--rim)' }}>
                    <span style={{ color:'var(--muted)', fontSize:13 }}>{r.l}</span>
                    <span className="mono" style={{ color:r.c, fontWeight:700, fontSize:13 }}>{r.v}</span>
                  </div>
                ))}
              </div>

              <div className="card">
                <div style={{ fontSize:10, color:'var(--plasma)', fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:14 }}>💡 คำแนะนำ</div>
                {[
                  { t:'จัดการ Risk ต่อเทรด', d:'ไม่เกิน 1-2% ต่อเทรด', c:'var(--plasma)' },
                  { t:'บันทึกทุกเทรด', d:'ข้อมูลครบ = วิเคราะห์แม่น', c:'var(--neon)' },
                  { t:'Review รายสัปดาห์', d:'ดู Pattern ของ Win/Loss', c:'var(--purple)' },
                  { t:'ใช้ Pending Order', d:'รอให้ราคามาหา ไม่ไล่ราคา', c:'var(--amber)' },
                ].map(tip=>(
                  <div key={tip.t} style={{ background:'var(--surface)', borderLeft:`3px solid ${tip.c}`, borderRadius:'0 8px 8px 0', padding:'10px 14px', marginBottom:8 }}>
                    <div style={{ fontWeight:700, fontSize:12, marginBottom:2, color:tip.c }}>{tip.t}</div>
                    <div style={{ color:'var(--muted)', fontSize:11 }}>{tip.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FAB ADD BUTTON */}
      <button className="btn btn-plasma" onClick={openAdd}
        style={{ position:'fixed', bottom:24, right:24, width:52, height:52, borderRadius:'50%', padding:0, fontSize:22, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 24px rgba(0,212,255,0.4)', zIndex:50 }}>
        +
      </button>

      {/* TRADE MODAL */}
      {showTradeModal && (
        <div className="modal-overlay open">
          <div className="modal">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
              <div style={{ fontWeight:800, fontSize:17 }}>{editTrade?'✏️ แก้ไขเทรด':'📋 บันทึกการเทรด'}</div>
              <button onClick={()=>{setShowTradeModal(false);setEditTrade(null);setForm(emptyForm)}} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:22, cursor:'pointer', lineHeight:1 }}>✕</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))', gap:14 }}>
              {[{l:'วันที่',k:'date',t:'date'},{l:'Symbol',k:'symbol',t:'text',ph:'XAUUSD'}].map(f=>(
                <div key={f.k}>
                  <label style={{ fontSize:10, color:'var(--plasma)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:6 }}>{f.l}</label>
                  <input type={f.t||'text'} placeholder={(f as any).ph||''} value={form[f.k]||''} onChange={e=>setForm((p:any)=>({...p,[f.k]:e.target.value}))} />
                </div>
              ))}
              {[{l:'ตลาด',k:'market',opts:['Forex','Gold','Indices','Crypto']},{l:'Direction',k:'direction',opts:['BUY','SELL']},{l:'Result',k:'result',opts:['WIN','LOSS','BE']},{l:'Session',k:'session',opts:['London','New York','Asia']}].map(f=>(
                <div key={f.k}>
                  <label style={{ fontSize:10, color:'var(--plasma)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:6 }}>{f.l}</label>
                  <select value={form[f.k]} onChange={e=>setForm((p:any)=>({...p,[f.k]:e.target.value}))}>
                    {f.opts.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              {[{l:'Entry',k:'entry'},{l:'Stop Loss',k:'sl'},{l:'Take Profit',k:'tp'},{l:'Lot',k:'lot'},{l:'P&L ($)',k:'pnl'}].map(f=>(
                <div key={f.k}>
                  <label style={{ fontSize:10, color:'var(--plasma)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:6 }}>{f.l}</label>
                  <input type="number" step="any" placeholder="0.00" value={form[f.k]||''} onChange={e=>setForm((p:any)=>({...p,[f.k]:e.target.value}))} />
                </div>
              ))}
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize:10, color:'var(--plasma)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:6 }}>Setup / Strategy</label>
                <input placeholder="SMC Order Block, BOS, S&R..." value={form.setup||''} onChange={e=>setForm((p:any)=>({...p,setup:e.target.value}))} />
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize:10, color:'var(--plasma)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:6 }}>Note</label>
                <textarea rows={2} value={form.note||''} onChange={e=>setForm((p:any)=>({...p,note:e.target.value}))} placeholder="บันทึกเพิ่มเติม..." style={{ resize:'vertical' }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:24 }}>
              <button className="btn btn-ghost" onClick={()=>{setShowTradeModal(false);setEditTrade(null);setForm(emptyForm)}}>ยกเลิก</button>
              <button className="btn btn-plasma" onClick={saveTrade} disabled={saving}>{saving?'⏳ บันทึก...':'💾 บันทึก'}</button>
            </div>
          </div>
        </div>
      )}

      {/* PORTFOLIO MODAL */}
      {showPfModal && (
        <div className="modal-overlay open">
          <div className="modal" style={{ width:400 }}>
            <div style={{ fontWeight:800, fontSize:17, marginBottom:24 }}>💼 สร้างพอร์ตโฟลิโอใหม่</div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={{ fontSize:10, color:'var(--plasma)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:6 }}>ชื่อพอร์ต</label>
                <input placeholder="เช่น พอร์ตหลัก, Backtest 2026..." value={pfForm.name} onChange={e=>setPfForm(p=>({...p,name:e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize:10, color:'var(--plasma)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:6 }}>Capital เริ่มต้น ($)</label>
                <input type="number" value={pfForm.initial_balance} onChange={e=>setPfForm(p=>({...p,initial_balance:e.target.value}))} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:24 }}>
              <button className="btn btn-ghost" onClick={()=>setShowPfModal(false)}>ยกเลิก</button>
              <button className="btn btn-plasma" onClick={savePortfolio} disabled={!pfForm.name}>✅ สร้าง</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
