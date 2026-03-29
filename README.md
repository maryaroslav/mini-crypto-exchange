# Mini Crypto Exchange API

REST API pro simulaci kryptoměnové burzy, vytvořené metodologií **TDD**.

## Doménový model
 
Systém modeluje zjednodušenou kryptoměnovou burzu se třemi entitami:

| Entita | Popis |
|---|---|
| **Wallet** | Peněženka uživatele s fiatovým zůstatkem (USD) |
| **Asset** | Kryptoaktivum v peněžence s množstvím |
| **TradeOrder** | Příkaz k nákupu nebo prodeji aktiva za cílovou cenu |

**Vztahy:** `Wallet 1:N Asset`, `Wallet 1:N TradeOrder`

### Obchodní pravidla

| # | Pravidlo |
|---|---|
| BR1 | Nelze vytvořit nákupní příkaz, pokud fiatový zůstatek nestačí na pokrytí ceny + provize |
| BR2 | Nelze vytvořit prodejní příkaz, pokud peněženka neobsahuje dostatečné množství aktiva |
| BR3 | Dynamická provize: 1 % pro objem <= 1 000 USD, 0,2 % pro objem > 1 000 USD |
| BR4 | Příkaz přejde do stavu `COMPLETED` pouze pokud aktuální tržní cena dosáhne cílové hodnoty |
| BR5 | Při úspěšném obchodu jsou zůstatky fiatové měny i aktiva aktualizovány atomicky v databázové transakci |

## Technologický stack

- **Runtime:** Node.js 20, TypeScript 5
- **Framework:** Express.js
- **ORM:** Prisma
- **Validace:** Zod
- **Testování:** Jest + ts-jest + Supertest
- **CI/CD:** GitHub Actions

## Architektura

```
src/
├── app.ts                  
├── index.ts                
├── errors/
│   └── AppError.ts         
├── lib/
│   ├── prisma.ts           
│   └── priceProvider.ts    
├── middleware/
│   └── errorHandler.ts     
├── routes/
│   ├── wallet.routes.ts    
│   └── tradeOrder.routes.ts 
├── schemas/
│   └── index.ts            
└── services/
    └── tradeOrder.service.ts # Doménová logika (všechna BR)
```

**Vrstvy:** Routes (HTTP) -> Services -> Prisma

## Lokální spuštění

### Požadavky

- Node.js 20+
- npm

### Instalace

```bash
git clone https://github.com/maryaroslav/mini-crypto-exchange
cd mini-crypto-exchange
npm install
```

### Databáze

```bash
# Vytvoření a migrace vývojové databáze
npx prisma migrate dev --name init

# Generování Prisma klienta (po každé změně schématu)
npx prisma generate
```

### Spuštění serveru

```bash
npm run dev
npm run build
npm start
```

### API endpointy

| Metoda | Cesta | Popis |
|---|---|---|
| `POST` | `/wallets` | Vytvoření peněženky |
| `GET` | `/wallets/:id` | Načtení peněženky s aktivy |
| `POST` | `/orders` | Vytvoření obchodního příkazu |
| `GET` | `/orders/:id` | Načtení příkazu |
| `GET` | `/health` | Health check |

## Testování

### Spuštění testů

```bash
npm test                        # Všechny testy (unit + integrační)
npm test -- --no-coverage       # Bez výpočtu pokrytí
npm test -- --coverage          # S HTML reportem (./coverage/)
npx jest tradeOrder.service.test --no-coverage   # Konkrétní soubor
```

### Strategie testování

Projekt obsahuje dva typy testů:

#### Unit testy (`src/services/__tests__/`, `src/schemas/__tests__/`)

Testují izolovanou business logiku **bez databáze a bez HTTP**.

**Co je mockováno a proč:**

| Mock | Důvod |
|---|---|
| `prisma` (celý modul) | Unit testy nesmí záviset na DB - testujeme jen logiku, ne SQL |
| `PriceProvider.getCurrentPrice()` | Simuluje tržní ceny deterministicky (BR4 vyžaduje kontrolu nad cenou) |
| `prisma.$transaction` | Umožňuje ověřit, že transakce je volána (BR5) bez skutečné DB |

**Soubory:**
- `tradeOrder.service.test.ts` - 22 testů pokrývajících BR1-BR5
- `schemas.test.ts` - 16 testů pro Zod validaci (happy path + error cases)

#### Integrační testy (`src/routes/__tests__/`)

Testují **celý stack**: HTTP request -> Express -> Zod -> Prisma -> SQLite.

Používají **reálnou SQLite databázi** (`prisma/test.db`), která je:
- Migrována před spuštěním celé sady (`jest.globalSetup.ts`)
- Čištěna po každém testu (`afterEach` s `deleteMany`)

**Co je mockováno:**
- `MarketPriceProvider` - eliminuje závislost na externím API price feedu

**Soubory:**
- `wallet.routes.test.ts` - 8 testů (POST/GET peněženky)
- `tradeOrder.routes.test.ts` - 8 testů (POST/GET příkazů, včetně BR1 a BR2 přes HTTP)

### Vylučování z pokrytí (Coverage Exclusions)

| Soubor | Důvod vyloučení |
|---|---|
| `src/index.ts` | Čistý bootstrap kód - netestovatelné unit testy |
| `src/**/*.d.ts` | Typové deklarace, žádná spustitelná logika |

### Quality Gates

Projekt vynucuje minimální pokrytí kódu:

```
branches:   70%
functions:  80%
lines:      80%
statements: 80%
```

## CI/CD

GitHub Actions workflow se spouští na každý push a PR do větve `main`:

1. Checkout kódu
2. Instalace závislostí
3. Generování Prisma klienta
4. Spuštění testů s pokrytím
5. Upload coverage reportu jako artefakt
