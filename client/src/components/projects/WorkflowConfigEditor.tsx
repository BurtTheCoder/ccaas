import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertCircle, Save, RotateCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WorkflowConfigEditorProps {
  projectId: number;
  projectPath: string;
}

export function WorkflowConfigEditor({ projectId, projectPath }: WorkflowConfigEditorProps) {
  const [config, setConfig] = useState("");
  const [originalConfig, setOriginalConfig] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { data: configData, isLoading } = trpc.projects.getWorkflowConfig.useQuery(
    { id: projectId },
    { enabled: projectId > 0 }
  );

  const utils = trpc.useUtils();

  const updateMutation = trpc.projects.updateWorkflowConfig.useMutation({
    onSuccess: () => {
      toast.success("Workflow configuration updated successfully");
      setOriginalConfig(config);
      setHasChanges(false);
      setValidationError(null);
      utils.projects.get.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to update configuration: ${error.message}`);
    },
  });

  useEffect(() => {
    if (configData?.workflowConfig) {
      const configStr = configData.workflowConfig;
      setConfig(configStr);
      setOriginalConfig(configStr);
    }
  }, [configData]);

  useEffect(() => {
    setHasChanges(config !== originalConfig);

    // Basic YAML validation
    if (config.trim()) {
      try {
        // Simple validation - check for common YAML syntax errors
        const lines = config.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Check for tabs (YAML doesn't allow tabs)
          if (line.includes('\t')) {
            setValidationError(`Line ${i + 1}: YAML does not allow tabs. Use spaces for indentation.`);
            return;
          }
        }
        setValidationError(null);
      } catch (error) {
        setValidationError("Invalid YAML syntax");
      }
    } else {
      setValidationError(null);
    }
  }, [config, originalConfig]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validationError) {
      toast.error("Please fix validation errors before saving");
      return;
    }

    updateMutation.mutate({
      id: projectId,
      workflowConfig: config,
    });
  };

  const handleReset = () => {
    setConfig(originalConfig);
    setValidationError(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workflow Configuration</CardTitle>
          <CardDescription>Loading configuration...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Configuration</CardTitle>
        <CardDescription>
          Edit the workflow.yaml configuration for multi-agent workflows
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Path: <span className="font-mono">{projectPath}/.claude/workflow.yaml</span>
              </p>
            </div>
            <Textarea
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              placeholder="# workflow.yaml configuration&#10;name: My Workflow&#10;description: A multi-agent workflow&#10;version: 1.0.0&#10;agents:&#10;  - name: agent-1&#10;    role: Developer&#10;    container:&#10;      image: node:20&#10;    prompt: Your task..."
              className="font-mono text-sm min-h-[500px] resize-y"
              spellCheck={false}
            />
            <p className="text-sm text-muted-foreground">
              Define workflow metadata, agents, triggers, budget limits, and safety settings
            </p>
          </div>

          {hasChanges && (
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={updateMutation.isPending}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending || !!validationError}
              >
                <Save className="h-4 w-4 mr-2" />
                {updateMutation.isPending ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
