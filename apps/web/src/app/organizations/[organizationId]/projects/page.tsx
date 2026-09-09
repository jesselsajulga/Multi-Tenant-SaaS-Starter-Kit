import { requireSession, getOrganizationContext } from "@/lib/auth";
import { fetchWithSession } from "@/lib/api";
import { FolderKanban, ServerCrash, Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import { PageHeader } from "@/components/layout/page-header";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  await requireSession();
  const context = await getOrganizationContext(organizationId);

  const res = await fetchWithSession(`/projects`, {
    headers: {
      "x-organization-id": organizationId,
    }
  });

  if (!res.ok) {
    return (
      <div className="max-w-5xl space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: context?.organization.name || "Workspace", href: `/organizations/${organizationId}/dashboard` },
            { label: "Projects" }
          ]}
          title="Projects"
          description="Manage your organization's projects and initiatives."
        />
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-zinc-200 bg-white">
          <ServerCrash className="w-10 h-10 text-zinc-400 mb-3" />
          <h2 className="text-base font-semibold text-zinc-900 mb-1">Unable to load projects</h2>
          <p className="text-sm text-zinc-500 max-w-md">
            We couldn't retrieve the projects due to a server error. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  const data = await res.json();
  const projects = data.projects || [];

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: context?.organization.name || "Workspace", href: `/organizations/${organizationId}/dashboard` },
          { label: "Projects" }
        ]}
        title="Projects"
        description="Isolated workspace projects and resources."
        actions={<CreateProjectModal organizationId={organizationId} />}
      />

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50">
          <div className="w-10 h-10 bg-zinc-100 text-zinc-400 rounded-md flex items-center justify-center mb-3">
            <FolderKanban className="w-5 h-5 text-zinc-500" />
          </div>
          <h2 className="text-sm font-semibold text-zinc-900 mb-1">No projects in this workspace</h2>
          <p className="text-xs text-zinc-500 max-w-sm mb-5">
            Projects hold tenant-isolated resources protected by PostgreSQL Row-Level Security.
          </p>
          <CreateProjectModal organizationId={organizationId} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project: any) => (
            <Link
              key={project.id}
              href={`/organizations/${organizationId}/projects/${project.id}`}
              className="group flex flex-col justify-between bg-white border border-zinc-200 rounded-lg p-5 hover:border-zinc-300 hover:shadow-xs transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-zinc-100 text-zinc-700 rounded-md group-hover:bg-zinc-200/70 transition-colors">
                    <FolderKanban className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-600 group-hover:translate-x-0.5 transition-all" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 group-hover:text-zinc-950 transition-colors mb-1 truncate">
                  {project.name}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-4 pt-3 border-t border-zinc-100 font-mono">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <span>Created {new Date(project.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
