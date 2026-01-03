# Request Deduplication System - Architecture Guide

## Overview

This document explains the request deduplication system implemented to resolve Issue #701 where consecutive rapid clicks triggered multiple API requests.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Vue Component (UI Layer)                 │
│  - OrderDetail.vue, Orders.vue, ShipToStoreOrders.vue       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
        ┌────────────────────────────────┐
        │ Action Loading State Manager   │
        │ (UI State Management)          │
        │ - Prevents duplicate button    │
        │   clicks at UI level           │
        │ - Provides user feedback       │
        └────────────────┬───────────────┘
                         │
                         ↓
        ┌────────────────────────────────┐
        │  Request Deduplicator          │
        │  (Service Level)               │
        │  - Tracks pending requests     │
        │  - Returns existing promise    │
        │  - Prevents API duplicates     │
        └────────────────┬───────────────┘
                         │
                         ↓
        ┌────────────────────────────────┐
        │     OrderService API Methods   │
        │  - shipOrder()                 │
        │  - rejectOrderItems()          │
        │  - cancelOrder()               │
        │  - handoverShipToStoreOrder()  │
        │  - sendPickupScheduledNotif()  │
        └────────────────┬───────────────┘
                         │
                         ↓
        ┌────────────────────────────────┐
        │      Backend API Calls         │
        │  /poorti/shipments/ship        │
        │  /poorti/rejectOrderItems      │
        │  /oms/orders/items/cancel      │
        └────────────────────────────────┘
```

## Two-Layer Protection

### Layer 1: Action Loading State Manager (UI Level)
**Purpose**: Prevent users from clicking buttons multiple times by tracking loading states

**Location**: `src/utils/actionLoadingState.ts`

**Key Features**:
- Tracks which actions are currently loading
- Throws error if action already in progress
- Provides `executeWithLoading()` wrapper that automatically manages state

**Usage Pattern**:
```typescript
async myAction() {
  const actionKey = `UNIQUE_KEY_FOR_ACTION_${resourceId}`;
  
  if (actionLoadingStateManager.isLoading(actionKey)) {
    return;  // Silently ignore duplicate click
  }

  try {
    await actionLoadingStateManager.executeWithLoading(actionKey, async () => {
      // Your async action here
      await apiCall();
    });
  } catch (err) {
    // Handle errors
  }
}
```

### Layer 2: Request Deduplicator (Service Level)
**Purpose**: Ensure only one API request is made even if multiple calls reach the service layer

**Location**: `src/utils/requestDeduplicator.ts`

**Key Features**:
- Tracks pending API requests by key
- Returns existing promise if request already pending
- Clears tracking when request completes
- Supports both immediate deduplication and time-window debouncing

**Usage Pattern**:
```typescript
const shipOrder = async (payload: any): Promise<any> => {
  const key = `SHIP_ORDER_${payload.shipmentId}`;
  return requestDeduplicator.executeOnce(key, () =>
    api({
      url: `/poorti/shipments/${payload.shipmentId}/ship`,
      method: "POST",
      data: payload
    })
  );
}
```

## How It Works: Step-by-Step Example

### Scenario: User rapid-clicks "Handover" button 3 times

```
Time  Action                              Result
────────────────────────────────────────────────────────
t1    User clicks "Handover" button

      actionLoadingStateManager checks:
      - Key: "DELIVER_SHIPMENT_SHP123"
      - isLoading? NO
      - ✓ Proceed

      Start loading: setLoading("DELIVER_SHIPMENT_SHP123", true)
      
      Call OrderService.shipOrder({ shipmentId: "SHP123" })

      requestDeduplicator checks:
      - Key: "SHIP_ORDER_SHP123"
      - isPending? NO
      - ✓ Make API request
      - Store promise in pending map

      API request sent to backend

────────────────────────────────────────────────────────
t2    User clicks "Handover" button again

      actionLoadingStateManager checks:
      - Key: "DELIVER_SHIPMENT_SHP123"
      - isLoading? YES ✗ BLOCKED
      - Return early (no further processing)

      Button remains disabled, no API call attempted

