import { requireSession } from "@/lib/auth";
import { fetchWithSession } from "@/lib/api";
import { ServerCrash, FolderKanban, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ProjectSettingsClient } from "@/components/projects/ProjectSettingsClient";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; projectId: string }>;
}) {
  const { organizationId, projectId } = await params;
  await requireSession();

  const res = await fetchWithSession(`/projects/${projectId}`, {
    headers: {
      "x-organization-id": organizationId,
    }
  });

  if (res.status === 404) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-zinc-200 bg-white">
        <FolderKanban className="w-12 h-12 text-zinc-400 mb-4" />
        <h2 className="text-lg font-semibold text-zinc-900 mb-2">Project Not Found</h2>
        <p className="text-zinc-500 max-w-md mb-6">
          The project you are looking for doesn't exist or you don't have permission to access it.
        </p>
        <Link 
          href={`/organizations/${organizationId}/projects`}
          className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </Link>
      </div>
    );
  }

  if (!res.ok) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-zinc-200 bg-white">
        <ServerCrash className="w-12 h-12 text-zinc-400 mb-4" />
        <h2 className="text-lg font-semibold text-zinc-900 mb-2">Unable to load project</h2>
        <p className="text-zinc-500 max-w-md mb-6">
          We couldn't retrieve the project details due to a server error. Please try again later.
        </p>
        <Link 
          href={`/organizations/${organizationId}/projects`}
          className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </Link>
      </div>
    );
  }

  const data = await res.json();
  const project = data.project;

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <Link 
          href={`/organizations/${organizationId}/projects`}
          className="text-zinc-500 hover:text-zinc-900 font-medium text-sm flex items-center gap-1.5 w-fit transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Projects
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-zinc-100 text-zinc-700 rounded-lg">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 mb-1">
              {project.name}
            </h1>
            <p className="text-sm text-zinc-500">
              Created {new Date(project.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <ProjectSettingsClient 
        organizationId={organizationId} 
        projectId={projectId} 
        initialName={project.name} 
      />
    </div>
  );
}
