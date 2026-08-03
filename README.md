# 🚀 SMC Journal — คู่มือ Deploy ทีละขั้นตอน

## ⏱ ใช้เวลาประมาณ 20-30 นาที (ทำครั้งเดียวจบ)

---

## STEP 1 — สมัคร Supabase (ฟรี)

1. ไปที่ https://supabase.com → กด **Start your project**
2. Sign up ด้วย GitHub หรือ Email
3. กด **New Project**
4. ตั้งชื่อ project: `smc-journal`
5. ตั้ง Database Password (จำไว้)
6. เลือก Region: **Southeast Asia (Singapore)**
7. กด **Create new project** รอ ~2 นาที

---

## STEP 2 — ตั้งค่า Database

1. ใน Supabase → ไปที่ **SQL Editor** (ไอคอนตัว `</>`)
2. กด **New query**
3. เปิดไฟล์ `supabase_schema.sql` แล้ว **Copy ทั้งหมด**
4. วางใน SQL Editor → กด **Run** (Ctrl+Enter)
5. ถ้าเห็น "Success" แสดงว่าสำเร็จ ✅

---

## STEP 3 — ตั้งค่า Admin Email

ใน SQL Editor รันคำสั่งนี้ (เปลี่ยน email เป็นของคุณ):

```sql
ALTER DATABASE postgres SET "app.admin_email" TO 'your@email.com';
```

---

## STEP 4 — เอา API Keys

1. ใน Supabase → **Settings** → **API**
2. Copy ค่าเหล่านี้:
   - `Project URL` → นี่คือ `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → นี่คือ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → นี่คือ `SUPABASE_SERVICE_ROLE_KEY`

---

## STEP 5 — อัปโหลดโค้ดขึ้น GitHub

1. สมัคร https://github.com (ถ้ายังไม่มี)
2. กด **New repository** → ชื่อ `smc-journal` → **Public** → Create
3. ดาวน์โหลด [GitHub Desktop](https://desktop.github.com/) (ง่ายสุด)
4. Clone repo ที่เพิ่งสร้าง
5. Copy ไฟล์ทั้งหมดในโฟลเดอร์ `smc-journal` ไปวางใน repo
6. Commit → Push

---

## STEP 6 — Deploy บน Vercel (ฟรี)

1. ไปที่ https://vercel.com → Sign up ด้วย GitHub
2. กด **Add New Project**
3. Import repo `smc-journal` ที่เพิ่ง push
4. ใน **Environment Variables** ใส่ค่าเหล่านี้:

```
NEXT_PUBLIC_SUPABASE_URL        = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY       = eyJhbGc...
NEXT_PUBLIC_ADMIN_EMAIL         = your@email.com
```

5. กด **Deploy** รอ ~3 นาที
6. ได้ URL เช่น `https://smc-journal.vercel.app` 🎉

---

## STEP 7 — สมัครบัญชี Admin ครั้งแรก

1. เปิด URL ของแอป → กด **สมัครสมาชิก**
2. ใส่ **Email เดียวกับที่ตั้งใน NEXT_PUBLIC_ADMIN_EMAIL**
3. ระบบจะตั้ง role เป็น `admin` อัตโนมัติ
4. Login → จะเข้า Admin Panel ทันที

---

## STEP 8 — อนุมัติสมาชิก (ขั้นตอนปกติ)

เมื่อมีคนสมัครเข้ามา:

1. Login ด้วยบัญชี Admin
2. กดเมนู **👑 Admin**
3. เห็นรายการรอ "⏳ รออนุมัติ"
4. กด **✅ อนุมัติ**
5. เลือกจำนวนวัน: 7 / 14 / 30 / 90 / 365 วัน หรือ 0 = ไม่หมดอายุ
6. กด **ยืนยันอนุมัติ**
7. สมาชิกจะ Login ได้ทันที และจะ **เด้งออกอัตโนมัติ** เมื่อครบกำหนด

---

## 📱 ใช้บนมือถือ

แอปรองรับทุกขนาดหน้าจอ เปิด URL บน Browser มือถือได้เลย
หรือจะ **Add to Home Screen** เพื่อใช้แบบ App ก็ได้

---

## 🔄 Sync ข้ามอุปกรณ์

ข้อมูลซิงอัตโนมัติผ่าน Supabase Realtime
Login ด้วย Account เดียวกัน ข้อมูลขึ้นทุกเครื่อง

---

## ❓ ติดปัญหา?

- **Login ไม่ได้**: เช็ค Email ใน Supabase Auth → Users
- **ข้อมูลไม่ขึ้น**: เช็ค Environment Variables ใน Vercel
- **Build error**: เช็ค Log ใน Vercel Dashboard

---

## 📁 โครงสร้างไฟล์

```
smc-journal/
├── app/
│   ├── auth/page.tsx          ← หน้า Login/Register
│   ├── admin/page.tsx         ← Admin Panel
│   ├── dashboard/page.tsx     ← หน้าหลัก Journal
│   ├── layout.tsx
│   ├── page.tsx               ← Redirect
│   └── globals.css
├── components/
│   ├── Charts.tsx             ← กราฟทั้งหมด
│   └── CalendarView.tsx       ← ปฏิทิน
├── lib/
│   └── supabase.ts            ← Supabase client + Types
├── supabase_schema.sql        ← SQL รัน 1 ครั้ง
├── .env.local.example         ← Template env vars
├── package.json
└── next.config.js
```