────────────────────────────────────────────────────────
t3    User clicks "Handover" button again

      Same as t2 - action already loading, blocked

────────────────────────────────────────────────────────
t4    Backend API completes (success or error)

      requestDeduplicator:
      - Removes key from pending map
      - Promise resolves
      
      actionLoadingStateManager:
      - setLoading("DELIVER_SHIPMENT_SHP123", false)
      - Button becomes clickable again

Result: Only ONE API request made despite 3 clicks ✓
```

## Integration Points

### Adding Protection to a New Action

1. **In the Vue Component**:
```typescript
import { actionLoadingStateManager } from '@/utils'

async myNewAction(resource: any) {
  const actionKey = `MY_ACTION_${resource.id}`;
  
  if (actionLoadingStateManager.isLoading(actionKey)) {
    return;
  }

  try {
    await actionLoadingStateManager.executeWithLoading(actionKey, async () => {
      const resp = await MyService.myNewMethod(resource);
      // Handle response
    });
  } catch (err) {
    // Handle error
  }
}
```

2. **In the Service**:
```typescript
import { requestDeduplicator } from '@/utils';

const myNewMethod = async (payload: any): Promise<any> => {
  const key = `MY_METHOD_${payload.resourceId}`;
  return requestDeduplicator.executeOnce(key, () =>
    api({
      url: '/api/myendpoint',
      method: 'POST',
      data: payload
    })
  );
}
```

## Key Design Decisions

### 1. Why Two Layers?
- **UI Layer** (Action Loading State Manager): Provides immediate feedback and prevents users from seeing loading states change
- **Service Layer** (Request Deduplicator): Provides safety net in case UI protection is bypassed (direct service calls, etc.)

### 2. Why Key-Based Tracking?
- Different resources (shipments, orders) can be processed independently
- Prevents one resource from blocking operations on another
- Example: Can't process SHP123 twice, but CAN process SHP123 and SHP456 concurrently

### 3. Why Return Existing Promise?
- Ensures both clicks receive the same result
- No "race condition" where one succeeds and one fails
- User sees consistent behavior regardless of timing

### 4. Why Silently Ignore Duplicate Clicks?
- Better UX than showing error messages
- Users understand that nothing happened on duplicate click
- Loading state indicates action is in progress

## Testing Checklist

When adding protection to a new action, verify:

- [ ] Single click works normally
- [ ] Double-click only makes one API call
- [ ] Rapid multiple clicks still work correctly
- [ ] Loading state is shown during operation
- [ ] Button becomes clickable after operation completes
- [ ] Different resources are processed independently
- [ ] Error handling works correctly
- [ ] No console errors or warnings

## Common Pitfalls to Avoid

1. **Don't forget to import the managers**:
```typescript
// ✗ Wrong
import actionLoadingStateManager from '@/utils';

// ✓ Correct
import { actionLoadingStateManager } from '@/utils';
```

2. **Don't use generic keys**:
```typescript
// ✗ Wrong - will block ALL handovers
const key = "HANDOVER";

// ✓ Correct - unique per shipment
const key = `HANDOVER_${order.shipmentId}`;
```

3. **Don't forget the try-catch**:
```typescript
// ✗ Wrong - will crash on duplicate click error
await actionLoadingStateManager.executeWithLoading(key, async () => {
  // action
});

// ✓ Correct
try {
  await actionLoadingStateManager.executeWithLoading(key, async () => {
    // action
  });
} catch (err) {
  if (!err.message.includes('already in progress')) {
    logger.error(err);
  }
}
```

## Performance Considerations

- **Memory**: Keys are automatically cleared after request completion (no memory leaks)
- **Speed**: O(1) lookup time for pending requests (using Map)
- **Network**: Reduces unnecessary API calls, saving bandwidth
- **Server**: Prevents duplicate database transactions

## Future Enhancements

1. Add metrics/analytics to track duplicate click attempts
2. Implement configurable timeout strategies per action type
3. Add visual indicators to clearly show loading state
4. Create automatic retry logic for failed requests
5. Add request prioritization for time-sensitive operations
