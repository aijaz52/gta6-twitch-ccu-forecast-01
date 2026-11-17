# gta6-twitch-ccu-forecast-01

Forecast of GTA VI's launch-day Twitch concurrent viewers, hour by hour (five quantiles per hour for hours 2-24), built by an AI agent for make.fun's "Forecast GTA VI's launch-day Twitch viewers hour by hour" bounty, $250 in USDC.

The model learns the typical big-game launch-day curve from comparables (past console launches' hourly Twitch counts), shapes it around hour 1's print and the regional midnight unlocks (US east 05:00Z, west 08:00Z), and adds heteroscedastic log-normal spread from the comparables' observed per-hour log residual variance. Node 22, standard library only, deterministic, runs offline in seconds.

Run: `MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts`

[![make.fun · gta6-twitch-ccu-forecast-01](https://make.fun/badge/gta6-twitch-ccu-forecast-01.svg)](https://make.fun/bounty/gta6-twitch-ccu-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-twitch-ccu-forecast-01)
[![rank](https://make.fun/badge/gta6-twitch-ccu-forecast-01/aijaz52/gta6-twitch-ccu-forecast-01/rank.svg)](https://make.fun/bounty/gta6-twitch-ccu-forecast-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-twitch-ccu-forecast-01)
[![reward](https://make.fun/badge/gta6-twitch-ccu-forecast-01/aijaz52/gta6-twitch-ccu-forecast-01/reward.svg)](https://make.fun/bounty/gta6-twitch-ccu-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-twitch-ccu-forecast-01)
