'use client'
import { useState } from 'react'
import type { Trade } from '@/lib/supabase'

export default function CalendarView({ trades }: { trades: Trade[] }) {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const monthNames = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
  const dayNames   = ['อา','จ','อ','พ','พฤ','ศ','ส']

  function nav(dir: number) {
    let m = month + dir, y = year
    if (m > 11) { m = 0; y++ }
    if (m < 0)  { m = 11; y-- }
    setMonth(m); setYear(y)
  }

  const dayMap: Record<number, { pnl: number; wins: number; losses: number; count: number }> = {}
  trades.forEach(t => {
    const d = new Date(t.date)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const k = d.getDate()
      if (!dayMap[k]) dayMap[k] = { pnl: 0, wins: 0, losses: 0, count: 0 }
      dayMap[k].pnl += (+t.pnl || 0); dayMap[k].count++
      if (t.result === 'WIN') dayMap[k].wins++
      if (t.result === 'LOSS') dayMap[k].losses++
    }
  })

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = now.getDate()
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month

  let mPnl = 0, mWins = 0, mLoss = 0, mCount = 0
  Object.values(dayMap).forEach(v => { mPnl += v.pnl; mWins += v.wins; mLoss += v.losses; mCount += v.count })
  const mWr = mWins + mLoss > 0 ? (mWins / (mWins + mLoss) * 100).toFixed(0) : '—'

  const fmt = (n: number) => { const a = Math.abs(n); const s = n >= 0 ? '+' : '-'; return `${s}$${a >= 1000 ? (a/1000).toFixed(1)+'k' : a.toFixed(0)}` }

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={()=>nav(-1)} style={{ background:'var(--card)', border:'1px solid var(--rim)', borderRadius:8, padding:'6px 14px', color:'var(--text)', cursor:'pointer', fontSize:14, transition:'.15s' }}>◀</button>
          <span style={{ fontWeight:800, fontSize:20, minWidth:200, textAlign:'center', color:'var(--text)' }}>{monthNames[month]} <span style={{ color:'var(--plasma)' }}>{year+543}</span></span>
          <button onClick={()=>nav(1)} style={{ background:'var(--card)', border:'1px solid var(--rim)', borderRadius:8, padding:'6px 14px', color:'var(--text)', cursor:'pointer', fontSize:14, transition:'.15s' }}>▶</button>
        </div>

        <div style={{ display:'flex', gap:16, fontSize:13 }}>
          {[
            { l:'Net P&L', v:fmt(mPnl), c:mPnl>=0?'var(--neon)':'var(--fire)' },
            { l:'Win Rate', v:`${mWr}${mWr!=='—'?'%':''}`, c:'var(--plasma)' },
            { l:'W', v:mWins.toString(), c:'var(--neon)' },
            { l:'L', v:mLoss.toString(), c:'var(--fire)' },
            { l:'เทรด', v:mCount.toString(), c:'var(--sub)' },
          ].map(s=>(
            <div key={s.l} style={{ textAlign:'center' }}>
              <div style={{ fontSize:9, color:'var(--muted)', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', marginBottom:2 }}>{s.l}</div>
              <div style={{ fontWeight:800, color:s.c, fontSize:15, fontFamily:'JetBrains Mono' }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding:16 }}>
        {/* Day headers */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:6 }}>
          {dayNames.map(d => (
            <div key={d} style={{ textAlign:'center', fontSize:10, color:'var(--muted)', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', padding:'4px 0' }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
          {Array(firstDay).fill(0).map((_, i) => <div key={`e${i}`} style={{ minHeight:76 }} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
            const info = dayMap[d]
            const isToday = isCurrentMonth && d === today
            let cls = 'cal-day'
            if (info) {
              if (info.wins > 0 && info.losses === 0) cls += ' win'
              else if (info.losses > 0 && info.wins === 0) cls += ' loss'
              else if (info.wins > 0 && info.losses > 0) cls += ' mixed'
            }
            if (isToday) cls += ' today'
            const col = !info?'var(--muted)':info.pnl>=0?'var(--neon)':'var(--fire)'

            return (
              <div key={d} className={cls}>
                <div style={{ fontSize:10, color: isToday?'var(--plasma)':'var(--muted)', fontWeight:700, fontFamily:'JetBrains Mono' }}>{d}</div>
                {info && (
                  <>
                    <div style={{ fontSize:11, fontWeight:800, marginTop:5, color:col, fontFamily:'JetBrains Mono' }}>{fmt(info.pnl)}</div>
                    <div style={{ display:'flex', gap:3, marginTop:4 }}>
                      {info.wins>0 && <span style={{ fontSize:9, background:'rgba(57,255,143,.15)', color:'var(--neon)', borderRadius:4, padding:'1px 5px', fontWeight:700 }}>W{info.wins}</span>}
                      {info.losses>0 && <span style={{ fontSize:9, background:'rgba(255,77,109,.15)', color:'var(--fire)', borderRadius:4, padding:'1px 5px', fontWeight:700 }}>L{info.losses}</span>}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
