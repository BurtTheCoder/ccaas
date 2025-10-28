# SSE Streaming Testing Guide

This guide provides step-by-step procedures for testing the Server-Sent Events (SSE) streaming implementation.

## Prerequisites

1. Start the development server:
```bash
pnpm dev
```

2. Ensure you have:
   - A project configured with workflow
   - Valid authentication/session

## Test Cases

### Test 1: Basic SSE Connection

**Objective:** Verify SSE endpoint establishes connection and sends initial state.

**Steps:**
1. Open terminal and run:
```bash
curl -N http://localhost:3000/api/workflows/wf_test123/stream
```

**Expected Result:**
```
: Connected to workflow wf_test123
event: workflow:state
data: {"workflowId":"wf_test123","name":"Test Workflow",...}

event: log:created
data: {"level":"info","message":"Workflow started",...}

: heartbeat 1
```

**Pass Criteria:**
- Connection established (no errors)
- Initial comment received
- `workflow:state` event received
- Heartbeat comments appear every 15 seconds

---

### Test 2: Real-Time Workflow Execution

**Objective:** Verify events are emitted in real-time during workflow execution.

**Steps:**
1. Start a workflow via API or UI
2. Open workflow detail page in browser
3. Open browser DevTools > Network tab
4. Find the SSE connection (EventStream type)
5. Watch events arrive in real-time

**Expected Events Sequence:**
```
workflow:started →
workflow:running →
agent:started →
log:created (multiple) →
agent:progress (throttled) →
agent:completed →
workflow:running (next agent) →
... →
workflow:completed
```

**Pass Criteria:**
- All events received in correct order
- Events appear immediately (< 1 second delay)
- Log events are throttled (max 1/second)
- Workflow state updates reflect in UI instantly

---

### Test 3: Multiple Concurrent Clients

**Objective:** Verify multiple clients can connect to same workflow.

**Steps:**
1. Start a workflow
2. Open workflow detail page in Browser Window 1
3. Copy URL and open in Browser Window 2
4. Open URL in Browser Window 3 (Incognito/Private)
5. Observe all three windows

**Expected Result:**
- All windows show "Live" indicator
- All windows receive same events
- All windows update simultaneously
- Server logs show 3 SSE connections

**Pass Criteria:**
- No connection errors
- Events delivered to all clients
- UI updates in sync across all windows

---

### Test 4: Client Disconnection Handling

**Objective:** Verify server handles client disconnects gracefully.

**Steps:**
1. Open workflow detail page
2. Verify connection is "Live"
3. Close the browser tab
4. Check server logs

**Expected Result:**
```
[SSE] Client disconnected from workflow wf_abc123
```

**Pass Criteria:**
- No server errors on disconnect
- EventEmitter cleaned up if no other clients
- No memory leaks

---

### Test 5: Automatic Reconnection

**Objective:** Verify automatic reconnection on connection drop.

**Steps:**
1. Open workflow detail page during active workflow
2. Open DevTools > Network tab
3. Enable "Offline" mode
4. Wait 5 seconds
5. Disable "Offline" mode
6. Observe connection status

**Expected Result:**
- Connection indicator changes from "Live" to "Connecting..."
- After network restored, shows "Connecting..." for 1-2 seconds
- Then shows "Live" again
- Events resume streaming

**Pass Criteria:**
- Automatic reconnection occurs
- Exponential backoff visible (1s, 2s, 4s, 8s, 16s)
- Max 5 attempts before showing error
- Reconnect button appears on failure

---

### Test 6: Fallback to Polling

**Objective:** Verify fallback to tRPC polling if SSE fails.

**Steps:**
1. Stop the server
2. Open workflow detail page
3. Restart server
4. Observe behavior

**Expected Result:**
- Page loads with polling (no SSE connection)
- Data still updates via tRPC queries
- No "Live" indicator shown
- Polling interval: 2 seconds for running workflows

**Pass Criteria:**
- Page functional without SSE
- Data eventually consistent
- No errors in console

---

### Test 7: Heartbeat Keep-Alive

**Objective:** Verify heartbeat prevents connection timeout.

**Steps:**
1. Start a long-running workflow (10+ minutes)
2. Open workflow detail page
3. Open DevTools > Network tab
4. Find SSE connection
5. Watch for heartbeat comments

**Expected Result:**
```
: heartbeat 1
: heartbeat 2
: heartbeat 3
...
```

**Timing:** Every 15 seconds

**Pass Criteria:**
- Heartbeats appear regularly
- Connection stays alive for entire workflow
- No timeout errors

---

### Test 8: Workflow Completion Auto-Close

**Objective:** Verify stream auto-closes after workflow completes.

