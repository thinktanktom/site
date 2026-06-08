# LockScript Built-in Functions

## Overview

Nine built-in functions are registered by `engine.RegisterBuiltinFunctions()`. They are called from LockScript via `OpCallBuiltin` and bridge the script environment to real cryptographic and system operations.

---

## Time Functions

### `now() → int64`

Returns the current Unix timestamp (seconds since epoch).

```js
now()  // e.g. 1717200000
```

### `after(ts int64) → bool`

Returns `true` if the current time is strictly greater than `ts`.

```js
after(1700000000)        // true if current time > 2023-11-14
after(unlock_time)       // true if the lock's configured unlock time has passed
```

### `before(ts int64) → bool`

Returns `true` if the current time is strictly less than `ts`.

```js
before(1800000000)       // true if before 2027-01-15
```

---

## Cryptographic Functions

### `sha256(data string) → string`

Returns the hex-encoded SHA-256 hash of the input string.

```js
sha256("hello")  // "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
```

### `verify_sig(pk string, msg string, sig string) → bool`

Verifies an Ed25519 signature. All three arguments are hex-encoded strings.

- `pk` — 32-byte Ed25519 public key (hex)
- `msg` — message that was signed (hex or plain string)
- `sig` — 64-byte Ed25519 signature (hex)

```js
verify_sig(owner, asset_id, signature)
```

Returns `true` if the signature is valid for the given key and message. Returns `false` (not an error) for invalid signatures — allowing scripts to branch on verification result rather than hard-fail.

### `require_sigs(pks []string, msg string, sigs []string, n int) → bool`

Ed25519 m-of-n multi-signature verification. Returns `true` if at least `n` of the signatures in `sigs` are valid Ed25519 signatures over `msg` by one of the keys in `pks`.

- Each signature is matched against the key at the same index position.
- `n` must be ≤ `len(pks)`.

```js
// 2-of-3 multi-sig
require_sigs(pubkeys, message, signatures, 2)
```

**Important:** Prior to the v2 fix, `require_sigs` counted non-empty strings rather than verifying actual cryptographic signatures. The current implementation performs real Ed25519 verification for each pair.

---

## Geographic Function

### `check_geo(region string) → bool`

Returns `true` if the node's configured geographic region matches the provided region identifier.

```js
check_geo("us-east")
check_geo("eu-west")
```

Region strings are matched against the node's runtime configuration. This is primarily used in enterprise/compliance scenarios where assets should only be accessible from specific jurisdictions.

---

## Math Functions

### `min(a, b, ...) → int`

Returns the minimum of the provided integer arguments.

```js
min(3, 7, 2)   // 2
min(a, b)       // lesser of two context variables
```

### `max(a, b, ...) → int`

Returns the maximum of the provided integer arguments.

```js
max(3, 7, 2)   // 7
```

---

## Usage Patterns

### Time-lock with single signature

```js
after(unlock_time) && verify_sig(owner, asset_id, signature)
```

### Multi-sig OR owner unlock

```js
verify_sig(owner, message, signature) ||
require_sigs(backup_keys, message, backup_sigs, 2)
```

### Commitment check

```js
sha256(preimage) == expected_hash && after(unlock_time)
```

### Geo-gated access

```js
check_geo("eu-west") && verify_sig(owner, asset_id, signature)
```
