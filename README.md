The 15-Minute Candle

A Node.js backtester that tests a simple opening-range breakout on EUR/USD, using the first 15-minute candle of the London and New York sessions as the range.

It pulls 15-minute forex bars from the Massive API (formerly Polygon.io), runs the strategy for every weekday in a date range, and prints the results and win rate for each session.

The Strategy

For each trading day and each session (London, New York):

Fetch the first 2 hours of 15-minute candles from the session open.
The first candle defines the range: its high (H) and low (L).
Scan the following candles for the first breakout close:
Long: a candle closes above H.
Short: a candle closes below L.
Once in a trade:
Success: price closes at the target, 2 x (H - L) beyond the breakout side.
Failure: price closes back through the opposite side of the range.
Open: neither happens within the 2-hour window.
Only one trade per session is taken.

Possible outcomes per session: success, failure, open, nobreakout (price never closed outside the range), or skipped (no data, for example a holiday).

Session Times
Session	Timezone	Start (local)
London	Europe/London	08:00
New York	America/New_York	09:30

Start times are computed in each session's own timezone, so daylight saving changes in the UK and US are handled automatically. Weekends are skipped.

Setup
1. Requirements
Node.js 18 or newer
A Massive API key (massive.com)
2. Install
bash
git clone https://github.com/anmolchauhan-trader/the-15-minute-candle.git
cd the-15-minute-candle
npm install @massive.com/client-js dotenv

Make sure package.json contains "type": "module" (the project uses ES module imports).

3. Add your API key

Create a .env file in the project root:

env
MASSIVE_APIKEY=your_api_key_here

.env is listed in .gitignore and should never be committed.

4. Run
bash
node index.js
Configuration

All settings are constants at the top of index.js:

Setting	Default	Description
TICKER	C:EURUSD	Forex pair (Massive uses the C: prefix)
START_DATE	2026-09-01	First day to test
END_DATE	2026-11-13	Last day to test
RR	2	Target as a multiple of the first candle's range
SESSIONS	London 08:00, New York 09:30	Session timezones and open times
BATCH_SIZE	5	Requests to make before pausing
BATCH_PAUSE_MS	61000	Pause length after each batch (ms)
Example Output
2026-09-01 london long success
2026-09-01 newyork short failure
...

london: { success: 21, failure: 18, open: 3, nobreakout: 4, skipped: 2 } win rate: 53.8%

newyork: { success: 17, failure: 22, open: 5, nobreakout: 2, skipped: 2 } win rate: 43.6%

(Illustrative numbers only.)

API Rate Limits

The free Massive plan has historically been limited to 5 requests per minute. The script makes 2 requests per weekday (one per session) and pauses after every 5 requests (BATCH_SIZE and BATCH_PAUSE_MS) to stay under the limit.

On a paid plan you can lower or remove the pause. Check the Massive dashboard for your plan's current limits and data access (forex intraday data may require a paid plan).

Project Structure
.
├── index.js          # fetching, strategy and backtest loop
├── package.json
├── .env              # your API key (not committed)
├── .gitignore
└── README.md
Limitations
Trades are decided on candle closes only. Real stops and targets can be hit by wicks.
No spread, commission or slippage is modelled.
Forex bars from Massive are built from quotes rather than trades, so volume is not reliable.
Times with no quotes produce no bar, so quiet periods can have fewer than 8 candles.
Results depend on the session definitions above. Change SESSIONS to test other opens.
Disclaimer

This project is for educational and research purposes only. It is not financial advice. Backtested results do not guarantee future performance, and trading forex involves substantial risk.
