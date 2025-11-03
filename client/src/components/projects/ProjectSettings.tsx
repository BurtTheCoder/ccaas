import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Save, Trash2, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";

interface ProjectSettingsProps {
  projectId: number;
  projectName: string;
  initialSettings?: {
    budgetLimit?: number;
    timeout?: number;
    maxConcurrentExecutions?: number;
  };
}

export function ProjectSettings({ projectId, projectName, initialSettings }: ProjectSettingsProps) {
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState({
    budgetLimit: initialSettings?.budgetLimit?.toString() || "",
    timeout: initialSettings?.timeout?.toString() || "3600",
    maxConcurrentExecutions: initialSettings?.maxConcurrentExecutions?.toString() || "5",
  });

  const [hasChanges, setHasChanges] = useState(false);

  const utils = trpc.useUtils();

  const updateMutation = trpc.projects.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Settings updated successfully");
      setHasChanges(false);
      utils.projects.get.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to update settings: ${error.message}`);
    },
  });

  const deleteMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      toast.success("Project deleted successfully");
      setLocation("/projects");
    },
    onError: (error) => {
      toast.error(`Failed to delete project: ${error.message}`);
    },
  });

  useEffect(() => {
    const changed =
      settings.budgetLimit !== (initialSettings?.budgetLimit?.toString() || "") ||
      settings.timeout !== (initialSettings?.timeout?.toString() || "3600") ||
      settings.maxConcurrentExecutions !== (initialSettings?.maxConcurrentExecutions?.toString() || "5");
    setHasChanges(changed);
  }, [settings, initialSettings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    updateMutation.mutate({
      id: projectId,
      settings: {
        budgetLimit: settings.budgetLimit ? parseInt(settings.budgetLimit) : undefined,
        timeout: parseInt(settings.timeout),
        maxConcurrentExecutions: parseInt(settings.maxConcurrentExecutions),
      },
    });
  };

  const handleDelete = () => {
    const confirmText = `delete ${projectName}`;
    const userInput = prompt(
      `This action cannot be undone. This will permanently delete the project "${projectName}" and all associated data.\n\nType "${confirmText}" to confirm:`
    );

    if (userInput === confirmText) {
      deleteMutation.mutate({ id: projectId });
    } else if (userInput !== null) {
      toast.error("Project name did not match. Deletion cancelled.");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Resource Limits</CardTitle>
          <CardDescription>
            Configure budget and resource constraints for this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="budgetLimit">Daily Budget Limit (cents)</Label>
              <Input
                id="budgetLimit"
                type="number"
                min="0"
                step="100"
                value={settings.budgetLimit}
                onChange={(e) => setSettings({ ...settings, budgetLimit: e.target.value })}
                placeholder="10000 (= $100.00)"
              />
              <p className="text-sm text-muted-foreground">
                Maximum cost per day in cents. Leave empty for no limit.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeout">Execution Timeout (seconds)</Label>
              <Select
                value={settings.timeout}
                onValueChange={(value) => setSettings({ ...settings, timeout: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="300">5 minutes</SelectItem>
                  <SelectItem value="600">10 minutes</SelectItem>
                  <SelectItem value="1800">30 minutes</SelectItem>
                  <SelectItem value="3600">1 hour</SelectItem>
                  <SelectItem value="7200">2 hours</SelectItem>
                  <SelectItem value="14400">4 hours</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Maximum time allowed for a single execution before timeout
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxConcurrent">Max Concurrent Executions</Label>
              <Select
                value={settings.maxConcurrentExecutions}
                onValueChange={(value) => setSettings({ ...settings, maxConcurrentExecutions: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Maximum number of executions that can run simultaneously
              </p>
            </div>

            {hasChanges && (
              <div className="flex justify-end pt-4 border-t">
                <Button type="submit" disabled={updateMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Deleting this project will permanently remove all associated data, including
              executions, workflows, logs, and configurations. This action cannot be undone.
            </AlertDescription>
          </Alert>

          <div className="flex items-center justify-between p-4 border border-destructive/50 rounded-lg bg-destructive/5">
            <div>
              <p className="font-medium text-sm">Delete this project</p>
              <p className="text-sm text-muted-foreground mt-1">
                Once deleted, this project and all its data will be gone forever
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteMutation.isPending ? "Deleting..." : "Delete Project"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
