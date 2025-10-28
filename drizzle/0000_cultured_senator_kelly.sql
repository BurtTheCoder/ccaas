CREATE TABLE `agentExecutions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentExecutionId` varchar(64) NOT NULL,
	`workflowId` varchar(64) NOT NULL,
	`agentName` varchar(255) NOT NULL,
	`agentRole` text,
	`stepNumber` int NOT NULL,
	`status` enum('pending','running','completed','failed','skipped') NOT NULL DEFAULT 'pending',
	`prompt` text NOT NULL,
	`output` text,
	`outputVariable` varchar(255),
	`error` text,
	`containerId` varchar(255),
	`startedAt` timestamp,
	`completedAt` timestamp,
	`duration` int,
	`cost` int,
	`containerConfig` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentExecutions_id` PRIMARY KEY(`id`),
	CONSTRAINT `agentExecutions_agentExecutionId_unique` UNIQUE(`agentExecutionId`)
);
--> statement-breakpoint
CREATE TABLE `apiKeys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`key` varchar(255) NOT NULL,
	`permissions` json,
	`lastUsedAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `apiKeys_id` PRIMARY KEY(`id`),
	CONSTRAINT `apiKeys_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `budgetTracking` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`dailyCost` int NOT NULL DEFAULT 0,
	`executionCount` int NOT NULL DEFAULT 0,
	`workflowCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budgetTracking_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`executionId` varchar(64) NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`prompt` text NOT NULL,
	`status` enum('pending','running','completed','failed','timeout') NOT NULL DEFAULT 'pending',
	`result` text,
	`error` text,
	`containerId` varchar(255),
	`startedAt` timestamp,
	`completedAt` timestamp,
	`duration` int,
	`cost` int,
	`source` varchar(64),
	`sourceMetadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `executions_id` PRIMARY KEY(`id`),
	CONSTRAINT `executions_executionId_unique` UNIQUE(`executionId`)
);
--> statement-breakpoint
CREATE TABLE `logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`executionId` varchar(64),
	`workflowId` varchar(64),
	`agentExecutionId` varchar(64),
	`level` enum('debug','info','warn','error') NOT NULL DEFAULT 'info',
	`message` text NOT NULL,
	`metadata` json,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`workflowId` varchar(64),
	`executionId` varchar(64),
	`type` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`severity` enum('info','warning','error','critical') NOT NULL DEFAULT 'info',
	`read` boolean NOT NULL DEFAULT false,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`path` text NOT NULL,
	`description` text,
	`userId` int NOT NULL,
	`containerConfig` json,
	`workflowConfig` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workflowId` varchar(64) NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`status` enum('pending','running','paused','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`currentAgent` varchar(255),
	`currentStep` int DEFAULT 0,
	`totalSteps` int,
	`iterations` int DEFAULT 0,
	`maxIterations` int,
	`consecutiveFailures` int DEFAULT 0,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`duration` int,
	`totalCost` int DEFAULT 0,
	`budgetLimit` int,
	`config` json,
	`context` json,
	`state` json,
	`error` text,
	`source` varchar(64),
	`sourceMetadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflows_id` PRIMARY KEY(`id`),
	CONSTRAINT `workflows_workflowId_unique` UNIQUE(`workflowId`)
);
