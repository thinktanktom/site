# LockScript Engine

## Overview

The LockScript engine is the component that parses, compiles, and executes lock scripts. It provides a complete pipeline from source string to verified boolean result.

The implementation lives in `internal/lockscript/`.

---

## Pipeline

```
Source string
     │
     ▼
  Lexer (lexer.go)
     │  tokens
     ▼
  Parser (parser.go)
     │  AST
     ▼
  Compiler (engine_additions.go, engine_exec_ast.go)
     │  bytecode
     ▼
  VM (vm.go)
     │  execution result
     ▼
  bool (true = unlock allowed)
```

---

## Engine

The `Engine` is the high-level entry point:

```go
engine := NewEngine(nil, 65536, 5*time.Second)
engine.RegisterBuiltinFunctions()

// Compile a script (validates syntax, returns compiled bytecode)
compiled, err := engine.CompileScript(ctx, scriptSource)

// Execute compiled bytecode against an unlock context
ctx := NewContext()
ctx.Set("unlock_time", asset.UnlockTime.Unix())
ctx.Set("owner", ownerPubKeyHex)
ctx.Set("asset_id", asset.ID)
ctx.Set("signature", signatureHex)

result, err := engine.Execute(compiled, ctx)
// result.(bool) == true → unlock conditions satisfied
```

`CompileScript` is called at **lock time** to validate the script before the asset is persisted. A script that fails to compile prevents the lock from being created.

---

## Script Cache

Compiled scripts are cached by source content hash to avoid recompilation on repeated evaluations. The cache is an LRU-style in-memory store (`cache.go`). Cache size and TTL are configurable.

```go
// Cache hit path (typical unlock)
compiled, hit := engine.cache.Get(scriptHash)
if !hit {
    compiled, _ = engine.compile(source)
    engine.cache.Set(scriptHash, compiled)
}
```

---

## VM Design

The VM (`vm.go`) is a stack-based interpreter:

- **Stack:** value stack holding `int64`, `bool`, `string`, and `[]string` values.
- **Memory:** flat key-value store for named variables (`OpLoad` / `OpStore`).
- **Limits:** 65 536-byte combined stack + memory limit; 5-second wall-clock timeout.
- **Opcodes:** 27+ operations across stack manipulation, arithmetic, comparison, logical, control flow, and function call categories.

The full opcode set is defined in `opcodes.go`. Notable opcodes:

| Opcode | Description |
|---|---|
| `OpPush` | Push a literal onto the stack |
| `OpLoad` | Load a named variable from memory |
| `OpCallBuiltin` | Call a registered built-in function |
| `OpJumpIf` | Conditional branch |
| `OpReturn` | Halt execution with top-of-stack as result |
| `OpSigVerify` | Dedicated Ed25519 signature verification |
| `OpTimeCheck` | Evaluate time-based conditions |

---

## Ed25519 Signing Support

`signing.go` provides the cryptographic primitives consumed by `verify_sig` and `require_sigs`:

```go
// Generate a key pair (Ed25519)
privKey, pubKey := GenerateKeyPair()

// Sign a message
signature := SignMessage(privKey, message)

// Verify (as called by the VM built-in)
valid, err := VerifyEd25519Signature(
    pubKeyHex,
    message,
    signatureHex,
)
```

LockBox uses **Ed25519**, consistent with the IOTA protocol. `secp256k1` is not supported.

---

## Validator

`validator.go` provides static analysis of compiled scripts before execution — checking for invalid opcode sequences, unreachable code, and resource usage estimates. This is an additional safety layer on top of the compilation step.

---

## Key Operations (`key_operations.go`)

Key management helpers used within script execution context:
- Hex encoding / decoding of public keys and signatures.
- Conversion between IOTA address formats and script-compatible string representations.
- WASM-safe variant (`key_operations_wasm.go`) for environments without `syscall` access.
