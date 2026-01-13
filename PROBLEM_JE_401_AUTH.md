# 🔴 PROBLÉM: 401 Unauthorized

## Co jsem zjistil

V konzoli je **HTTP/2 401** při POST na chat funkci.

**To znamená: Session token vypršel nebo není platný.**

## ✅ Řešení

### 1. Odhlásit se a přihlásit znovu

**Klikni na "Odhlásit" (vpravo nahoře) a přihlas se znovu.**

To obnoví session token.

### 2. Zkus chat znovu

Po přihlášení zkus napsat "Ahoj".

## 📝 Co jsem přidal

- Více logování do chat funkce
- Teď uvidíš v Supabase logs přesně, kde je problém

## 🔍 Kde vidět logy

https://supabase.com/dashboard/project/rtuczjobfpqmptfofgkt/functions/chat/logs

Uvidíš:
- ✅ User authenticated: [user_id]
- Nebo ❌ AUTH ERROR: No userId found

## ✅ Hotovo!

Odhlásit se a přihlásit by mělo vyřešit problém!