**Steps:**
1. Open workflow detail page near end of workflow
2. Wait for workflow to complete
3. Observe SSE connection in DevTools

**Expected Result:**
```
event: workflow:completed
data: {"duration":45000,"totalCost":150}

: Workflow completed, closing stream
[Connection closes after 2 seconds]
```

**Pass Criteria:**
- `workflow:completed` event received
- Stream closes automatically after 2 seconds
- No error in console
- UI shows final state correctly

---

### Test 9: Budget Events

**Objective:** Verify budget warning and exceeded events.

**Steps:**
1. Configure workflow with low budget limit (e.g., $0.50)
2. Start workflow
3. Open workflow detail page
4. Wait for budget to reach 80%

**Expected Events:**
```
event: budget:warning
data: {"currentCost":40,"budgetLimit":50,"percentageUsed":80}

event: budget:exceeded
data: {"currentCost":50,"budgetLimit":50}

event: workflow:failed
data: {"error":"Budget limit exceeded",...}
```

**Expected UI:**
- Toast warning at 80%: "Budget warning: 80% used"
- Toast error at 100%: "Budget limit exceeded!"
- Toast error: "Workflow failed: Budget limit exceeded"

**Pass Criteria:**
- All budget events received
- Toasts appear correctly
- Workflow stops on budget exceeded

---

### Test 10: Agent Execution Events

**Objective:** Verify agent lifecycle events.

**Steps:**
1. Start multi-agent workflow
2. Open workflow detail page
3. Observe Agent Executions section

**Expected Sequence for Each Agent:**
```
event: agent:started
data: {"agentName":"agent-1","stepNumber":1,...}

event: agent:progress
data: {"agentName":"agent-1","message":"Installing dependencies",...}

event: agent:completed
data: {"agentName":"agent-1","duration":15000,"cost":25,...}
```

**Expected UI:**
- Agent appears with "running" status
- Progress messages appear (if shown)
- Agent status changes to "completed"
- Duration and cost appear

**Pass Criteria:**
- All agents tracked correctly
- Status updates in real-time
- Metrics (duration, cost) appear on completion

---

### Test 11: Log Streaming

**Objective:** Verify log events stream in real-time.

**Steps:**
1. Start workflow
2. Open workflow detail page
3. Scroll to Workflow Logs section
4. Watch logs appear

**Expected Result:**
```
event: log:created
data: {"level":"info","message":"[agent-1] Starting execution",...}

event: log:created
data: {"level":"info","message":"[agent-1] Installing dependencies",...}

event: log:created
data: {"level":"error","message":"[agent-1] Error: Module not found",...}
```

**Expected UI:**
- Logs appear immediately as they're created
- Timestamps show current time
- Colors: info=green, warn=yellow, error=red
- Auto-scroll to latest log

**Pass Criteria:**
- Logs appear in real-time (< 1 second delay)
- Proper color coding
- Max 200 logs retained (older ones removed)

---

### Test 12: Error Handling

**Objective:** Verify graceful error handling.

**Steps:**
1. Open workflow detail for non-existent workflow
2. Try to connect to SSE stream

**Expected Result:**
```json
{
  "error": "Workflow not found"
}
```

**Expected UI:**
- No infinite loading
- Error message shown
- No SSE connection established

**Pass Criteria:**
- 404 error returned
- UI handles error gracefully
- No console errors

---

### Test 13: Connection Status Indicator

**Objective:** Verify connection status indicator accuracy.

**Steps:**
1. Open workflow detail page
2. Observe status indicator next to workflow ID

**States to Test:**

**Connected:**
- Icon: Green Wifi
- Text: "Live"

**Connecting:**
- Icon: Orange Wifi-Off
- Text: "Connecting..."

**Error:**
- Button: "Reconnect"
- Icon: Refresh

**Expected Behavior:**
- Accurate reflection of connection state
- Smooth transitions between states
- Reconnect button functional

**Pass Criteria:**
- All states display correctly
- Transitions smooth
- Reconnect works

---

### Test 14: Toast Notifications

**Objective:** Verify toast notifications for important events.

**Steps:**
1. Start workflow
2. Open workflow detail page
3. Wait for events

**Expected Toasts:**

1. **Workflow Completed:**
   - Type: Success (green)
   - Message: "Workflow completed successfully!"

2. **Workflow Failed:**
   - Type: Error (red)
   - Message: "Workflow failed: [error message]"

3. **Budget Warning:**
   - Type: Warning (yellow)
   - Message: "Budget warning: 80% used"

4. **Budget Exceeded:**
   - Type: Error (red)
   - Message: "Budget limit exceeded!"

