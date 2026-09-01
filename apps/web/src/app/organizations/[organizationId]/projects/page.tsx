import { requireSession } from "@/lib/auth";
import { fetchWithSession } from "@/lib/api";
import { FolderKanban, ServerCrash, Calendar } from "lucide-react";
import Link from "next/link";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  await requireSession();

  const res = await fetchWithSession(`/projects`, {
    headers: {
      "x-organization-id": organizationId,
    }
  });

  if (!res.ok) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-zinc-200 bg-white">
        <ServerCrash className="w-12 h-12 text-zinc-400 mb-4" />
        <h2 className="text-lg font-semibold text-zinc-900 mb-2">Unable to load projects</h2>
        <p className="text-zinc-500 max-w-md">
          We couldn't retrieve the projects due to a server error. Please try again later.
        </p>
      </div>
    );
  }

  const data = await res.json();
  const projects = data.projects || [];

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 mb-1">
            Projects
          </h1>
          <p className="text-zinc-600">
            Manage your organization's projects and initiatives.
          </p>
        </div>
        <CreateProjectModal organizationId={organizationId} />
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-dashed border-zinc-300 bg-white">
          <div className="w-12 h-12 bg-zinc-100 text-zinc-400 rounded-full flex items-center justify-center mb-4">
            <FolderKanban className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-medium text-zinc-900 mb-1">No projects yet</h2>
          <p className="text-zinc-500 max-w-sm mb-6">
            Get started by creating your first project to organize your work.
          </p>
          <CreateProjectModal organizationId={organizationId} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project: any) => (
            <Link
              key={project.id}
              href={`/organizations/${organizationId}/projects/${project.id}`}
              className="block group bg-white border border-zinc-200 rounded-lg p-5 hover:border-blue-500 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-md">
                  <FolderKanban className="w-5 h-5" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-zinc-900 group-hover:text-blue-600 transition-colors mb-1 truncate">
                {project.name}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Calendar className="w-3.5 h-3.5" />
                Created {new Date(project.createdAt).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
