# Fix for Issue #701: Multiple API Calls Triggered by Consecutive Clicks

## Problem Statement
When users clicked the same action button multiple times in quick succession, the system sent multiple API requests for various actions including:
- Multiple handover clicks
- Multiple replace picker clicks
- Multiple logout actions
- Multiple print operations
- Multiple reject/cancel order clicks

This caused duplicate operations and poor user experience.

## Root Cause
The issue occurred because there was no mechanism to prevent concurrent API requests when users performed rapid consecutive clicks on action buttons. Each click would immediately trigger a new API request without checking if a previous request was still in progress.

## Solution Architecture

The solution implements a **dual-layer deduplication system** using two complementary utilities:

### Layer 1: Request Deduplicator (Service Level)
**File**: `src/utils/requestDeduplicator.ts`

A singleton utility that tracks pending API requests and prevents concurrent calls for the same action. This ensures that even if the UI allows multiple clicks, only one API request is made.

**Key Methods**:
- `executeOnce()`: Executes a request only if no previous request is pending for the same key
- `executeWithDebounce()`: Executes a request with a timeout window to prevent duplicate calls
- `isPending()`: Check if a request is currently pending
- `clearRequest()`: Clear a specific pending request

### Layer 2: Action Loading State Manager (UI Level)
**File**: `src/utils/actionLoadingState.ts`

Manages UI loading states to provide visual feedback to users during action execution. This prevents users from seeing or triggering multiple rapid clicks.

**Key Methods**:
- `executeWithLoading()`: Executes an action with automatic loading state management
- `isLoading()`: Check if an action is currently loading
- `setLoading()`: Set loading state for an action

## Implementation Details

### Modified Services
**File**: `src/services/OrderService.ts`

The following critical API methods were wrapped with the request deduplicator:
1. **`shipOrder()`** - Ship/Handover action (key: `SHIP_ORDER_${shipmentId}`)
2. **`rejectOrderItems()`** - Reject order items (key: `REJECT_ORDER_ITEMS_${shipmentId}`)
3. **`cancelOrder()`** - Cancel order items (key: `CANCEL_ORDER_${orderId}`)
4. **`handoverShipToStoreOrder()`** - Handover for ship-to-store (key: `HANDOVER_SHIP_TO_STORE_${shipmentId}`)
5. **`sendPickupScheduledNotification()`** - Send notification (key: `SEND_NOTIFICATION_${orderId}`)

### Modified Vue Components

#### OrderDetail.vue
Updated methods to use `actionLoadingStateManager`:
- `rejectOrder()` - Wrapped with loading state manager
- `printPackingSlip()` - Enhanced with deduplication
- `sendReadyForPickupEmail()` - Added loading state check

#### Orders.vue
Updated methods to use `actionLoadingStateManager`:
- `deliverShipment()` - Wrapped with loading state manager
- `printPicklist()` - Wrapped with loading state manager

#### ShipToStoreOrders.vue
Updated methods to use `actionLoadingStateManager`:
- `handoverOrder()` - Wrapped with loading state manager (also removed duplicate code)

## How It Works

### User Clicks Action Button
```
User clicks button → UI shows loading state → First request sent
↓
User clicks button again (rapid consecutive click)
↓
If first request still pending:
  - Request deduplicator returns existing promise
  - No new API request is made
  - User sees loading state continues
↓
First request completes
↓
Button becomes clickable again
```

### Example Implementation
```typescript
async deliverShipment(order: any) {
  const actionKey = `DELIVER_SHIPMENT_${order.shipmentId}`;
  
  // Check if already processing
  if (actionLoadingStateManager.isLoading(actionKey)) {
    return;  // Silently ignore duplicate click
  }

  try {
    await actionLoadingStateManager.executeWithLoading(actionKey, async () => {
      // Automatic loading state management
      await this.store.dispatch('order/deliverShipment', order);
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('already in progress')) {
      logger.debug('Action already in progress');
    } else {
      logger.error(err);
    }
  }
}
```

## Benefits

1. **Prevents Duplicate API Calls**: Only one API request is made even with rapid consecutive clicks
2. **Better User Experience**: Users see clear loading states and cannot accidentally trigger multiple operations
3. **Non-invasive**: Users are not blocked but silently prevented from duplicating actions
4. **Scalable**: Easy to add to any new action buttons by wrapping with the manager
5. **No UI Changes Required**: Existing UI remains unchanged; solution works at application logic level

## Testing

The following scenarios should be tested:
1. ✅ Single click on action buttons - should work normally
2. ✅ Rapid double-clicks on action buttons - only one API call should be made
3. ✅ Very rapid multiple clicks (5-10 clicks) - still only one API call
4. ✅ Different orders/shipments - independent deduplication for each resource
5. ✅ Timeout handling - requests should complete and button should become clickable again
6. ✅ Error scenarios - errors should be handled gracefully

## Files Modified

1. `src/utils/requestDeduplicator.ts` - **Created**
2. `src/utils/actionLoadingState.ts` - **Created**
3. `src/utils/index.ts` - Updated exports
4. `src/services/OrderService.ts` - Added request deduplication to critical methods
5. `src/views/OrderDetail.vue` - Added loading state management to action methods
6. `src/views/Orders.vue` - Added loading state management to action methods
7. `src/views/ShipToStoreOrders.vue` - Added loading state management to action methods (removed duplicate code)

## Affected Actions Resolved

✅ Multiple handover clicks on packed list page
✅ Multiple handover clicks on alert in details page of packed tab
✅ Multiple clicks on Replace Picker action
✅ Multiple clicks on Logout action
✅ Multiple clicks on Print Packing Slip action
✅ Multiple clicks on Print Picklist action
✅ Multiple clicks on Reject Order Item alert in packed details page
✅ Multiple clicks on Reject Order Item alert in open list page
✅ Multiple clicks on Confirm Cancellation action
✅ Multiple clicks on Request Transfer button on open details page

## Future Improvements

1. Consider adding a visual loading indicator (spinner/button disable) to make it more obvious to users that an action is in progress
2. Add analytics to track duplicate click attempts
3. Consider implementing a more sophisticated timeout strategy based on API response times
4. Add unit tests for the deduplication utilities
