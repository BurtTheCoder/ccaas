import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Save } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface ProjectBasicInfoProps {
  projectId: number;
  initialData: {
    name: string;
    description: string | null;
    path: string;
    createdAt: Date | string;
    updatedAt: Date | string;
  };
}

export function ProjectBasicInfo({ projectId, initialData }: ProjectBasicInfoProps) {
  const [formData, setFormData] = useState({
    name: initialData.name,
    description: initialData.description || "",
    path: initialData.path,
  });

  const [hasChanges, setHasChanges] = useState(false);

  const utils = trpc.useUtils();

  const updateMutation = trpc.projects.update.useMutation({
    onSuccess: () => {
      toast.success("Project updated successfully");
      setHasChanges(false);
      utils.projects.list.invalidate();
      utils.projects.get.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to update project: ${error.message}`);
    },
  });

  useEffect(() => {
    const changed =
      formData.name !== initialData.name ||
      formData.description !== (initialData.description || "") ||
      formData.path !== initialData.path;
    setHasChanges(changed);
  }, [formData, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      id: projectId,
      name: formData.name,
      description: formData.description || undefined,
      path: formData.path,
    });
  };

  const handleReset = () => {
    setFormData({
      name: initialData.name,
      description: initialData.description || "",
      path: initialData.path,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
        <CardDescription>
          Update your project name, description, and path
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="my-awesome-project"
              required
            />
            <p className="text-sm text-muted-foreground">
              A unique name for your project
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="A brief description of your project..."
              rows={4}
            />
            <p className="text-sm text-muted-foreground">
              Optional description to help identify this project
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="path">Project Path *</Label>
            <Input
              id="path"
              value={formData.path}
              onChange={(e) => setFormData({ ...formData, path: e.target.value })}
              placeholder="/path/to/project"
              required
              className="font-mono text-sm"
            />
            <p className="text-sm text-muted-foreground">
              Absolute path to the project directory containing .claude/workflow.yaml
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="text-sm font-medium">
                {new Date(initialData.createdAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="text-sm font-medium">
                {new Date(initialData.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>

          {hasChanges && (
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={updateMutation.isPending}
              >
                Reset
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
