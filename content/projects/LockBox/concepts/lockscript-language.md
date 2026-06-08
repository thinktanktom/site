# LockScript Language

## Overview

LockScript is a purpose-built expression language for encoding asset unlock conditions. A lock script is stored as a plain string with the asset. At unlock time, the service compiles it to bytecode and executes it in a sandboxed VM; the asset is released only if the script evaluates to `true`.

---

## Syntax

LockScript is expression-oriented. The top-level value of a script must be a boolean. Statements supported:

- `if / else` blocks
- `require(condition, "message")` — halts execution with an error if the condition is false
- `transfer(to, amount, token)` — initiates a token transfer (used in automated unlock flows)
- Function calls and binary / unary expressions

---

## Built-in Functions

| Function | Signature | Description |
|---|---|---|
| `now()` | `() → int64` | Current Unix timestamp |
| `after(ts)` | `(int64) → bool` | `true` if current time > `ts` |
| `before(ts)` | `(int64) → bool` | `true` if current time < `ts` |
| `sha256(data)` | `(string) → string` | SHA-256 hash of input |
| `verify_sig(pk, msg, sig)` | `(string, string, string) → bool` | Ed25519 signature verification |
| `require_sigs(pks, msg, sigs, n)` | `([]string, string, []string, int) → bool` | Ed25519 m-of-n multi-sig |
| `check_geo(region)` | `(string) → bool` | Geographic region check |
| `min(a, b, ...)` | `(int...) → int` | Minimum of arguments |
| `max(a, b, ...)` | `(int...) → int` | Maximum of arguments |

---

## Execution Context Variables

The VM is initialised with these variables populated from the unlock request:

| Variable | Type | Value |
|---|---|---|
| `current_time` | `int64` | Unix timestamp at unlock |
| `unlock_time` | `int64` | The asset's configured unlock time |
| `asset_id` | `string` | Hex asset ID |
| `owner` | `string` | Owner public key (hex) |
| `signature` | `string` | Unlock signature (hex) |
| `signatures` | `[]string` | All supplied signatures |
| `pubkeys` | `[]string` | All supplied public keys |
| `message` | `string` | Message that was signed (usually `asset_id`) |

---

## Example Scripts

```js
// Simple time-lock: asset cannot be unlocked before a timestamp
after(1700000000)
```

```js
// Time-lock + owner signature
after(unlock_time) && verify_sig(owner, asset_id, signature)
```

```js
// 2-of-3 multi-sig (real Ed25519 verification)
require_sigs(pubkeys, message, signatures, 2)
```

```js
// Geographic restriction
check_geo("us-east") || check_geo("eu-west")
```

```js
// Complex: time-lock with owner OR emergency multi-sig
after(unlock_time) && (
    verify_sig(owner, message, signature) ||
    require_sigs(emergency_keys, message, emergency_sigs, 2)
)
```

---

## VM Internals

The VM is a **stack-based bytecode interpreter**:

1. **Lexer** — tokenises the script string into keywords, identifiers, literals, and operators.
2. **Parser** — builds an AST (`IfNode`, `RequireNode`, `BinaryExpr`, `CallExpr`, etc.).
3. **Compiler** — walks the AST and emits bytecode using 27+ opcodes (`OpPush`, `OpLoad`, `OpCallBuiltin`, `OpJumpIf`, `OpReturn`, etc.).
4. **VM** — executes bytecode against a value stack with a 65 536-byte memory limit and a 5-second execution timeout.

Compiled scripts are cached to avoid repeated compilation for frequently-evaluated conditions.

---

## Security Constraints

- **Memory limit:** 65 536 bytes stack + heap.
- **Time limit:** 5-second execution wall clock timeout.
- **No I/O:** scripts cannot perform network calls, file access, or any system interaction.
- **No `eval`:** scripts cannot compile or execute other scripts.
- **Fuzz-tested:** the VM has a fuzz test (`vm_fuzz_test.go`) exercising malformed bytecode paths.

Scripts are validated at lock time (fail-fast compilation check) so malformed scripts never reach the execution path at unlock.
