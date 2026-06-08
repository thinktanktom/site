# B2B API

## Overview

The B2B layer (`internal/b2b`) provides a partner-facing gRPC and REST API for enterprise integrations. It handles revenue sharing, public token sales, and security token offerings — each integrated with the tiering system to enforce partner-level access controls.

---

## Transport

| Protocol | Details |
|---|---|
| gRPC | Defined in `internal/b2b/api/b2b_api.proto`, generated files in `b2b_api.pb.go` / `b2b_api_grpc.pb.go` |
| REST | HTTP/JSON gateway in `rest_gateway.go`, translates HTTP requests to gRPC calls |

The combined server (`server.go`) starts both transports on configurable ports and wires them to the underlying service handlers.

---

## Components

### RevenueManager (`revenue_sharing.go`)

Tracks and distributes revenue among registered partners.

**Key types:**

```go
type RevenueRecord struct {
    PartnerID     string
    Amount        uint64
    Currency      string
    Timestamp     time.Time
    TransactionID string
    Status        string
}

type PaymentStatus struct {
    PartnerID       string
    LastPaymentDate time.Time
    TotalPaid       uint64
    PendingAmount   uint64
    NextPaymentDate time.Time
}

type PartnerStatistics struct {
    PartnerID             string
    TotalTransactions     uint64
    TotalRevenue          uint64
    AverageTransactionSize uint64
    LastActivityDate      time.Time
    ActiveUsers           uint64
}
```

**Operations:**
- `RecordRevenue(ctx, partnerID, amount, transactionID)` — persists a revenue event for a partner.
- `GetPaymentStatus(ctx, partnerID)` — retrieves pending and historical payment data.
- `GetPartnerStatistics(ctx, partnerID)` — returns aggregate transaction and revenue metrics.

Revenue shares are configured as a `map[string]float64` (partnerID → percentage) and can be updated at runtime.

---

### PublicSale (`public_sale.go`)

Manages open token sale rounds for LockCoin (LOCK). Handles sale creation, participation tracking, and allocation recording. Integrated with the tiering manager to enforce per-tier purchase limits.

---

### SecuritySale (`security_sale.go`)

Manages security token offering (STO) rounds. Enforces accreditation requirements and jurisdictional restrictions on top of the base sale mechanics.

---

### gRPC Server (`grpc_server.go`)

Implements the `B2BService` gRPC interface. All handlers delegate to the appropriate manager (`RevenueManager`, `PublicSale`, `SecuritySale`) and return structured protobuf responses.

Error mapping follows gRPC status codes:
- `codes.NotFound` — partner or sale not found
- `codes.PermissionDenied` — tier restriction or accreditation failure
- `codes.Unimplemented` — reserved endpoints not yet built out
- `codes.Internal` — storage or unexpected errors

---

### REST Gateway (`rest_gateway.go`)

A thin HTTP/JSON layer that translates incoming REST requests to gRPC calls and serialises responses back to JSON. It enables partner integrations that cannot use gRPC directly.

---

## Storage

The B2B layer uses the IOTA `hive.go` KVStore interface with realm-separated namespaces:

| Prefix | Namespace |
|---|---|
| `0x05` | Revenue records |
| `0x06` | Payment status |
| `0x07` | Partner statistics |

All records are serialised to JSON before storage. The `marshalutil` library from `hive.go` is used for length-prefixed binary encoding where binary efficiency matters.

---

## Tiering Integration

All B2B operations check the partner's tier via the `tiering.Manager` before execution. Tier-gated B2B capabilities:

| Capability | Basic | Standard | Premium | Elite |
|---|---|---|---|---|
| Revenue sharing | No | Yes | Yes | Yes |
| Public sale participation | Yes | Yes | Yes | Yes |
| Security token sale | No | No | Yes | Yes |
| Custom revenue share % | No | No | No | Yes |
