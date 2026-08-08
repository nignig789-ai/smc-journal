'use client'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import type { Trade } from '@/lib/supabase'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

const baseOpts: any = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e2333', borderColor: '#252d42', borderWidth: 1, titleColor: '#e8edf7', bodyColor: '#8892aa', padding: 10, cornerRadius: 8 } },
  scales: {
    x: { ticks: { color: '#4a5568', font: { size: 10, family: 'JetBrains Mono' } }, grid: { color: 'rgba(37,45,66,0.5)' }, border: { display: false } },
    y: { ticks: { color: '#4a5568', font: { size: 10, family: 'JetBrains Mono' } }, grid: { color: 'rgba(37,45,66,0.5)' }, border: { display: false } }
  }
}

export default function Charts({ trades }: { trades: Trade[] }) {
  const sorted = [...trades].sort((a,b)=>a.date.localeCompare(b.date))
  let cum = 0
  const eqLabels = sorted.map(t=>t.date.slice(5))
  const eqData   = sorted.map(t=>{ cum+=+t.pnl||0; return cum })

  const days = ['อา','จ','อ','พ','พฤ','ศ','ส']
  const dowSums = Array(7).fill(0)
  trades.forEach(t=>{ dowSums[new Date(t.date).getDay()]+=(+t.pnl||0) })

  const mMap: Record<string,number> = {}
  trades.forEach(t=>{ const m=t.date.slice(0,7); mMap[m]=(mMap[m]||0)+(+t.pnl||0) })
  const mLabels = Object.keys(mMap).sort()
  const mData   = mLabels.map(l=>mMap[l])

  const pairMap: Record<string,{pnl:number,total:number,wins:number}> = {}
  trades.forEach(t=>{
    if (!pairMap[t.symbol]) pairMap[t.symbol]={pnl:0,total:0,wins:0}
    pairMap[t.symbol].pnl+=(+t.pnl||0); pairMap[t.symbol].total++
    if (t.result==='WIN') pairMap[t.symbol].wins++
  })
  const sortedPairs = Object.entries(pairMap).sort((a,b)=>b[1].pnl-a[1].pnl)
  const best  = sortedPairs.slice(0,5)
  const worst = [...sortedPairs].reverse().slice(0,5)

  const setupMap: Record<string,{total:number,wins:number,pnl:number}> = {}
  trades.forEach(t=>{
    const k=t.setup||'Unknown'
    if (!setupMap[k]) setupMap[k]={total:0,wins:0,pnl:0}
    setupMap[k].total++; setupMap[k].pnl+=(+t.pnl||0)
    if (t.result==='WIN') setupMap[k].wins++
  })

  const wins=trades.filter(t=>t.result==='WIN').length
  const losses=trades.filter(t=>t.result==='LOSS').length
  const be=trades.filter(t=>t.result==='BE').length

  const fmt=(n:number)=>{ const a=Math.abs(n); const s=n>=0?'+':'-'; return `${s}$${a>=1000?(a/1000).toFixed(1)+'k':a.toFixed(0)}` }

  const cardStyle = { background:'var(--card)', border:'1px solid var(--rim)', borderRadius:12, padding:20 }
  const titleStyle = { fontSize:10, color:'var(--muted)', fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase' as const, marginBottom:16 }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Equity + Donut */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
        <div style={cardStyle}>
          <div style={titleStyle}>📈 Equity Curve</div>
          <div style={{ height:180 }}>
            <Line data={{ labels:eqLabels, datasets:[{ data:eqData, fill:true, borderColor:'#00d4ff', backgroundColor:'rgba(0,212,255,0.05)', tension:.4, pointRadius:0, borderWidth:2, pointHoverRadius:4, pointHoverBackgroundColor:'#00d4ff' }] }} options={baseOpts} />
          </div>
        </div>
        <div style={cardStyle}>
          <div style={titleStyle}>🎯 W/L Ratio</div>
          <div style={{ height:150, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Doughnut data={{ labels:['WIN','LOSS','BE'], datasets:[{ data:[wins,losses,be], backgroundColor:['rgba(57,255,143,0.8)','rgba(255,77,109,0.8)','rgba(74,85,104,0.8)'], borderWidth:0, hoverOffset:4 }] }}
              options={{ responsive:true, maintainAspectRatio:false, cutout:'70%', plugins:{ legend:{ position:'bottom', labels:{ color:'#8892aa', font:{size:11}, padding:12 } }, tooltip:{ backgroundColor:'#1e2333', borderColor:'#252d42', borderWidth:1 } } }} />
          </div>
          <div style={{ display:'flex', justifyContent:'center', gap:16, marginTop:8, fontSize:12 }}>
            <span style={{ color:'var(--neon)', fontWeight:700, fontFamily:'JetBrains Mono' }}>W {wins}</span>
            <span style={{ color:'var(--fire)', fontWeight:700, fontFamily:'JetBrains Mono' }}>L {losses}</span>
            <span style={{ color:'var(--muted)', fontWeight:700, fontFamily:'JetBrains Mono' }}>BE {be}</span>
          </div>
        </div>
      </div>

      {/* Best/Worst + Monthly */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
        {[{title:'🏆 Best Pairs',data:best},{title:'📉 Worst Pairs',data:worst}].map(({title,data})=>(
          <div key={title} style={cardStyle}>
            <div style={titleStyle}>{title}</div>
            {data.map(([sym,v])=>{
              const wr=(v.wins/v.total*100).toFixed(0)
              const col=v.pnl>=0?'var(--neon)':'var(--fire)'
              const maxPnl=Math.max(...data.map(([,x])=>Math.abs(x.pnl)),1)
              return (
                <div key={sym} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px solid rgba(37,45,66,0.5)' }}>
                  <div style={{ fontWeight:700, minWidth:70, fontSize:12, color:'var(--plasma)', fontFamily:'JetBrains Mono' }}>{sym}</div>
                  <div style={{ flex:1 }}>
                    <div className="progress"><div className="progress-bar" style={{ width:`${(Math.abs(v.pnl)/maxPnl*100).toFixed(0)}%`, background:`linear-gradient(90deg, ${col}, ${col}88)` }}/></div>
                    <div style={{ fontSize:9, color:'var(--muted)', marginTop:2 }}>{v.total}เทรด · WR{wr}%</div>
                  </div>
                  <div style={{ color:col, fontWeight:700, fontSize:12, minWidth:52, textAlign:'right', fontFamily:'JetBrains Mono' }}>{fmt(v.pnl)}</div>
                </div>
              )
            })}
          </div>
        ))}
        <div style={cardStyle}>
          <div style={titleStyle}>📅 Monthly P&L</div>
          <div style={{ height:160 }}>
            <Bar data={{ labels:mLabels, datasets:[{ data:mData, backgroundColor:mData.map(v=>v>=0?'rgba(57,255,143,0.7)':'rgba(255,77,109,0.7)'), borderRadius:6, borderSkipped:false }] }} options={baseOpts} />
          </div>
        </div>
      </div>

      {/* Day of Week + Setup */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div style={cardStyle}>
          <div style={titleStyle}>📆 Day of Week Performance</div>
          <div style={{ height:150 }}>
            <Bar data={{ labels:days, datasets:[{ data:dowSums, backgroundColor:dowSums.map(v=>v>=0?'rgba(57,255,143,0.7)':'rgba(255,77,109,0.7)'), borderRadius:6, borderSkipped:false }] }} options={baseOpts} />
          </div>
        </div>
        <div style={cardStyle}>
          <div style={titleStyle}>⚡ Setup Analysis</div>
          <div style={{ overflowX:'auto' }}>
            <table>
              <thead><tr><th>Setup</th><th>เทรด</th><th>Win%</th><th>Net P&L</th></tr></thead>
              <tbody>
                {Object.entries(setupMap).map(([k,v])=>{
                  const wr=(v.wins/v.total*100).toFixed(0)
                  const col=v.pnl>=0?'var(--neon)':'var(--fire)'
                  return (
                    <tr key={k}>
                      <td style={{ fontWeight:600, fontSize:11 }}>{k}</td>
                      <td style={{ color:'var(--muted)', fontSize:11, fontFamily:'JetBrains Mono' }}>W{v.wins}/L{v.total-v.wins}</td>
                      <td><span style={{ color:+wr>=50?'var(--neon)':'var(--fire)', fontWeight:700, fontFamily:'JetBrains Mono', fontSize:12 }}>{wr}%</span></td>
                      <td style={{ color:col, fontWeight:700, fontFamily:'JetBrains Mono', fontSize:12 }}>{fmt(v.pnl)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
