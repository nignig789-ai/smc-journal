'use client'
import { Line, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import type { Trade } from '@/lib/supabase'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)

const chartOpts: any = (grid=true) => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: grid?'#1e2230':'transparent' } },
    y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: grid?'#1e2230':'transparent' } }
  }
})

export default function Charts({ trades }: { trades: Trade[] }) {
  const sorted = [...trades].sort((a,b)=>a.date.localeCompare(b.date))

  // Equity curve
  let cum = 0
  const eqLabels = sorted.map(t=>t.date.slice(5))
  const eqData   = sorted.map(t=>{ cum+=+t.pnl||0; return cum })

  // Day of week
  const days = ['อา','จ','อ','พ','พฤ','ศ','ส']
  const dowSums = Array(7).fill(0)
  trades.forEach(t=>{ dowSums[new Date(t.date).getDay()]+=(+t.pnl||0) })

  // Monthly
  const mMap: Record<string,number> = {}
  trades.forEach(t=>{ const m=t.date.slice(0,7); mMap[m]=(mMap[m]||0)+(+t.pnl||0) })
  const mLabels = Object.keys(mMap).sort()
  const mData   = mLabels.map(l=>mMap[l])

  // Pair performance
  const pairMap: Record<string,{pnl:number,total:number,wins:number}> = {}
  trades.forEach(t=>{
    if (!pairMap[t.symbol]) pairMap[t.symbol]={pnl:0,total:0,wins:0}
    pairMap[t.symbol].pnl+=(+t.pnl||0); pairMap[t.symbol].total++
    if (t.result==='WIN') pairMap[t.symbol].wins++
  })
  const sortedPairs = Object.entries(pairMap).sort((a,b)=>b[1].pnl-a[1].pnl)
  const bestPairs   = sortedPairs.slice(0,5)
  const worstPairs  = [...sortedPairs].reverse().slice(0,5)

  // Setup
  const setupMap: Record<string,{total:number,wins:number,pnl:number}> = {}
  trades.forEach(t=>{
    const k=t.setup||'Unknown'
    if (!setupMap[k]) setupMap[k]={total:0,wins:0,pnl:0}
    setupMap[k].total++; setupMap[k].pnl+=(+t.pnl||0)
    if (t.result==='WIN') setupMap[k].wins++
  })

  const fmt=(n:number)=>{ const a=Math.abs(n); return (n>=0?'+':'')+`$${a>=1000?(n/1000).toFixed(1)+'k':n.toFixed(0)}` }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Equity + Day of Week */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
        <div className="card">
          <div style={{ fontSize:12, color:'var(--sub)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:12 }}>Cumulative Profit Curve</div>
          <div style={{ height:160 }}>
            <Line data={{ labels:eqLabels, datasets:[{ data:eqData, fill:true, borderColor:'#22c55e', backgroundColor:'rgba(34,197,94,.1)', tension:.4, pointRadius:2, borderWidth:2 }] }} options={chartOpts()} />
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize:12, color:'var(--sub)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:12 }}>Day of Week</div>
          <div style={{ height:160 }}>
            <Bar data={{ labels:days, datasets:[{ data:dowSums, backgroundColor:dowSums.map(v=>v>=0?'rgba(34,197,94,.7)':'rgba(239,68,68,.7)'), borderRadius:4 }] }} options={chartOpts()} />
          </div>
        </div>
      </div>

      {/* Best / Worst Pairs */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {[{ title:'🏆 Best Pairs', data:bestPairs }, { title:'📉 Worst Pairs', data:worstPairs }].map(({title,data})=>(
          <div key={title} className="card">
            <div style={{ fontSize:12, color:'var(--sub)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:12 }}>{title}</div>
            {data.map(([sym,v])=>{
              const wr=(v.wins/v.total*100).toFixed(0)
              const col=v.pnl>=0?'var(--green)':'var(--red)'
              const maxPnl=Math.max(...data.map(([,x])=>Math.abs(x.pnl)),1)
              return (
                <div key={sym} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ fontWeight:800, minWidth:72, fontSize:13 }}>{sym}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ height:5, background:'var(--border)', borderRadius:3 }}>
                      <div style={{ height:5, borderRadius:3, background:col, width:`${(Math.abs(v.pnl)/maxPnl*100).toFixed(0)}%`, transition:'width .4s' }}/>
                    </div>
                    <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>{v.total}เทรด / WR {wr}%</div>
                  </div>
                  <div style={{ color:col, fontWeight:800, fontSize:13, minWidth:60, textAlign:'right' }}>{fmt(v.pnl)}</div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Setup Analysis + Monthly */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div className="card">
          <div style={{ fontSize:12, color:'var(--sub)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:12 }}>Setup Analysis</div>
          <div style={{ overflowX:'auto' }}>
            <table>
              <thead><tr><th>Setup</th><th>เทรด</th><th>Win%</th><th>Net P&L</th></tr></thead>
              <tbody>
                {Object.entries(setupMap).map(([k,v])=>{
                  const wr=(v.wins/v.total*100).toFixed(0)
                  const col=v.pnl>=0?'var(--green)':'var(--red)'
                  return (
                    <tr key={k}>
                      <td style={{ fontWeight:700, fontSize:12 }}>{k}</td>
                      <td style={{ color:'var(--muted)' }}>W{v.wins}/L{v.total-v.wins}</td>
                      <td><span style={{ color:+wr>=50?'var(--green)':'var(--red)', fontWeight:700 }}>{wr}%</span></td>
                      <td style={{ color:col, fontWeight:800 }}>{fmt(v.pnl)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize:12, color:'var(--sub)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:12 }}>Monthly P&L</div>
          <div style={{ height:160 }}>
            <Bar data={{ labels:mLabels, datasets:[{ data:mData, backgroundColor:mData.map(v=>v>=0?'rgba(34,197,94,.7)':'rgba(239,68,68,.7)'), borderRadius:4 }] }} options={chartOpts()} />
          </div>
        </div>
      </div>
    </div>
  )
}
