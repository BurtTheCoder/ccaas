/**
 * Email templates for workflow and execution notifications
 * All templates use HTML for rich formatting with fallback text
 */

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format cost in cents to dollar string
 */
function formatCost(costCents: number): string {
  const dollars = costCents / 100;
  return `$${dollars.toFixed(2)}`;
}

/**
 * Base email template wrapper
 */
function wrapTemplate(title: string, content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      border-bottom: 3px solid #4a90e2;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    h1 {
      color: #2c3e50;
      margin: 0 0 10px 0;
      font-size: 24px;
    }
    h2 {
      color: #34495e;
      font-size: 18px;
      margin-top: 25px;
      margin-bottom: 15px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-success {
      background-color: #d4edda;
      color: #155724;
    }
    .badge-danger {
      background-color: #f8d7da;
      color: #721c24;
    }
    .badge-warning {
      background-color: #fff3cd;
      color: #856404;
    }
    .badge-info {
      background-color: #d1ecf1;
      color: #0c5460;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin: 20px 0;
    }
    .info-item {
      padding: 12px;
      background-color: #f8f9fa;
      border-radius: 6px;
      border-left: 3px solid #4a90e2;
    }
    .info-label {
      font-size: 12px;
      color: #6c757d;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 16px;
      color: #2c3e50;
      font-weight: 500;
    }
    .code-block {
      background-color: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 4px;
      padding: 12px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      overflow-x: auto;
      margin: 15px 0;
    }
    .error-block {
      background-color: #fff5f5;
      border: 1px solid #feb2b2;
      border-radius: 4px;
      padding: 15px;
      margin: 15px 0;
      color: #c53030;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e9ecef;
      font-size: 12px;
      color: #6c757d;
      text-align: center;
    }
    .button {
      display: inline-block;
      padding: 10px 20px;
      background-color: #4a90e2;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 500;
      margin: 15px 0;
    }
    .button:hover {
      background-color: #357abd;
    }
  </style>
</head>
<body>
  <div class="container">
    ${content}
    <div class="footer">
      <p>This is an automated notification from Claude Code Service.</p>
      <p>To manage your notification preferences, visit your account settings.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Workflow started email template
 */
export function workflowStartedTemplate(workflow: {
  workflowId: string;
  name: string;
  description?: string;
  totalSteps?: number;
  budgetLimit?: number;
}): string {
  const content = `
    <div class="header">
      <h1>🚀 Workflow Started</h1>
      <span class="badge badge-info">Running</span>
    </div>

    <h2>${workflow.name}</h2>
    ${workflow.description ? `<p>${workflow.description}</p>` : ''}

    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Workflow ID</div>
        <div class="info-value">${workflow.workflowId}</div>
      </div>
      ${workflow.totalSteps ? `
      <div class="info-item">
        <div class="info-label">Total Steps</div>
        <div class="info-value">${workflow.totalSteps}</div>
      </div>
      ` : ''}
      ${workflow.budgetLimit ? `
      <div class="info-item">
        <div class="info-label">Budget Limit</div>
        <div class="info-value">${formatCost(workflow.budgetLimit)}</div>
      </div>
      ` : ''}
    </div>

    <p>Your workflow has been started and is now running. You will receive another notification when it completes.</p>
  `;

  return wrapTemplate('Workflow Started', content);
}

/**
 * Workflow completed email template
 */
export function workflowCompletedTemplate(workflow: {
  workflowId: string;
  name: string;
  duration?: number;
  totalCost?: number;
  iterations?: number;
  currentStep?: number;
  result?: string;
}): string {
  const content = `
    <div class="header">
      <h1>✅ Workflow Completed</h1>
      <span class="badge badge-success">Success</span>
    </div>

    <h2>${workflow.name}</h2>

    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Workflow ID</div>
        <div class="info-value">${workflow.workflowId}</div>
      </div>
      ${workflow.duration ? `
      <div class="info-item">
        <div class="info-label">Duration</div>
        <div class="info-value">${formatDuration(workflow.duration)}</div>
      </div>
      ` : ''}
      ${workflow.totalCost !== undefined ? `
      <div class="info-item">
        <div class="info-label">Total Cost</div>
        <div class="info-value">${formatCost(workflow.totalCost)}</div>
      </div>
      ` : ''}
      ${workflow.iterations ? `
      <div class="info-item">
        <div class="info-label">Iterations</div>
        <div class="info-value">${workflow.iterations}</div>
      </div>
      ` : ''}
      ${workflow.currentStep ? `
      <div class="info-item">
        <div class="info-label">Steps Completed</div>
        <div class="info-value">${workflow.currentStep}</div>
      </div>
      ` : ''}
    </div>

    ${workflow.result ? `
    <h2>Result</h2>
    <div class="code-block">${workflow.result.substring(0, 500)}${workflow.result.length > 500 ? '...' : ''}</div>
    ` : ''}

    <p>🎉 All agents completed successfully! Your workflow has finished execution.</p>
  `;

  return wrapTemplate('Workflow Completed', content);
}

/**
 * Workflow failed email template
 */
export function workflowFailedTemplate(workflow: {
  workflowId: string;
  name: string;
  error?: string;
  duration?: number;
  totalCost?: number;
  currentAgent?: string;
  currentStep?: number;
}): string {
  const content = `
    <div class="header">
      <h1>❌ Workflow Failed</h1>
      <span class="badge badge-danger">Failed</span>
    </div>

    <h2>${workflow.name}</h2>

    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Workflow ID</div>
        <div class="info-value">${workflow.workflowId}</div>
      </div>
      ${workflow.currentAgent ? `
      <div class="info-item">
        <div class="info-label">Failed At</div>
        <div class="info-value">${workflow.currentAgent}</div>
      </div>
      ` : ''}
      ${workflow.currentStep ? `
      <div class="info-item">
        <div class="info-label">Step</div>
        <div class="info-value">${workflow.currentStep}</div>
      </div>
      ` : ''}
      ${workflow.duration ? `
      <div class="info-item">
        <div class="info-label">Duration</div>
        <div class="info-value">${formatDuration(workflow.duration)}</div>
      </div>
      ` : ''}
      ${workflow.totalCost !== undefined ? `
      <div class="info-item">
        <div class="info-label">Cost</div>
        <div class="info-value">${formatCost(workflow.totalCost)}</div>
      </div>
      ` : ''}
    </div>

    ${workflow.error ? `
    <h2>Error Details</h2>
    <div class="error-block">${workflow.error}</div>
    ` : ''}

    <p>Your workflow encountered an error and could not complete. Please review the error details above and check your workflow configuration.</p>
  `;

  return wrapTemplate('Workflow Failed', content);
}

/**
 * Budget warning email template (80% threshold)
 */
export function budgetWarningTemplate(data: {
  projectName?: string;
  currentCost: number;
  budgetLimit: number;
  percentUsed: number;
  workflowId?: string;
  workflowName?: string;
}): string {
  const content = `
    <div class="header">
      <h1>⚠️ Budget Warning</h1>
      <span class="badge badge-warning">Warning</span>
    </div>

    <h2>Budget Alert - ${data.percentUsed.toFixed(0)}% Used</h2>

    <p>You have used <strong>${formatCost(data.currentCost)}</strong> of your <strong>${formatCost(data.budgetLimit)}</strong> ${data.projectName ? `${data.projectName} ` : ''}budget.</p>

    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Current Spend</div>
        <div class="info-value">${formatCost(data.currentCost)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Budget Limit</div>
        <div class="info-value">${formatCost(data.budgetLimit)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Remaining</div>
        <div class="info-value">${formatCost(data.budgetLimit - data.currentCost)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Percentage Used</div>
        <div class="info-value">${data.percentUsed.toFixed(1)}%</div>
      </div>
    </div>

    ${data.workflowId && data.workflowName ? `
    <h2>Triggered By</h2>
    <p><strong>${data.workflowName}</strong> (${data.workflowId})</p>
    ` : ''}

    <p>This is a warning notification. Your workflow will continue running, but will be stopped if the budget limit is exceeded.</p>
  `;

  return wrapTemplate('Budget Warning', content);
}

/**
 * Budget exceeded email template
 */
export function budgetExceededTemplate(data: {
  projectName?: string;
  currentCost: number;
  budgetLimit: number;
  workflowId: string;
  workflowName: string;
}): string {
  const content = `
    <div class="header">
      <h1>🚨 Budget Exceeded</h1>
      <span class="badge badge-danger">Critical</span>
    </div>

    <h2>Budget Limit Exceeded - Workflow Stopped</h2>

    <p>Your ${data.projectName ? `${data.projectName} ` : ''}budget limit of <strong>${formatCost(data.budgetLimit)}</strong> has been exceeded. Current spend: <strong>${formatCost(data.currentCost)}</strong>.</p>

    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Current Spend</div>
        <div class="info-value">${formatCost(data.currentCost)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Budget Limit</div>
        <div class="info-value">${formatCost(data.budgetLimit)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Over Budget</div>
        <div class="info-value">${formatCost(data.currentCost - data.budgetLimit)}</div>
      </div>
    </div>

    <h2>Stopped Workflow</h2>
    <p><strong>${data.workflowName}</strong> (${data.workflowId})</p>

    <p>⚠️ The workflow has been stopped to prevent further charges. Please review your budget settings or increase your limit to continue.</p>
  `;

  return wrapTemplate('Budget Exceeded', content);
}

/**
 * Execution completed email template
 */
export function executionCompletedTemplate(execution: {
  executionId: string;
  projectName?: string;
  prompt: string;
  duration?: number;
  cost?: number;
  result?: string;
}): string {
  const promptPreview = execution.prompt.length > 200
    ? execution.prompt.substring(0, 200) + '...'
    : execution.prompt;

  const content = `
    <div class="header">
      <h1>✅ Execution Completed</h1>
      <span class="badge badge-success">Success</span>
    </div>

    ${execution.projectName ? `<h2>${execution.projectName}</h2>` : ''}

    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Execution ID</div>
        <div class="info-value">${execution.executionId}</div>
      </div>
      ${execution.duration ? `
      <div class="info-item">
        <div class="info-label">Duration</div>
        <div class="info-value">${formatDuration(execution.duration)}</div>
      </div>
      ` : ''}
      ${execution.cost !== undefined ? `
      <div class="info-item">
        <div class="info-label">Cost</div>
        <div class="info-value">${formatCost(execution.cost)}</div>
      </div>
      ` : ''}
    </div>

    <h2>Prompt</h2>
    <div class="code-block">${promptPreview}</div>

    ${execution.result ? `
    <h2>Result</h2>
    <div class="code-block">${execution.result.substring(0, 500)}${execution.result.length > 500 ? '...' : ''}</div>
    ` : ''}

    <p>Your execution has completed successfully!</p>
  `;

  return wrapTemplate('Execution Completed', content);
}

/**
 * Execution failed email template
 */
export function executionFailedTemplate(execution: {
  executionId: string;
  projectName?: string;
  prompt: string;
  error?: string;
  duration?: number;
  cost?: number;
}): string {
  const promptPreview = execution.prompt.length > 200
    ? execution.prompt.substring(0, 200) + '...'
    : execution.prompt;

  const content = `
    <div class="header">
      <h1>❌ Execution Failed</h1>
      <span class="badge badge-danger">Failed</span>
    </div>

    ${execution.projectName ? `<h2>${execution.projectName}</h2>` : ''}

    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Execution ID</div>
        <div class="info-value">${execution.executionId}</div>
      </div>
      ${execution.duration ? `
      <div class="info-item">
        <div class="info-label">Duration</div>
        <div class="info-value">${formatDuration(execution.duration)}</div>
      </div>
      ` : ''}
      ${execution.cost !== undefined ? `
      <div class="info-item">
        <div class="info-label">Cost</div>
        <div class="info-value">${formatCost(execution.cost)}</div>
      </div>
      ` : ''}
    </div>

    <h2>Prompt</h2>
    <div class="code-block">${promptPreview}</div>

    ${execution.error ? `
    <h2>Error Details</h2>
    <div class="error-block">${execution.error}</div>
    ` : ''}

    <p>Your execution encountered an error and could not complete. Please review the error details above.</p>
  `;

  return wrapTemplate('Execution Failed', content);
}

/**
 * Test email template
 */
export function testEmailTemplate(recipient: string): string {
  const content = `
    <div class="header">
      <h1>📧 Test Email</h1>
      <span class="badge badge-info">Test</span>
    </div>

    <h2>Email Configuration Test</h2>

    <p>This is a test email from Claude Code Service to verify that your email configuration is working correctly.</p>

    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Recipient</div>
        <div class="info-value">${recipient}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Timestamp</div>
        <div class="info-value">${new Date().toISOString()}</div>
      </div>
    </div>

    <p>✅ If you're reading this, your email notifications are configured correctly!</p>
  `;

  return wrapTemplate('Test Email', content);
}
