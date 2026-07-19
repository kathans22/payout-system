# Payout System API Specifications

This document outlines the API contracts, request payloads, response bodies, status codes, and error formats.

---

## 1. Request/Response Contracts

### 1.1 Create User
*   **Method**: `POST`
*   **Path**: `/api/users`
*   **Request Body**:
    ```json
    {
      "name": "Kathan Shah",
      "email": "kathan@example.com"
    }
    ```
*   **Success Response (`201 Created`)**:
    ```json
    {
      "id": "6a5c7f3b86bf4900ba61f410",
      "name": "Kathan Shah",
      "email": "kathan@example.com",
      "balanceINR": 0.00
    }
    ```

### 1.2 Create Brand
*   **Method**: `POST`
*   **Path**: `/api/brands`
*   **Request Body**:
    ```json
    {
      "name": "BrandAcme"
    }
    ```
*   **Success Response (`201 Created`)**:
    ```json
    {
      "id": "6a5c7f3b86bf4900ba61f420",
      "name": "BrandAcme"
    }
    ```

### 1.3 Create Sale
*   **Method**: `POST`
*   **Path**: `/api/sales`
*   **Request Body**:
    ```json
    {
      "userId": "6a5c7f3b86bf4900ba61f410",
      "brandId": "6a5c7f3b86bf4900ba61f420",
      "earningPaise": 12000
    }
    ```
*   **Success Response (`201 Created`)**:
    ```json
    {
      "saleId": "6a5c7f3b86bf4900ba61f430",
      "status": "pending",
      "earningINR": 120.00
    }
    ```
*   **Error Response (`400 Bad Request` - Negative/Zero earnings validation)**:
    ```json
    {
      "error": {
        "code": "INVALID_EARNINGS",
        "message": "Sale earning must be greater than zero"
      }
    }
    ```

### 1.4 Trigger Background Advance Job
*   **Method**: `POST`
*   **Path**: `/api/jobs/advance-payout`
*   **Request Body**: None (Trigger run)
*   **Success Response (`200 OK`)**:
    ```json
    {
      "processedCount": 1,
      "totalAdvancePaidINR": 12.00
    }
    ```

### 1.5 Admin Reconcile Sale
*   **Method**: `POST`
*   **Path**: `/api/sales/:id/reconcile`
*   **Request Body (Approved)**:
    ```json
    {
      "status": "approved",
      "finalEarningPaise": 6800
    }
    ```
*   **Success Response (Approved - `200 OK`)**:
    ```json
    {
      "saleId": "6a5c7f3b86bf4900ba61f430",
      "status": "approved",
      "remainingPaidINR": 56.00
    }
    ```
*   **Request Body (Rejected)**:
    ```json
    {
      "status": "rejected"
    }
    ```
*   **Success Response (Rejected - `200 OK`)**:
    ```json
    {
      "saleId": "6a5c7f3b86bf4900ba61f430",
      "status": "rejected",
      "adjustmentINR": -12.00
    }
    ```
*   **Error Response (`409 Conflict` - Reconciling already resolved sale)**:
    ```json
    {
      "error": {
        "code": "ALREADY_RECONCILED",
        "message": "Sale has already been reconciled"
      }
    }
    ```

### 1.6 Fetch User Derived Balance
*   **Method**: `GET`
*   **Path**: `/api/users/:id/balance`
*   **Success Response (`200 OK`)**:
    ```json
    {
      "userId": "6a5c7f3b86bf4900ba61f410",
      "balanceINR": 68.00
    }
    ```

### 1.7 Request Payout Withdrawal
*   **Method**: `POST`
*   **Path**: `/api/users/:id/withdraw`
*   **Request Body**:
    ```json
    {
      "amountPaise": 5000
    }
    ```
*   **Success Response (`201 Created`)**:
    ```json
    {
      "payoutId": "6a5c7f3b86bf4900ba61f440",
      "status": "initiated",
      "amountINR": 50.00
    }
    ```
*   **Error Response (`429 Too Many Requests` - 24h Payout Throttle)**:
    - **Headers**: `Retry-After: 86400`
    - **Body**:
      ```json
      {
        "error": {
          "code": "WITHDRAWAL_LOCKED",
          "message": "Only one withdrawal is allowed every 24 hours"
        }
      }
      ```
*   **Error Response (`400 Bad Request` - Overdraft check)**:
    ```json
    {
      "error": {
        "code": "INSUFFICIENT_BALANCE",
        "message": "Insufficient balance for withdrawal"
      }
    }
    ```

### 1.8 Webhook: Payout Processor Failure
*   **Method**: `POST`
*   **Path**: `/api/payouts/:id/fail`
*   **Request Body**: None
*   **Success Response (`200 OK`)**:
    ```json
    {
      "payoutId": "6a5c7f3b86bf4900ba61f440",
      "status": "failed",
      "refundedINR": 50.00
    }
    ```
*   **Error Response (`400 Bad Request` - Double failure prevention)**:
    ```json
    {
      "error": {
        "code": "PAYOUT_ALREADY_RESOLVED",
        "message": "Payout is not in initiated state"
      }
    }
    ```

### 1.9 Fetch User Ledger Entries
*   **Method**: `GET`
*   **Path**: `/api/users/:id/ledger`
*   **Success Response (`200 OK`)**:
    ```json
    [
      {
        "id": "6a5c7f3b86bf4900ba61f450",
        "saleId": "6a5c7f3b86bf4900ba61f430",
        "type": "ADVANCE",
        "amountINR": 12.00,
        "referenceId": null,
        "createdAt": "2026-07-19T13:05:00Z"
      },
      {
        "id": "6a5c7f3b86bf4900ba61f460",
        "saleId": "6a5c7f3b86bf4900ba61f430",
        "type": "FINAL_SETTLEMENT",
        "amountINR": 56.00,
        "referenceId": null,
        "createdAt": "2026-07-19T13:10:00Z"
      }
    ]
    ```

---

## 2. Global Error Structure
All API error responses follow the standard format:
```json
{
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human readable description of the failure"
  }
}
```
Standard mapped error codes:
- `INVALID_EARNINGS` (400)
- `INSUFFICIENT_BALANCE` (400)
- `PAYOUT_ALREADY_RESOLVED` (400)
- `WITHDRAWAL_LOCKED` (429)
- `ALREADY_RECONCILED` (409)
- `NOT_FOUND` (404)
- `INTERNAL_SERVER_ERROR` (500)
