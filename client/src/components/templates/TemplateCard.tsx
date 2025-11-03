import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Clock, TrendingUp, Eye } from "lucide-react";

interface TemplateCardProps {
  template: {
    templateId: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
    difficulty: "beginner" | "intermediate" | "advanced";
    estimatedTime?: string | null;
    usageCount: number;
    averageRating?: number | null;
    isBuiltIn: boolean;
  };
  onView: () => void;
  onDeploy: () => void;
}

const difficultyColors = {
  beginner: "bg-green-500/10 text-green-500 border-green-500/20",
  intermediate: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  advanced: "bg-red-500/10 text-red-500 border-red-500/20",
};

export function TemplateCard({ template, onView, onDeploy }: TemplateCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg mb-2 flex items-center gap-2">
              {template.name}
              {template.isBuiltIn && (
                <Badge variant="outline" className="text-xs">
                  Official
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="line-clamp-2">
              {template.description}
            </CardDescription>
          </div>
          <Badge className={difficultyColors[template.difficulty]}>
            {template.difficulty}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {template.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {template.tags.length > 4 && (
            <Badge variant="secondary" className="text-xs">
              +{template.tags.length - 4}
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {template.estimatedTime && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{template.estimatedTime}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span>{template.usageCount} uses</span>
          </div>
          {template.averageRating && template.averageRating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              <span>{(template.averageRating / 10).toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Category */}
        <div className="pt-2 border-t">
          <Badge variant="outline" className="text-xs">
            {template.category}
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onView} className="flex-1">
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
          <Button size="sm" onClick={onDeploy} className="flex-1">
            Deploy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
