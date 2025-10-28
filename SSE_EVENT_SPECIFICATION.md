# SSE Event Format Specification

This document provides a comprehensive reference for all Server-Sent Events (SSE) emitted by the workflow streaming system.

## Event Format

All events follow the standard SSE format:

```
event: <event-type>
data: <json-payload>
id: <timestamp-in-milliseconds>
retry: 5000

```

## Event Types

### 1. workflow:state

**Description:** Initial workflow state sent when client connects.

**Timing:** Immediately on connection

**Payload:**
```typescript
{
  workflowId: string;
  name: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentAgent?: string;
  currentStep?: number;
  totalSteps?: number;
  iterations?: number;
  totalCost?: number;       // in cents
  duration?: number;        // in milliseconds
  startedAt?: string;       // ISO 8601
  completedAt?: string;     // ISO 8601
  error?: string;
}
```

**Example:**
```
event: workflow:state
data: {"workflowId":"wf_abc123","name":"CI/CD Pipeline","status":"running","currentAgent":"build-agent","currentStep":2,"totalSteps":5,"iterations":1,"totalCost":125,"startedAt":"2025-10-27T10:30:00.000Z"}
id: 1730025000000

```

---

### 2. workflow:started

**Description:** Workflow execution has begun.

**Timing:** After workflow record created, before first agent

**Payload:**
```typescript
{
  name: string;
  totalSteps: number;
  maxIterations?: number;
  budgetLimit?: number;     // in cents
}
```

**Example:**
```
event: workflow:started
data: {"name":"Deploy to Production","totalSteps":3,"maxIterations":10,"budgetLimit":500}
id: 1730025001000

```

---

### 3. workflow:running

**Description:** Workflow state update (agent change, step change, cost update).

**Timing:** Multiple times during execution (on each state change)

**Payload:**
```typescript
{
  currentAgent?: string;
  currentStep?: number;
  iterations?: number;
  totalCost?: number;       // in cents
}
```

**Example:**
```
event: workflow:running
data: {"currentAgent":"test-agent","currentStep":3,"iterations":2,"totalCost":275}
id: 1730025045000

```

---

### 4. workflow:completed

**Description:** Workflow finished successfully.

**Timing:** After all agents complete successfully

**Payload:**
```typescript
{
  duration: number;         // milliseconds
  totalCost: number;        // in cents
  iterations: number;
  currentStep?: number;
}
```

**Example:**
```
event: workflow:completed
data: {"duration":125000,"totalCost":450,"iterations":3,"currentStep":5}
id: 1730025125000

```

---

### 5. workflow:failed

**Description:** Workflow failed with error.

**Timing:** When workflow encounters unrecoverable error

**Payload:**
```typescript
{
  error: string;
  duration: number;         // milliseconds
  totalCost: number;        // in cents
  currentAgent?: string;
  currentStep?: number;
}
```

**Example:**
```
event: workflow:failed
data: {"error":"Agent build-agent failed: Compilation error","duration":45000,"totalCost":150,"currentAgent":"build-agent","currentStep":2}
id: 1730025045000

```

---

### 6. agent:state

**Description:** Initial agent execution state (sent on connection for existing agents).

**Timing:** On client connection, for each agent already executed/running

**Payload:**
```typescript
{
  agentName: string;
  agentRole: string;
  stepNumber: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;        // milliseconds
  cost?: number;           // in cents
  startedAt?: string;      // ISO 8601
  completedAt?: string;    // ISO 8601
}
```

**Example:**
```
event: agent:state
data: {"agentName":"build-agent","agentRole":"builder","stepNumber":1,"status":"completed","duration":15000,"cost":50,"startedAt":"2025-10-27T10:30:00.000Z","completedAt":"2025-10-27T10:30:15.000Z"}
id: 1730025000000

```

---

### 7. agent:started

**Description:** Agent execution has started.

**Timing:** When agent begins execution in container

**Payload:**
```typescript
{
  agentName: string;
  agentRole: string;
  stepNumber: number;
  prompt: string;
}
```

**Example:**
```
event: agent:started
data: {"agentName":"deploy-agent","agentRole":"deployer","stepNumber":3,"prompt":"Deploy the application to production"}
id: 1730025050000

```

---

### 8. agent:progress

**Description:** Agent progress update (throttled to 1/second).

**Timing:** During agent execution (logs, status updates)

**Payload:**
```typescript
{
  agentName: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}
```

**Example:**
```
event: agent:progress
data: {"agentName":"build-agent","message":"Installing dependencies...","level":"info"}
id: 1730025055000

```

