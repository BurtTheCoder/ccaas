import { SlackBlock } from './slackClient';

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
 * Format workflow started notification
 */
export function formatWorkflowStarted(workflow: {
  workflowId: string;
  name: string;
  description?: string;
  totalSteps?: number;
  budgetLimit?: number;
}): { text: string; blocks: SlackBlock[] } {
  const text = `Workflow started: ${workflow.name}`;

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: ':rocket: Workflow Started',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Name:*\n${workflow.name}`,
        },
        {
          type: 'mrkdwn',
          text: `*ID:*\n\`${workflow.workflowId}\``,
        },
      ],
    },
  ];

  if (workflow.description) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Description:*\n${workflow.description}`,
      },
    });
  }

  const details: string[] = [];
  if (workflow.totalSteps) {
    details.push(`*Steps:* ${workflow.totalSteps}`);
  }
  if (workflow.budgetLimit) {
    details.push(`*Budget Limit:* ${formatCost(workflow.budgetLimit)}`);
  }

  if (details.length > 0) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: details.join(' • '),
        },
      ],
    });
  }

  blocks.push({
    type: 'divider',
  });

  return { text, blocks };
}

/**
 * Format workflow completed notification
 */
export function formatWorkflowCompleted(workflow: {
  workflowId: string;
  name: string;
  duration?: number;
  totalCost?: number;
  iterations?: number;
  currentStep?: number;
}): { text: string; blocks: SlackBlock[] } {
  const text = `Workflow completed successfully: ${workflow.name}`;

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: ':white_check_mark: Workflow Completed',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Name:*\n${workflow.name}`,
        },
        {
          type: 'mrkdwn',
          text: `*ID:*\n\`${workflow.workflowId}\``,
        },
      ],
    },
  ];

  const metrics: string[] = [];
  if (workflow.duration) {
    metrics.push(`*Duration:* ${formatDuration(workflow.duration)}`);
  }
  if (workflow.totalCost !== undefined) {
    metrics.push(`*Cost:* ${formatCost(workflow.totalCost)}`);
  }
  if (workflow.iterations) {
    metrics.push(`*Iterations:* ${workflow.iterations}`);
  }
  if (workflow.currentStep) {
    metrics.push(`*Steps:* ${workflow.currentStep}`);
  }

  if (metrics.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: metrics.join('\n'),
      },
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: ':tada: All agents completed successfully',
      },
    ],
  });

  blocks.push({
    type: 'divider',
  });

  return { text, blocks };
}

/**
 * Format workflow failed notification
 */
export function formatWorkflowFailed(workflow: {
  workflowId: string;
  name: string;
  error?: string;
  duration?: number;
  totalCost?: number;
  currentAgent?: string;
  currentStep?: number;
}): { text: string; blocks: SlackBlock[] } {
  const text = `Workflow failed: ${workflow.name} - ${workflow.error || 'Unknown error'}`;

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: ':x: Workflow Failed',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Name:*\n${workflow.name}`,
        },
        {
          type: 'mrkdwn',
          text: `*ID:*\n\`${workflow.workflowId}\``,
        },
      ],
    },
  ];

  if (workflow.error) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Error:*\n\`\`\`${workflow.error}\`\`\``,
      },
    });
  }

  const details: string[] = [];
  if (workflow.currentAgent) {
    details.push(`*Failed at:* ${workflow.currentAgent}`);
  }
  if (workflow.currentStep) {
    details.push(`*Step:* ${workflow.currentStep}`);
  }
  if (workflow.duration) {
    details.push(`*Duration:* ${formatDuration(workflow.duration)}`);
  }
  if (workflow.totalCost !== undefined) {
    details.push(`*Cost:* ${formatCost(workflow.totalCost)}`);
  }

  if (details.length > 0) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: details.join(' • '),
        },
      ],
    });
  }

  blocks.push({
    type: 'divider',
  });

  return { text, blocks };
}

/**
 * Format agent completed notification
 */
