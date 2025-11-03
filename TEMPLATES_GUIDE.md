# Workflow Templates Library Guide

The Claude Code Service includes a comprehensive workflow templates library that allows you to quickly deploy pre-built, production-ready workflows for common development tasks.

## Overview

Workflow templates are pre-configured multi-agent workflows that can be customized and deployed to your projects with just a few clicks. They include:

- Pre-built agent configurations
- Tool and skill selections
- Safety and budget constraints
- Notification settings
- Customizable variables

## Built-in Templates

### 1. Code Review & QA
**Category**: Code Review & QA
**Difficulty**: Intermediate
**Estimated Time**: 30-45 minutes

Comprehensive multi-agent code review workflow that performs:
- Code quality analysis
- Security vulnerability scanning
- Test coverage validation
- Automated review report generation

**Use Cases**:
- Pre-merge code reviews
- Regular code quality audits
- Security compliance checks
- Technical debt assessment

**Customizable Variables**:
- `repository`: GitHub repository (e.g., "owner/repo")
- `targetDirectory`: Directory to analyze (default: ".")
- `focusAreas`: Specific areas to focus on
- `testCommand`: Command to run tests
- `minCoverage`: Minimum test coverage percentage

### 2. Bug Investigation & Fix
**Category**: Bug Fixing & Debugging
**Difficulty**: Intermediate
**Estimated Time**: 60-90 minutes

Systematic bug investigation and fixing workflow:
- Root cause analysis using debugging skills
- Test-driven fix implementation
- Automated validation and testing
- Pull request creation

**Use Cases**:
- Automated bug fixing
- Issue triage and resolution
- Regression prevention
- Quality assurance

**Customizable Variables**:
- `repository`: GitHub repository
- `bugTitle`: Bug title from issue
- `bugDescription`: Detailed description
- `stepsToReproduce`: Reproduction steps
- `testFramework`: Testing framework (e.g., "vitest")
- `issueUrl`: Link to GitHub issue

### 3. Documentation Generation
**Category**: Documentation Generation
**Difficulty**: Beginner
**Estimated Time**: 30-60 minutes

Automated documentation generation for APIs and codebases:
- Code scanning and inventory
- API documentation generation
- Component documentation
- Usage examples and guides

**Use Cases**:
- API reference documentation
- Component library docs
- README generation
- Technical documentation

**Customizable Variables**:
- `repository`: GitHub repository
- `targetPaths`: Paths to document (e.g., "src/api, src/components")
- `docType`: Documentation type (e.g., "API Reference")
- `docFormat`: Output format (e.g., "Markdown")
- `includeExamples`: Include code examples (true/false)

### 4. Test Case Generation
**Category**: Testing & Validation
**Difficulty**: Advanced
**Estimated Time**: 60-90 minutes

Automated test generation for improved coverage:
- Coverage gap analysis
- Unit and integration test generation
- Edge case testing
- Test quality validation

**Use Cases**:
- Improving test coverage
- Adding missing tests
- Edge case testing
- CI/CD quality gates

**Customizable Variables**:
- `repository`: GitHub repository
- `targetDirectory`: Directory to test
- `minCoverage`: Minimum coverage goal
- `testFramework`: Testing framework
- `testStyle`: Test style (e.g., "BDD")
- `expectedImprovement`: Expected coverage increase

### 5. Application Deployment
**Category**: Deployment & Release
**Difficulty**: Advanced
**Estimated Time**: 90-120 minutes

Full deployment pipeline with validation and rollback:
- Pre-deployment validation
- Build and optimization
- Deployment execution
- Smoke testing
- Automatic rollback on failure

**Use Cases**:
- Production deployments
- Staging releases
- Blue-green deployments
- Continuous deployment

**Customizable Variables**:
- `repository`: GitHub repository
- `environment`: Target environment (staging/production)
- `testCommand`: Test command
- `buildCommand`: Build command
- `deployCommand`: Deployment command
- `appUrl`: Application URL for testing
- `deploymentStrategy`: Deployment strategy

### 6. Data Processing & Analysis
**Category**: Data Processing
**Difficulty**: Intermediate
**Estimated Time**: 120-180 minutes

Automated data collection, processing, and reporting:
- Data collection from multiple sources
- Data cleaning and transformation
- Statistical analysis
- Report generation and distribution

**Use Cases**:
- Weekly/monthly reports
- Data analytics pipelines
- Business intelligence
- Performance monitoring

**Customizable Variables**:
- `dataSource1`, `dataSource2`, `dataSource3`: Data sources
- `dateRange`: Time range for data
- `metricsToCalculate`: Metrics to compute
- `reportFormat`: Report format (PDF, CSV, etc.)
- `recipients`: Report recipients

## Using Templates

### Browsing Templates

1. Navigate to the **Templates** page in the sidebar
2. Browse templates by:
   - **Category**: Filter by workflow type
   - **Difficulty**: Beginner, Intermediate, Advanced
   - **Search**: Search by name or description

### Viewing Template Details

Click on any template card to view:
- Full description
- Customizable variables
- Difficulty and estimated time
- Usage statistics and ratings
- Required agent configurations

