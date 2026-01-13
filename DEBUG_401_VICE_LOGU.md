# 🔍 DEBUG: Více logování pro 401

## Co jsem přidal

Přidal jsem HODNĚ logování do chat funkce:

- 🔑 Auth header present
- 🔑 Token extracted
- 👤 User from token
- ❌ Auth error from getUser

## Co teď udělat

### 1. Počkat 30 sekund ⏳

### 2. Obnovit stránku 🔄
F5 nebo Cmd+R

### 3. Zkusit napsat "Ahoj" 💬

### 4. Otevřít Supabase logy 📋

https://supabase.com/dashboard/project/rtuczjobfpqmptfofgkt/functions/chat/logs

**Uvidíš přesně, co se děje:**
- Jestli přichází Authorization header
- Jestli je token správně extrahován
- Jestli getUser vrací uživatele
- Nebo jestli je nějaká chyba

## Co hledat v lozích

✅ **Pokud funguje:**
```
🔑 Auth header present: true
🔑 Token extracted: eyJhbGciOiJIUzI1NiIs...
👤 User from token: [user-id]
✅ User authenticated: [user-id]
```

❌ **Pokud nefunguje:**
```
🔑 Auth header present: false
```
Nebo:
```
❌ Auth error from getUser: [error]
```

## ✅ Teď UVIDÍME problém!

S tímto logováním najdeme, kde přesně je problém.
