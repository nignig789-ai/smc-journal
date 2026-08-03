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

  // Build day map
  const dayMap: Record<number, { pnl: number; wins: number; losses: number; count: number }> = {}
  trades.forEach(t => {
    const d = new Date(t.date)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const k = d.getDate()
      if (!dayMap[k]) dayMap[k] = { pnl: 0, wins: 0, losses: 0, count: 0 }
      dayMap[k].pnl += (+t.pnl || 0)
      dayMap[k].count++
      if (t.result === 'WIN') dayMap[k].wins++
      if (t.result === 'LOSS') dayMap[k].losses++
    }
  })

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = now.getDate()
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month

  // Month summary
  let mPnl = 0, mWins = 0, mLoss = 0, mCount = 0
  Object.values(dayMap).forEach(v => { mPnl += v.pnl; mWins += v.wins; mLoss += v.losses; mCount += v.count })
  const mWr = mWins + mLoss > 0 ? (mWins / (mWins + mLoss) * 100).toFixed(0) : '—'

  const fmt = (n: number) => {
    const a = Math.abs(n)
    const s = n >= 0 ? '+' : '-'
    return `${s}$${a >= 1000 ? (a / 1000).toFixed(1) + 'k' : a.toFixed(0)}`
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={()=>nav(-1)} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, padding:'5px 12px', color:'var(--text)', cursor:'pointer', fontSize:14 }}>◀</button>
          <span style={{ fontWeight:800, fontSize:18, minWidth:180, textAlign:'center' }}>{monthNames[month]} {year + 543}</span>
          <button onClick={()=>nav(1)} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, padding:'5px 12px', color:'var(--text)', cursor:'pointer', fontSize:14 }}>▶</button>
        </div>
        <div style={{ display:'flex', gap:20, fontSize:13 }}>
          <span>Net P&L: <strong style={{ color: mPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(mPnl)}</strong></span>
          <span>WR: <strong style={{ color:'var(--accent)' }}>{mWr}{mWr!=='—'?'%':''}</strong></span>
          <span>W: <strong style={{ color:'var(--green)' }}>{mWins}</strong></span>
          <span>L: <strong style={{ color:'var(--red)' }}>{mLoss}</strong></span>
          <span>เทรด: <strong style={{ color:'var(--sub)' }}>{mCount}</strong></span>
        </div>
      </div>

      <div className="card" style={{ padding:12 }}>
        {/* Day headers */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:4 }}>
          {dayNames.map(d => (
            <div key={d} style={{ textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', padding:'4px 0' }}>{d}</div>
          ))}
        </div>

        {/* Calendar cells */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
          {/* Empty cells */}
          {Array(firstDay).fill(0).map((_, i) => <div key={`e${i}`} style={{ minHeight:80 }} />)}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
            const info = dayMap[d]
            const isToday = isCurrentMonth && d === today
            let borderColor = 'var(--border)'
            let bg = 'var(--surface)'
            if (info) {
              if (info.wins > 0 && info.losses === 0) { borderColor = 'rgba(34,197,94,.5)'; bg = 'rgba(34,197,94,.05)' }
              else if (info.losses > 0 && info.wins === 0) { borderColor = 'rgba(239,68,68,.5)'; bg = 'rgba(239,68,68,.05)' }
              else if (info.wins > 0 && info.losses > 0) { borderColor = 'rgba(245,158,11,.5)'; bg = 'rgba(245,158,11,.05)' }
            }
            if (isToday) borderColor = 'var(--blue)'

            return (
              <div key={d} style={{
                minHeight: 80, padding: 6, borderRadius: 6,
                border: `1px solid ${borderColor}`, background: bg,
                transition: '.15s', cursor: info ? 'pointer' : 'default'
              }}>
                <div style={{ fontSize: 11, color: isToday ? 'var(--blue)' : 'var(--muted)', fontWeight: 700 }}>{d}</div>
                {info && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 800, marginTop: 4, color: info.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {fmt(info.pnl)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{info.count} เทรด</div>
                    <div style={{ display:'flex', gap:3, marginTop:3 }}>
                      {info.wins > 0 && <span style={{ fontSize:9, background:'rgba(34,197,94,.2)', color:'var(--green)', borderRadius:3, padding:'1px 4px', fontWeight:700 }}>W{info.wins}</span>}
                      {info.losses > 0 && <span style={{ fontSize:9, background:'rgba(239,68,68,.2)', color:'var(--red)', borderRadius:3, padding:'1px 4px', fontWeight:700 }}>L{info.losses}</span>}
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