### Deploying a Template

1. Click "Deploy" on a template card
2. Select the target **Project**
3. Customize **Variables** (JSON format)
4. Click "Deploy" to create the workflow

The system will:
- Validate variable substitutions
- Create a new workflow
- Apply custom variables
- Track template usage

### Example Deployment

```javascript
{
  "repository": "myorg/myrepo",
  "targetDirectory": "src",
  "testCommand": "npm test",
  "minCoverage": "80",
  "slackChannel": "#code-reviews"
}
```

## Creating Custom Templates

You can create custom templates from existing workflows:

1. Navigate to a completed workflow
2. Click "Save as Template"
3. Fill in template metadata:
   - Name and description
   - Category and tags
   - Difficulty level
   - Estimated time
4. Mark as public (optional)

Custom templates appear in the "Custom Templates" tab and can be shared with your team.

## Template Variables

Templates use the `{{variable}}` syntax for customization:

```yaml
prompt: |
  Analyze the codebase in {{targetDirectory}} for:
  1. Code quality issues
  2. Security vulnerabilities

  Run tests with: {{testCommand}}
```

### Variable Types

- **string**: Text values
- **number**: Numeric values
- **boolean**: true/false values
- **array**: JSON arrays
- **object**: JSON objects

### Required vs Optional

Variables can be marked as:
- **Required**: Must be provided during deployment
- **Optional**: Has default value or can be omitted

## Template Rating and Feedback

Help improve templates by:
- Rating templates (1-5 stars)
- Writing reviews
- Reporting issues
- Suggesting improvements

Access template statistics:
- Total usage count
- Average rating
- Rating distribution
- Recent usage trends

## Best Practices

### Template Selection

1. **Match Complexity**: Choose templates matching your team's expertise level
2. **Estimate Time**: Factor in estimated time for workflow completion
3. **Review Variables**: Understand all required variables before deploying
4. **Check Requirements**: Ensure your project meets template prerequisites

### Variable Configuration

1. **Use Valid JSON**: Always use proper JSON syntax for variables
2. **Test First**: Deploy to a test project first
3. **Document Values**: Keep a record of common variable configurations
4. **Environment-Specific**: Create different variable sets for staging/production

### Customization

1. **Start with Built-in**: Use official templates as a starting point
2. **Incremental Changes**: Make small modifications and test
3. **Save Successful Configs**: Save working configurations as custom templates
4. **Share with Team**: Share successful templates organization-wide

### Monitoring

1. **Track Usage**: Monitor template usage and success rates
2. **Review Costs**: Check budget consumption for each template
3. **Analyze Results**: Review workflow outputs and adjust as needed
4. **Iterate**: Continuously improve templates based on results

## Template Categories Explained

### Code Review & QA
Templates focused on code quality, security analysis, and review automation. Ideal for maintaining high code standards and catching issues early.

### Bug Fixing & Debugging
Templates for systematic bug investigation, root cause analysis, and automated fixing. Reduces time-to-resolution for bugs.

### Documentation Generation
Templates for creating and maintaining documentation. Ensures documentation stays current with code changes.

### Testing & Validation
Templates for test generation, coverage improvement, and quality assurance. Helps maintain robust test suites.

### Deployment & Release
Templates for deployment automation, validation, and rollback. Ensures safe and reliable releases.

### Data Processing
Templates for data pipelines, analysis, and reporting. Automates repetitive data tasks.

## API Access

Templates can also be accessed programmatically via tRPC:

```typescript
// List templates
const templates = await trpc.templates.list.query({
  category: "Code Review & QA",
  difficulty: "intermediate",
});

// Get template details
const template = await trpc.templates.get.query({
  templateId: "tpl-code-review",
});

// Deploy template
const { workflowId } = await trpc.templates.deploy.mutate({
  templateId: "tpl-code-review",
  projectId: 1,
  customVariables: {
    repository: "owner/repo",
    targetDirectory: "src",
  },
});

// Rate template
await trpc.templates.rate.mutate({
  templateId: "tpl-code-review",
  rating: 5,
  review: "Excellent template!",
});
```

## Troubleshooting

### Template Fails to Deploy
- Check all required variables are provided
- Validate JSON syntax in variables
- Ensure project has necessary permissions
- Review project configuration compatibility

### Workflow Fails During Execution
- Check agent container configurations
- Verify tool access permissions
- Review budget and timeout limits
- Check repository access and credentials

### Variables Not Substituting
- Ensure variable names match exactly
- Check JSON syntax in custom variables
- Verify variable types match template expectations
- Review template variable definitions

## Support

For issues or questions about templates:
- Check template documentation and examples
- Review workflow execution logs
- Contact support with template ID and error details
- Contribute improvements via pull requests

## Future Enhancements

Planned template features:
- Template marketplace
- Community templates
- Template versioning
- A/B testing support
- Template analytics dashboard
- Visual template editor
- Template dependency management

---

**Note**: This guide covers the initial release of the Workflow Templates Library. Check back for updates as new features are added.
