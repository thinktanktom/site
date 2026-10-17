# Telegram Notifier — Trade Notifications

## Overview

The Telegram notifier is invoked by the trading bot's lifecycle handlers at each trade event. It maintains no state — all computed values (running R-multiples, P&L) are passed in by the caller. Every send is fire-and-forget: a failed send is logged as a warning, and processing continues unaffected.

---

## Trade Entry (FR-12)

Fires when a trade entry order is filled.

**Contains:** symbol, direction (long/short), entry price, stop loss price, take profit price, position size in contracts, dollar risk, signal type (M or DB), active session (Asia / London / NYC AM / NYC PM).

---

## Stop Loss Hit (FR-13)

Fires when the stop loss fills.

**Contains:** symbol, direction, exit price, realized P&L in dollars and R-multiple, trade duration, today's running R-multiple total.

Distinct emoji indicating loss.

---

## Take Profit Hit (FR-14)

Fires when the take profit fills.

**Contains:** symbol, direction, exit price, realized P&L in dollars and R-multiple, trade duration, today's running R-multiple total.

Distinct emoji indicating win.

---

## Operator Flatten (FR-15)

Fires when the operator manually flattens a position via the `flatten` command.

**Contains:** symbol, direction, exit price, realized P&L in dollars and R-multiple, trade duration, exit reason (`operator_flatten`), today's running R-multiple total.

Distinct emoji indicating manual close.

---

## Partial Exit — Multi-Contract +2R (FR-23)

Multi-contract mode only. Fires when the +2R partial-exit stop-market fills.

**Contains:** symbol, fill price, contracts closed (50% of position), contracts remaining (50%), notification that breakeven stop is now in place.

Single-contract trades do not produce this notification.

---

## Breakeven SL Hit — Stage 2 (FR-24)

Multi-contract mode only. Fires when the breakeven stop fills on the remaining 50% after the partial exit.

**Contains:** symbol, direction, fill price (entry price), realized P&L in dollars and combined R-multiple (+1R typical), trade duration, today's running R-multiple total.

Distinct from FR-13 (original SL hit, −1R) and FR-14 (+3R TP hit).

---

## Single-Contract +2R Close (FR-25)

Single-contract mode only. Fires when the +2R stop-market fills, closing the entire 1-contract position.

**Contains:** symbol, direction, fill price, realized P&L in dollars and R-multiple (+2R), trade duration, today's running R-multiple total.

No Stage 2 exists in single-contract mode.

---

## Session-End Close-Out (FR-26)

Fires when any position open at end of NYC PM (17:00 ET) is flattened by the session-end rule.

**Contains:** symbol, direction, fill price, realized P&L in dollars and R-multiple, exit reason (`session_end_closeout`), trade duration, today's running R-multiple total.

Distinct from FR-15 (operator manual flatten).

---

## End-of-Day Summary (FR-16)

Fires at 17:01 ET after the last NYC PM session if Claude Code is running.

**Contains:** trade count for the day (closed trades only), win/loss split, daily P&L in dollars and R-multiples, cumulative P&L since system start, breakdown by session.

On no-trade days: "0 trades today" with unchanged cumulative figures. If Claude Code was not running at 17:01 ET, no summary is generated for that day.

---

## Notifier Interface

```python
# Trade lifecycle methods
notify_trade_entered(symbol, direction, entry, sl, tp, qty, risk_usd, signal_type, session)
notify_trade_exit_sl(symbol, direction, exit_price, pnl_usd, r_multiple, duration, running_r)
notify_trade_exit_tp(symbol, direction, exit_price, pnl_usd, r_multiple, duration, running_r)
notify_trade_flatten(symbol, direction, exit_price, pnl_usd, r_multiple, duration, running_r)
notify_partial_exit(symbol, fill_price, contracts_closed, contracts_remaining)
notify_breakeven_sl_hit(symbol, direction, fill_price, pnl_usd, r_multiple, duration, running_r)
notify_single_contract_target(symbol, direction, fill_price, pnl_usd, r_multiple, duration, running_r)
notify_session_end_closeout(symbol, direction, fill_price, pnl_usd, r_multiple, duration, running_r)
notify_daily_summary(trade_count, wins, losses, daily_pnl_usd, daily_r, cumulative_pnl_usd, cumulative_r, by_session)
```