export function formatAgentCompleted(agent: {
  agentName: string;
  agentRole?: string;
  workflowId: string;
  workflowName: string;
  stepNumber?: number;
  duration?: number;
  cost?: number;
}): { text: string; blocks: SlackBlock[] } {
  const text = `Agent completed: ${agent.agentName} in workflow ${agent.workflowName}`;

  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:white_check_mark: *Agent Completed: ${agent.agentName}*`,
      },
    },
  ];

  const details: string[] = [];
  if (agent.agentRole) {
    details.push(`*Role:* ${agent.agentRole}`);
  }
  if (agent.stepNumber) {
    details.push(`*Step:* ${agent.stepNumber}`);
  }
  if (agent.duration) {
    details.push(`*Duration:* ${formatDuration(agent.duration)}`);
  }
  if (agent.cost !== undefined) {
    details.push(`*Cost:* ${formatCost(agent.cost)}`);
  }

  if (details.length > 0) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: details.join(' • '),
        },
      ],
    });
  }

  return { text, blocks };
}

/**
 * Format budget warning notification
 */
export function formatBudgetWarning(budget: {
  userId: number;
  dailyCost: number;
  budgetLimit: number;
  percentUsed: number;
  workflowId?: string;
  workflowName?: string;
}): { text: string; blocks: SlackBlock[] } {
  const text = `Budget warning: ${budget.percentUsed.toFixed(0)}% of daily limit used`;

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: ':warning: Budget Warning',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `You have used *${formatCost(budget.dailyCost)}* of your *${formatCost(budget.budgetLimit)}* daily budget (*${budget.percentUsed.toFixed(0)}%*).`,
      },
    },
  ];

  if (budget.workflowId && budget.workflowName) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Triggered by workflow: ${budget.workflowName} (\`${budget.workflowId}\`)`,
        },
      ],
    });
  }

  blocks.push({
    type: 'divider',
  });

  return { text, blocks };
}

/**
 * Format budget exceeded notification
 */
export function formatBudgetExceeded(budget: {
  userId: number;
  dailyCost: number;
  budgetLimit: number;
  workflowId: string;
  workflowName: string;
}): { text: string; blocks: SlackBlock[] } {
  const text = `Budget exceeded: ${budget.workflowName} stopped`;

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: ':rotating_light: Budget Exceeded',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Workflow stopped:* ${budget.workflowName}\n\nYour daily budget limit of *${formatCost(budget.budgetLimit)}* has been exceeded. Current spend: *${formatCost(budget.dailyCost)}*.`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Workflow ID: \`${budget.workflowId}\``,
        },
      ],
    },
    {
      type: 'divider',
    },
  ];

  return { text, blocks };
}

/**
 * Format execution completed notification
 */
export function formatExecutionCompleted(execution: {
  executionId: string;
  projectId: number;
  prompt: string;
  duration?: number;
  cost?: number;
  status: string;
}): { text: string; blocks: SlackBlock[] } {
  const text = `Execution completed: ${execution.executionId}`;

  const promptPreview =
    execution.prompt.length > 100
      ? execution.prompt.substring(0, 100) + '...'
      : execution.prompt;

  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:white_check_mark: *Execution Completed*\n\`\`\`${promptPreview}\`\`\``,
      },
    },
  ];

  const details: string[] = [];
  details.push(`*ID:* \`${execution.executionId}\``);
  if (execution.duration) {
    details.push(`*Duration:* ${formatDuration(execution.duration)}`);
  }
  if (execution.cost !== undefined) {
    details.push(`*Cost:* ${formatCost(execution.cost)}`);
  }

  if (details.length > 0) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: details.join(' • '),
        },
      ],
    });
  }

  return { text, blocks };
}

/**
 * Format execution failed notification
 */
export function formatExecutionFailed(execution: {
  executionId: string;
  projectId: number;
  prompt: string;
  error?: string;
  duration?: number;
  cost?: number;
}): { text: string; blocks: SlackBlock[] } {
  const text = `Execution failed: ${execution.executionId} - ${execution.error || 'Unknown error'}`;

  const promptPreview =
    execution.prompt.length > 100
      ? execution.prompt.substring(0, 100) + '...'
      : execution.prompt;

  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:x: *Execution Failed*\n\`\`\`${promptPreview}\`\`\``,
      },
    },
  ];

  if (execution.error) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Error:*\n\`\`\`${execution.error}\`\`\``,
      },
    });
  }

  const details: string[] = [];
  details.push(`*ID:* \`${execution.executionId}\``);
  if (execution.duration) {
    details.push(`*Duration:* ${formatDuration(execution.duration)}`);
  }
  if (execution.cost !== undefined) {
    details.push(`*Cost:* ${formatCost(execution.cost)}`);
  }

  if (details.length > 0) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: details.join(' • '),
        },
      ],
    });
  }

  return { text, blocks };
}

/**
 * Format generic notification
 */
export function formatGenericNotification(
  title: string,
  message: string,
  level: 'info' | 'success' | 'warning' | 'error' = 'info'
): { text: string; blocks: SlackBlock[] } {
  const emojiMap = {
    info: ':information_source:',
    success: ':white_check_mark:',
    warning: ':warning:',
    error: ':x:',
  };

  const emoji = emojiMap[level];
  const text = `${title}: ${message}`;

  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *${title}*\n${message}`,
      },
    },
  ];

  return { text, blocks };
}
