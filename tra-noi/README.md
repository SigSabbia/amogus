# Tra noi, dal vivo

Prova in locale: `npm install && npm start`, poi apri http://localhost:3000 (organizzatore: password `admin`).

## Pubblicazione gratuita su Render
1. Crea un repository GitHub (anche privato) e carica tutti questi file.
2. Su render.com crea un account, poi New > Web Service e collega il repository.
3. Runtime Node, Build Command `npm install`, Start Command `npm start`, Instance Type Free.
4. In Environment aggiungi `ADMIN_PASSWORD` (la tua password da organizzatore).
   Facoltativo ma consigliato: `npx web-push generate-vapid-keys` in locale e copia i valori in
   `VAPID_PUBLIC` e `VAPID_PRIVATE`, cosi le notifiche restano valide dopo un riavvio.
5. Dopo il deploy condividi l'indirizzo https://NOME.onrender.com con i giocatori.

## Note
- Il servizio gratuito si "addormenta" dopo 15 minuti senza traffico e al risveglio impiega circa 1 minuto: aprilo 2-3 minuti prima di iniziare. Durante la partita i telefoni connessi lo tengono sveglio.
- Lo stato di gioco e in memoria: se Render riavvia il servizio la partita si azzera.
- Android: le notifiche funzionano da Chrome. iPhone (iOS 16.4+): bisogna prima "Aggiungi alla schermata Home" e aprire il gioco da quell'icona.