**Note:** This event is throttled to prevent overwhelming clients. Maximum rate: 1 event per second per agent.

---

### 9. agent:completed

**Description:** Agent finished successfully.

**Timing:** When agent execution completes with exit code 0

**Payload:**
```typescript
{
  agentName: string;
  stepNumber: number;
  duration: number;        // milliseconds
  cost: number;           // in cents
  output?: string;
}
```

**Example:**
```
event: agent:completed
data: {"agentName":"build-agent","stepNumber":1,"duration":15000,"cost":50,"output":"Build successful"}
id: 1730025065000

```

---

### 10. agent:failed

**Description:** Agent execution failed.

**Timing:** When agent execution fails (non-zero exit code or exception)

**Payload:**
```typescript
{
  agentName: string;
  stepNumber: number;
  error: string;
}
```

**Example:**
```
event: agent:failed
data: {"agentName":"test-agent","stepNumber":2,"error":"Test suite failed: 3 tests failed"}
id: 1730025080000

```

---

### 11. budget:warning

**Description:** Budget usage has reached warning threshold (80%).

**Timing:** When workflow cost reaches 80% of budget limit

**Payload:**
```typescript
{
  currentCost: number;      // in cents
  budgetLimit: number;      // in cents
  percentageUsed: number;   // 0-100
}
```

**Example:**
```
event: budget:warning
data: {"currentCost":400,"budgetLimit":500,"percentageUsed":80}
id: 1730025090000

```

**UI Action:** Show warning toast: "Budget warning: 80% used"

---

### 12. budget:exceeded

**Description:** Budget limit has been exceeded.

**Timing:** When workflow cost reaches or exceeds budget limit

**Payload:**
```typescript
{
  currentCost: number;      // in cents
  budgetLimit: number;      // in cents
}
```

**Example:**
```
event: budget:exceeded
data: {"currentCost":500,"budgetLimit":500}
id: 1730025095000

```

**UI Action:** Show error toast: "Budget limit exceeded!"

**Note:** Workflow will fail after this event.

---

### 13. log:created

**Description:** New log entry created.

**Timing:** When workflow or agent creates a log entry

**Payload:**
```typescript
{
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;       // ISO 8601
  metadata?: any;
}
```

**Example:**
```
event: log:created
data: {"level":"info","message":"[build-agent] Running npm install","timestamp":"2025-10-27T10:30:05.000Z"}
id: 1730025005000

```

**Note:** Initial connection sends last 50 logs, then streams new ones in real-time.

---

## Special Messages

### Heartbeat Comment

**Description:** Keep-alive comment to prevent connection timeout.

**Format:**
```
: heartbeat 1
: heartbeat 2
: heartbeat 3
```

**Timing:** Every 15 seconds

**Purpose:**
- Prevent proxy/load balancer timeouts
- Detect dead connections
- Confirm stream is alive

---

### Connection Comment

**Description:** Initial connection confirmation.

**Format:**
```
: Connected to workflow wf_abc123
```

**Timing:** Immediately on connection

**Purpose:** Confirm connection established successfully

---

### Closing Comment

**Description:** Stream closing notification.

**Format:**
```
: Workflow completed, closing stream
```

**Timing:** 2 seconds after workflow completion/failure

**Purpose:** Inform client stream will close

---

## Event Lifecycle Examples

### Successful Workflow

```
: Connected to workflow wf_abc123

event: workflow:state
data: {"workflowId":"wf_abc123","status":"pending",...}

event: workflow:started
data: {"name":"CI Pipeline","totalSteps":3}

event: workflow:running
data: {"currentAgent":"build","currentStep":1}

event: agent:started
data: {"agentName":"build","stepNumber":1}

event: log:created
data: {"message":"[build] Starting build"}

event: agent:progress
data: {"agentName":"build","message":"Installing dependencies"}

: heartbeat 1

event: log:created
data: {"message":"[build] Build successful"}

event: agent:completed
data: {"agentName":"build","duration":15000,"cost":50}

event: workflow:running
data: {"currentAgent":"test","currentStep":2}

event: agent:started
data: {"agentName":"test","stepNumber":2}

event: agent:completed
data: {"agentName":"test","duration":10000,"cost":35}

event: workflow:running
data: {"currentAgent":"deploy","currentStep":3}

event: agent:started
data: {"agentName":"deploy","stepNumber":3}

: heartbeat 2

event: agent:completed
data: {"agentName":"deploy","duration":20000,"cost":75}

event: workflow:completed
data: {"duration":45000,"totalCost":160,"iterations":1}

: Workflow completed, closing stream
[Connection closes]
```