**Pass Criteria:**
- All toasts appear at correct times
- Correct colors and messages
- Auto-dismiss after 3-5 seconds
- No duplicate toasts

---

### Test 15: Performance - High-Frequency Events

**Objective:** Verify throttling prevents overwhelming client.

**Steps:**
1. Start workflow with verbose logging
2. Open workflow detail page
3. Monitor browser performance

**Expected Behavior:**
- Log events throttled to max 1/second
- No lag in UI updates
- Memory usage stable
- CPU usage reasonable

**Pass Criteria:**
- UI remains responsive
- No memory leaks over 10+ minutes
- Event rate never exceeds 10/second
- Throttling visible in network tab

---

## Automated Testing (Future)

Example test using Vitest:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { workflowEmitter } from '../server/workflowEmitter';

describe('WorkflowEmitter', () => {
  const workflowId = 'test-workflow-123';

  afterEach(() => {
    workflowEmitter.removeEmitter(workflowId);
  });

  it('should emit and receive events', (done) => {
    const testData = { message: 'test' };

    const unsubscribe = workflowEmitter.subscribe(workflowId, (event) => {
      expect(event.type).toBe('workflow:started');
      expect(event.data).toEqual(testData);
      unsubscribe();
      done();
    });

    workflowEmitter.emit(workflowId, 'workflow:started', testData);
  });

  it('should support multiple listeners', () => {
    let count = 0;

    const unsubscribe1 = workflowEmitter.subscribe(workflowId, () => count++);
    const unsubscribe2 = workflowEmitter.subscribe(workflowId, () => count++);

    workflowEmitter.emit(workflowId, 'workflow:started', {});

    expect(count).toBe(2);

    unsubscribe1();
    unsubscribe2();
  });

  it('should cleanup emitter when no listeners', () => {
    const unsubscribe = workflowEmitter.subscribe(workflowId, () => {});
    expect(workflowEmitter.getListenerCount(workflowId)).toBe(1);

    unsubscribe();
    expect(workflowEmitter.getListenerCount(workflowId)).toBe(0);
  });
});
```

## Performance Benchmarks

Expected performance metrics:

| Metric | Target | Notes |
|--------|--------|-------|
| Event latency | < 100ms | Time from emit to client receipt |
| Connection setup | < 500ms | Time to establish SSE connection |
| Memory per client | < 5MB | Per SSE connection |
| Max concurrent clients | 1000+ | Per workflow |
| Event throughput | 100/sec | Per workflow (throttled) |
| Reconnection time | < 2s | After network restore |

## Monitoring in Production

Add these checks to production monitoring:

1. **Connection Count:**
```typescript
// Endpoint: GET /api/admin/sse-stats
{
  activeConnections: workflowEmitter.getActiveWorkflows().length,
  workflows: workflowEmitter.getActiveWorkflows().map(id => ({
    workflowId: id,
    listenerCount: workflowEmitter.getListenerCount(id)
  }))
}
```

2. **Event Rate:**
```typescript
// Track events/second per workflow
// Alert if > 50/second (possible issue)
```

3. **Connection Errors:**
```typescript
// Count connection failures
// Alert if error rate > 5%
```

## Common Issues and Solutions

### Issue: "Connection closed" errors

**Cause:** Proxy/load balancer timeout

**Solution:**
- Reduce heartbeat interval to 10s
- Configure proxy timeout > 60s
- Add `X-Accel-Buffering: no` header (nginx)

### Issue: Events delayed by 2+ seconds

**Cause:** Event buffering

**Solution:**
- Ensure `Cache-Control: no-cache`
- Disable response buffering in proxy
- Check network latency

### Issue: Memory grows over time

**Cause:** EventEmitters not cleaned up

**Solution:**
- Verify unsubscribe called
- Check for listener leaks
- Add cleanup timeout (30 min idle)

### Issue: Client shows "Connecting..." forever

**Cause:** CORS or network issue

**Solution:**
- Check CORS headers
- Verify SSE endpoint accessible
- Check browser console for errors
- Try curl to test endpoint

## Sign-Off Checklist

Before marking SSE implementation complete:

- [ ] All 15 test cases pass
- [ ] No TypeScript errors (`pnpm check`)
- [ ] No console errors in browser
- [ ] Connection indicator works
- [ ] Toast notifications appear
- [ ] Multiple clients supported
- [ ] Automatic reconnection works
- [ ] Fallback to polling works
- [ ] Performance acceptable (no lag)
- [ ] Documentation complete
- [ ] Code reviewed

## Conclusion

This testing guide ensures the SSE streaming implementation is robust, performant, and production-ready. All test cases should pass before deploying to production.

For questions or issues, refer to `SSE_STREAMING.md` for architecture details.
