# Balance Crediting Implementation

## Overview
This document describes the implementation of automatic balance crediting for doctors when appointments are completed and orders are paid, as per the analysis in `BALANCE_SYSTEM_ANALYSIS.md`.

## Implementation Summary

### 1. Helper Functions in `balance.service.js`

#### `creditBalance(userId, amount, transactionType, metadata)`
- Credits balance to a user's account
- Calculates platform fee (configurable via `PLATFORM_FEE_PERCENT` env variable, default 0%)
- Creates a transaction record with metadata
- Returns updated balance info

#### `debitBalance(userId, amount, transactionType, metadata)`
- Debits balance from a user's account
- Used for refunds
- Allows negative balance (with warning) for refund scenarios
- Creates a transaction record with metadata

#### `calculateNetAmount(amount, platformFeePercent)`
- Calculates net amount after platform fee
- Returns both net amount and platform fee

### 2. Order Payment Flow (`payment.service.js`)

**When an order is paid:**
1. Transaction is created (patient pays)
2. Order payment status is updated to 'PAID'
3. **NEW**: Seller (owner) balance is credited with the order subtotal
   - Platform fee is deducted if configured
   - Transaction record is created for the credit
   - Error handling: If crediting fails, payment still succeeds (logged for retry)

**Note**: Currently credits only the `subtotal` (product amount), not shipping. Shipping can be handled separately if needed.

### 3. Appointment Payment Flow (`appointment.service.js`)

**When an appointment status changes to 'COMPLETED':**
1. Appointment status is updated to 'COMPLETED'
2. **NEW**: If payment status is 'PAID', doctor balance is credited
   - Finds the original payment transaction
   - Checks if balance was already credited (prevents double crediting)
   - Credits doctor balance with the payment amount
   - Platform fee is deducted if configured
   - Transaction record is created for the credit
   - Error handling: If crediting fails, status update still succeeds (logged for retry)

**Why on completion, not on payment?**
- Ensures doctor delivered the service before receiving payment
- Avoids refund complications if appointment is cancelled
- More secure for the platform

### 4. Refund Flow (`payment.service.js`)

**When a transaction is refunded:**
1. Transaction status is updated to 'REFUNDED'
2. **NEW**: If balance was previously credited, it is deducted
   - For appointments: Deducts from doctor's balance
   - For orders: Deducts from seller's balance
   - Finds the original credit transaction to get the exact amount
   - Creates a debit transaction record
   - Error handling: If deduction fails, refund still proceeds (logged for retry)

## Configuration

### Environment Variables

```env
# Platform fee percentage (0-100, default 0%)
PLATFORM_FEE_PERCENT=0
```

Example: If `PLATFORM_FEE_PERCENT=10`, and a doctor earns $100:
- Platform fee: $10
- Doctor receives: $90

## Transaction Metadata

All balance credit/debit transactions include metadata:

### Credit Transaction Metadata:
```javascript
{
  type: 'BALANCE_CREDIT',
  transactionType: 'APPOINTMENT' | 'ORDER',
  grossAmount: 100,        // Original payment amount
  platformFee: 10,         // Platform fee deducted
  platformFeePercent: 10,  // Platform fee percentage
  netAmount: 90,          // Amount credited to doctor
  appointmentId: '...',   // For appointments
  orderId: '...',          // For orders
  transactionId: '...'    // Original payment transaction ID
}
```

### Debit Transaction Metadata (Refunds):
```javascript
{
  type: 'BALANCE_DEBIT',
  transactionType: 'REFUND',
  amount: 90,            // Amount deducted
  originalTransactionId: '...',  // Original payment transaction
  appointmentId: '...',    // For appointment refunds
  orderId: '...',          // For order refunds
  refundReason: '...'      // Reason for refund
}
```

## Error Handling

All balance operations are wrapped in try-catch blocks:
- **Payment processing**: If crediting fails, payment still succeeds (prevents blocking patient payments)
- **Status updates**: If crediting fails, status update still succeeds (prevents blocking workflow)
- **Refunds**: If deduction fails, refund still proceeds (prevents blocking refunds)

Errors are logged to console for monitoring and potential retry mechanisms.

## Testing Recommendations

1. **Test Order Payment:**
   - Create an order and pay for it
   - Verify seller balance increases by order subtotal (minus platform fee if configured)
   - Check transaction records

2. **Test Appointment Completion:**
   - Create and pay for an appointment
   - Mark appointment as COMPLETED
   - Verify doctor balance increases by payment amount (minus platform fee if configured)
   - Check transaction records

3. **Test Refunds:**
   - Refund a completed appointment
   - Verify doctor balance decreases by the credited amount
   - Refund a paid order
   - Verify seller balance decreases by the credited amount

4. **Test Platform Fees:**
   - Set `PLATFORM_FEE_PERCENT=10`
   - Process payments and verify correct fee calculation
   - Verify doctor/seller receives net amount

5. **Test Double Crediting Prevention:**
   - Complete an appointment twice (should not credit twice)
   - Verify only one credit transaction exists

## Migration Notes

### For Existing Data

If you have existing paid appointments/orders that were processed before this implementation:

1. **Option 1: Manual Backfill Script**
   - Create a script to credit balances for historical completed appointments and paid orders
   - Run once to backfill existing data

2. **Option 2: Let It Be**
   - Only new payments will credit balances
   - Existing data remains as-is

### Recommended: Create Backfill Script

A backfill script should:
1. Find all completed appointments with payment status 'PAID'
2. Find all paid orders
3. Check if balance was already credited (via transaction metadata)
4. Credit balance for those that weren't credited yet
5. Create appropriate transaction records

## Future Enhancements

1. **Retry Mechanism**: Add retry logic for failed balance operations
2. **Notifications**: Notify doctors when balance is credited
3. **Balance History**: Add detailed balance history page
4. **Pending Balance**: Implement "pending" balance for appointments (credit on completion)
5. **Shipping Handling**: Decide if shipping fees should go to seller or admin
6. **Partial Refunds**: Support partial refunds with proportional balance deduction

## Files Modified

1. `myDoctor/src/services/balance.service.js`
   - Added `creditBalance()`, `debitBalance()`, `calculateNetAmount()`

2. `myDoctor/src/services/payment.service.js`
   - Updated `processOrderPayment()` to credit seller balance
   - Updated `refundTransaction()` to deduct balance on refunds

3. `myDoctor/src/services/appointment.service.js`
   - Updated `updateAppointmentStatus()` to credit doctor balance on completion