---

### Failed Workflow

```
: Connected to workflow wf_abc123

event: workflow:state
data: {"workflowId":"wf_abc123","status":"running",...}

event: workflow:running
data: {"currentAgent":"build","currentStep":1}

event: agent:started
data: {"agentName":"build","stepNumber":1}

event: log:created
data: {"message":"[build] Starting build"}

event: agent:progress
data: {"agentName":"build","message":"Running tests"}

event: log:created
data: {"level":"error","message":"[build] Test suite failed"}

event: agent:failed
data: {"agentName":"build","stepNumber":1,"error":"Test suite failed"}

event: workflow:failed
data: {"error":"Agent build failed: Test suite failed","duration":8000,"totalCost":25}

: Workflow completed, closing stream
[Connection closes]
```

---

### Budget Exceeded

```
: Connected to workflow wf_abc123

event: workflow:started
data: {"name":"Analysis","budgetLimit":100}

event: agent:started
data: {"agentName":"analyzer","stepNumber":1}

: heartbeat 1

event: budget:warning
data: {"currentCost":80,"budgetLimit":100,"percentageUsed":80}

event: agent:completed
data: {"agentName":"analyzer","cost":90}

event: agent:started
data: {"agentName":"reporter","stepNumber":2}

event: budget:exceeded
data: {"currentCost":100,"budgetLimit":100}

event: workflow:failed
data: {"error":"Budget limit exceeded: $1.00 >= $1.00"}

: Workflow completed, closing stream
[Connection closes]
```

---

## Client Implementation Example

### JavaScript/TypeScript

```typescript
const eventSource = new EventSource('/api/workflows/wf_abc123/stream');

// Listen to specific event types
eventSource.addEventListener('workflow:started', (event) => {
  const data = JSON.parse(event.data);
  console.log('Workflow started:', data.name);
});

eventSource.addEventListener('agent:completed', (event) => {
  const data = JSON.parse(event.data);
  console.log(`Agent ${data.agentName} completed in ${data.duration}ms`);
});

eventSource.addEventListener('workflow:completed', (event) => {
  const data = JSON.parse(event.data);
  console.log('Workflow completed!', data);
  eventSource.close();
});

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  eventSource.close();
};
```

### curl

```bash
curl -N http://localhost:3000/api/workflows/wf_abc123/stream
```

### Python

```python
import sseclient
import requests

url = 'http://localhost:3000/api/workflows/wf_abc123/stream'
response = requests.get(url, stream=True)
client = sseclient.SSEClient(response)

for event in client.events():
    print(f"Event: {event.event}")
    print(f"Data: {event.data}")
    print(f"ID: {event.id}")
    print("---")
```

---

## Event Frequency Guidelines

| Event Type | Typical Frequency | Max Rate |
|------------|------------------|----------|
| workflow:started | Once | 1 total |
| workflow:running | Per agent change | ~10/workflow |
| workflow:completed | Once | 1 total |
| agent:started | Per agent | ~10/workflow |
| agent:progress | Continuous | 1/second (throttled) |
| agent:completed | Per agent | ~10/workflow |
| log:created | Continuous | Unlimited |
| budget:warning | Once at 80% | 1 total |
| budget:exceeded | Once at 100% | 1 total |

---

## Error Responses

### Workflow Not Found

```json
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "error": "Workflow not found"
}
```

### Unauthorized

```json
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "Unauthorized"
}
```

---

## Best Practices

### Client-Side

1. **Always parse JSON safely:**
```typescript
try {
  const data = JSON.parse(event.data);
} catch (error) {
  console.error('Failed to parse event data:', error);
}
```

2. **Handle reconnection:**
```typescript
eventSource.onerror = (error) => {
  console.error('Connection error, reconnecting...');
  setTimeout(() => {
    connectSSE(); // Retry connection
  }, 5000);
};
```

3. **Close on unmount:**
```typescript
useEffect(() => {
  const es = new EventSource(url);
  return () => es.close();
}, []);
```

### Server-Side

1. **Always emit workflow:started first**
2. **Emit workflow:running on state changes**
3. **Throttle high-frequency events**
4. **Clean up listeners on workflow completion**

---

## Version History

- **v1.0** (2025-10-27) - Initial implementation
  - 13 event types
  - Heartbeat support
  - Budget events
  - Throttled progress events

---

## Related Documentation

- [SSE Streaming Architecture](./SSE_STREAMING.md)
- [Testing Guide](./SSE_TESTING_GUIDE.md)
