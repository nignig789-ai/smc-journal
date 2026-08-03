'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Root() {
  const router = useRouter()
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard')
      else router.replace('/auth')
    })
  }, [router])
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:12 }}>
      <div style={{ fontSize:28, fontWeight:800, color:'#f59e0b' }}>SMC<span style={{color:'#f97316'}}>Journal</span></div>
      <div style={{ color:'#64748b', fontSize:13 }}>กำลังโหลด...</div>
    </div>
  )
}
